import fs from 'fs';
import { Router } from 'express';
import { validateKeyLimiter } from '../security';
import { recordChatEvent } from '../metrics';
import {
  DEFAULT_BASE_URLS,
  DEFAULT_MODELS,
  isAllowedLocalBaseUrl,
  resolveAIConfig,
  sanitizeApiKey,
  type ResolvedAIConfig,
  type SupportedProvider,
} from '../ai/providers';
import { generateUnifiedCompletion, streamUnifiedChat, trimUpstreamError } from '../ai/completion';
import { sseWrite } from '../ai/sse';
import {
  extractTextFromPdf,
  hasExplicitSolveIntent,
  hasReadablePdfText,
  parseSlashCommand,
  renderPdfPagesAsPngAttachments,
  resolveOfficialPdfPath,
  searchLocalDocumentsDetailed,
  transcribeScannedOfficialPdf,
} from '../rag';
import { extractOcrFromPdfBuffer, isLikelyGeminiKey } from '../visionExtractor';
import { getSiDrissBasePrompt, getInstruction, normalizeBranchParam } from '../prompts';
import { sanitizeStudentProfile, sanitizeStudentMemory } from '../personaLoader';
import type { ClientAttachment, ClientMessage } from '../ai/adapters';

const MAX_ATTACHED_PDF_TEXT_CHARS = 24_000;
const MAX_INLINE_OFFICIAL_PDF_BYTES = 11 * 1024 * 1024;
const VISION_IMAGE_PROVIDERS = new Set<SupportedProvider>(['openai', 'anthropic', 'openrouter']);

function resolveGeminiVisionKey(aiConfig: ResolvedAIConfig): string {
  if (aiConfig.provider === 'gemini' && isLikelyGeminiKey(aiConfig.apiKey)) {
    return aiConfig.apiKey;
  }
  if (!aiConfig.clientProvidedKey) {
    const envKey = sanitizeApiKey(process.env.GEMINI_API_KEY || '');
    if (isLikelyGeminiKey(envKey)) return envKey;
  }
  return '';
}

/**
 * Extrait le texte des pièces jointes PDF (ou lance un OCR / rendu pages pour les PDF scannés)
 * afin que tous les fournisseurs puissent lire automatiquement les sujets PDF scannés.
 */
async function enrichPdfAttachments(
  messages: ClientMessage[],
  geminiOcrKey: string,
  provider: SupportedProvider
): Promise<ClientMessage[]> {
  if (!Array.isArray(messages)) return [];
  const enriched: ClientMessage[] = [];

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    if (!Array.isArray(msg.attachments) || msg.attachments.length === 0) {
      enriched.push(msg);
      continue;
    }

    const updatedAtts: ClientAttachment[] = [];
    for (const att of msg.attachments) {
      if (!att || typeof att !== 'object') continue;
      if (att.mimeType === 'application/pdf') {
        const cleanExistingText = att.text && hasReadablePdfText(att.text) ? att.text : undefined;
        if (!cleanExistingText && typeof att.data === 'string') {
          try {
            const compact = att.data.replace(/\s+/g, '');
            const commaIdx = compact.indexOf(',');
            const rawBase64 = commaIdx >= 0 ? compact.slice(commaIdx + 1) : compact;
            if (rawBase64) {
              const pdfBuffer = Buffer.from(rawBase64, 'base64');
              const pdfText = (await extractTextFromPdf(pdfBuffer)).trim();
              if (hasReadablePdfText(pdfText)) {
                updatedAtts.push({ ...att, text: pdfText.slice(0, MAX_ATTACHED_PDF_TEXT_CHARS) });
                continue;
              }

              // PDF scanné : tentative d'OCR automatique via Gemini Vision si une clé Gemini est disponible
              if (geminiOcrKey) {
                const ocr = await extractOcrFromPdfBuffer(pdfBuffer, att.name || 'document.pdf', geminiOcrKey, 45_000);
                if (ocr.status === 'ok' && hasReadablePdfText(ocr.text)) {
                  updatedAtts.push({ ...att, text: ocr.text.slice(0, MAX_ATTACHED_PDF_TEXT_CHARS) });
                  continue;
                }
              }

              // Secours multimodal pour OpenAI / Anthropic / OpenRouter : convertir les pages scannées en PNG
              if (VISION_IMAGE_PROVIDERS.has(provider)) {
                const pageImgs = await renderPdfPagesAsPngAttachments(pdfBuffer, undefined, 6);
                updatedAtts.push({ ...att, text: undefined });
                for (const img of pageImgs) {
                  updatedAtts.push(img);
                }
                continue;
              }
            }
          } catch (pdfErr: any) {
            console.warn('[Chat] Extraction PDF pièce jointe échouée:', pdfErr?.message || pdfErr);
          }
        }
        updatedAtts.push(cleanExistingText ? att : { ...att, text: cleanExistingText });
        continue;
      }
      updatedAtts.push(att);
    }

    enriched.push({ ...msg, attachments: updatedAtts });
  }

  return enriched;
}

/**
 * Construit les termes de recherche documentaire pour le RAG en préservant
 * les pièces jointes, les documents et les références mentionnés tout au long de la session,
 * même lorsque le dernier message utilisateur est une courte relance (ex: "Et la question 2 ?").
 */
function buildPersistentSearchTerms(enrichedMessages: ClientMessage[]): string {
  const userMessages = enrichedMessages.filter((m) => m && m.role === 'user');
  if (userMessages.length === 0) return '';

  const lastUser = userMessages[userMessages.length - 1];
  let searchTerms = lastUser?.content || '';

  // Intègre les noms et extraits des pièces jointes de TOUTE la session
  for (const uMsg of userMessages) {
    if (Array.isArray(uMsg.attachments)) {
      for (const att of uMsg.attachments) {
        if (att?.name && !searchTerms.includes(att.name)) {
          searchTerms += ' ' + att.name;
        }
        if (att?.text && !searchTerms.includes(att.text.slice(0, 50))) {
          searchTerms += ' ' + att.text.slice(0, 300);
        }
      }
    }
  }

  // Si la discussion comporte plusieurs tours et que la dernière question est courte,
  // enrichit avec les noms d'épreuves/documents ou l'énoncé du début de discussion
  if (userMessages.length > 1) {
    const priorText = userMessages.slice(0, -1).map((m) => m.content).join(' ');
    const docMatch = priorText.match(/(?:SN|SR|PC|SM)?[-_ ]?20\d\d[-_ ]?(?:SN|SR|PC|SM)?(?:\.pdf)?|[A-Za-z0-9_-]+\.pdf/gi);
    if (docMatch) {
      for (const dm of docMatch) {
        if (!searchTerms.toLowerCase().includes(dm.toLowerCase())) {
          searchTerms += ' ' + dm;
        }
      }
    } else if (searchTerms.trim().length < 80) {
      searchTerms = `${userMessages[0].content.slice(0, 150)} ${searchTerms}`;
    }
  }

  return searchTerms;
}

/**
 * Extrait le JSON même si le fournisseur ajoute du texte ou des balises markdown autour.
 */
function parseLlmJsonObject(raw: string): any {
  const cleaned = String(raw || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('JSON_PARSE_FAILED');
  }
}

/**
 * Propage les codes HTTP significatifs des fournisseurs IA (401/403/429/502/503)
 * au lieu de tout masquer en erreur 500.
 */
function sendAiRouteError(res: any, err: any, fallbackMessage: string) {
  const explicitStatus = Number(err?.statusCode || err?.status || 0);
  const msg = String(err?.message || '');
  let status = 500;
  if (explicitStatus >= 400 && explicitStatus < 600) {
    status = explicitStatus;
  } else if (/\b401\b|unauthorized|invalid.?api.?key|api.?key.?invalid/i.test(msg)) {
    status = 401;
  } else if (/\b403\b|forbidden|permission_denied/i.test(msg)) {
    status = 403;
  } else if (/\b429\b|rate.?limit|quota|resource_exhausted/i.test(msg)) {
    status = 429;
  } else if (/\b(502|503|504)\b|timeout|aborted/i.test(msg)) {
    status = 503;
  }

  return res.status(status).json({
    error: status === 401 ? 'API_KEY_REQUIRED' : fallbackMessage,
    message: trimUpstreamError(msg) || fallbackMessage,
  });
}

/** Routes IA : statut, validation de clé, chat (stream + fallback), audit, générateur. */
export function createAiRouter(): Router {
  const router = Router();

router.get('/ai-status', (_req, res) => {
  const serverKey =
    process.env.GEMINI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.MISTRAL_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.AI_API_KEY ||
    '';

  const serverProvider =
    process.env.AI_PROVIDER ||
    (process.env.GROQ_API_KEY
      ? 'groq'
      : process.env.OPENAI_API_KEY
      ? 'openai'
      : process.env.ANTHROPIC_API_KEY
      ? 'anthropic'
      : process.env.GEMINI_API_KEY
      ? 'gemini'
      : process.env.OLLAMA_BASE_URL
      ? 'custom'
      : '');

  return res.json({
    // Ne déclarer le serveur configuré que si une VRAIE clé existe, ou si le
    // fournisseur par défaut est bien Ollama/custom ET que son URL est définie.
    // (Audit FAIBLE : OLLAMA_BASE_URL seul ne doit pas masquer l'absence de clé.)
    serverConfigured:
      Boolean(serverKey) || (serverProvider === 'custom' && Boolean(process.env.OLLAMA_BASE_URL)),
    serverProvider: serverProvider || 'none',
    serverModel: process.env.AI_MODEL || '',
  });
});

// Key & Connection Validator (Universal for all providers)
router.post('/validate-key', validateKeyLimiter, async (req, res) => {
  try {
    const rawProvider = (req.headers['x-ai-provider'] || req.body?.provider || 'gemini') as string;
    const provider = rawProvider.toLowerCase() as SupportedProvider;

    const rawKey = (
      (req.headers['x-ai-key'] as string) ||
      (req.headers['x-gemini-api-key'] as string) ||
      req.body?.apiKey ||
      ''
    ).trim();
    const apiKey = sanitizeApiKey(rawKey);

    const model = (req.headers['x-ai-model'] || req.body?.model || DEFAULT_MODELS[provider]) as string;
    const baseUrl = (req.headers['x-ai-base-url'] || req.body?.baseUrl || DEFAULT_BASE_URLS[provider] || '') as string;

    // SSRF guard: local/custom endpoints only, loopback/RFC1918 hosts
    if (provider === 'custom' && baseUrl && !isAllowedLocalBaseUrl(baseUrl)) {
      return res.status(400).json({
        valid: false,
        error: 'URL locale non autorisée : seuls localhost / réseau privé (Ollama) sont acceptés.',
      });
    }

    if (provider !== 'custom' && !apiKey) {
      return res.status(400).json({ valid: false, error: `Veuillez saisir votre clé API pour ${provider}.` });
    }

    const testConfig: ResolvedAIConfig = {
      provider,
      apiKey,
      model,
      baseUrl,
      clientProvidedKey: Boolean(apiKey),
    };

    const testMessages: ClientMessage[] = [{ role: 'user', content: 'Bonjour' }];

    try {
      const result = await generateUnifiedCompletion(
        testConfig,
        testMessages,
        'Tu es un assistant de test. Réponds brièvement "OK".'
      );

      return res.json({
        valid: true,
        modelTested: result.model,
        providerTested: provider,
        message: `Fournisseur ${provider.toUpperCase()} connecté avec succès avec le modèle ${result.model} ! Tbarkellah 3lik.`,
      });
    } catch (testErr: any) {
      const errMsg = trimUpstreamError(testErr?.message || '');

      // If rate limited (429), provider recognized key as authentic!
      if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
        return res.json({
          valid: true,
          modelTested: model,
          providerTested: provider,
          message: `Clé ${provider.toUpperCase()} reconnue et authentifiée ! (Quota en attente de réinitialisation).`,
        });
      }

      console.warn(`[Validate Key] Error testing ${provider}:`, errMsg);
      return res.status(400).json({
        valid: false,
        error: `Erreur de connexion avec ${provider.toUpperCase()} : ${errMsg}`,
        canSaveAnyway: true,
      });
    }
  } catch (err: any) {
    return res.status(400).json({
      valid: false,
      error: err?.message || 'Erreur inattendue lors de la vérification.',
    });
  }
});

async function prepareChatContext(
  req: any,
  aiConfig: ResolvedAIConfig,
  messages: ClientMessage[],
  context: unknown,
  mode: string,
  socraticEnabled: boolean,
  branch: 'PC' | 'SM',
  rawProfile?: unknown,
  rawMemory?: unknown
) {
  const geminiOcrKey = resolveGeminiVisionKey(aiConfig);
  const enrichedMessages = await enrichPdfAttachments(messages, geminiOcrKey, aiConfig.provider);
  let lastUserIdx = -1;
  for (let i = enrichedMessages.length - 1; i >= 0; i--) {
    if (enrichedMessages[i]?.role === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  const lastUserMessage = lastUserIdx >= 0 ? enrichedMessages[lastUserIdx] : undefined;
  const hasUserAttachments = enrichedMessages.some(
    (m) => m.role === 'user' && Array.isArray(m.attachments) && m.attachments.length > 0
  );
  const lastUserText = lastUserMessage?.content || '';
  const slashCmd = parseSlashCommand(lastUserText);

  // Suivi multi-tours : si l'élève enchaîne (ex: "résoudre l'exercice 2 de cette série") après un /exercice ou /examen,
  // on rattache automatiquement le contexte du document précédent.
  let inheritedSlash = slashCmd;
  if (!inheritedSlash && lastUserIdx > 0) {
    const looksLikeDocFollowUp =
      /\b(cette\s+s[eé]rie|ce\s+sujet|ce\s+cours|cet\s+exercice|exercice\s*\d+|ex\s*\d+|question\s*\d+|partie\s*\d+|r[eé]soudre|corrig[eé]|correction|solution)\b/i.test(
        lastUserText
      );
    if (looksLikeDocFollowUp) {
      for (let i = lastUserIdx - 1; i >= 0; i--) {
        if (enrichedMessages[i]?.role !== 'user') continue;
        const prior = parseSlashCommand(enrichedMessages[i].content || '');
        if (prior && ['exercice', 'examen', 'cours', 'cadre'].includes(prior.command)) {
          inheritedSlash = prior;
          break;
        }
      }
    }
  }

  const effectiveMessages =
    slashCmd && lastUserIdx >= 0
      ? enrichedMessages.map((m, idx) =>
          idx === lastUserIdx ? { ...m, content: slashCmd.effectivePrompt } : m
        )
      : enrichedMessages;

  const effectiveMode = slashCmd?.command === 'piege' ? 'trap' : mode;
  const effectiveSocratic = slashCmd?.command === 'piege' ? true : socraticEnabled;
  const activeCommand = slashCmd?.command || inheritedSlash?.command;
  const activeCommandArg = slashCmd
    ? slashCmd.arg
    : inheritedSlash
    ? `${inheritedSlash.arg} ${lastUserText}`.trim()
    : '';
  const solveRequested = hasExplicitSolveIntent(slashCmd ? slashCmd.arg : lastUserText);

  const explicitExamRequested =
    activeCommand === 'examen' ||
    (/\b(20[012]\d)\b/.test(lastUserText) &&
      /\b(national|annale|epreuve|officiel|sn|sr)\b/i.test(lastUserText));
  const explicitOfficialRequested =
    explicitExamRequested ||
    Boolean(activeCommand && ['cours', 'examen', 'exercice', 'cadre'].includes(activeCommand)) ||
    /\.pdf\b/i.test(lastUserText) ||
    /\b(affiche|afficher|montre|montrer|ouvre|ouvrir|voir)\b[\s\S]{0,40}\b(cours|manuel|polycopie|document|officiel)\b/i.test(lastUserText);

  const searchTerms = activeCommandArg
    ? activeCommandArg
    : buildPersistentSearchTerms(effectiveMessages);
  const searchOpts = {
    hasUserAttachments,
    explicitExamRequested,
    explicitOfficialRequested,
    latestUserText: slashCmd
      ? slashCmd.arg || slashCmd.effectivePrompt
      : inheritedSlash
      ? `${inheritedSlash.arg} ${lastUserText}`.trim()
      : lastUserText,
    forcedCommand: activeCommand,
    commandArg: inheritedSlash && !slashCmd ? inheritedSlash.arg : slashCmd?.arg,
  };
  let { contextText: matchedDocs, officialSource, isScannedPdf } = await searchLocalDocumentsDetailed(
    searchTerms,
    branch,
    searchOpts
  );

  // Lecture automatique des PDF officiels scannés : OCR persistant en priorité (pour tous les moteurs),
  // puis injection visuelle directe (PDF natif Gemini ou pages PNG pour OpenAI/Anthropic/OpenRouter).
  let inlineOfficialPdfAttached = false;
  let finalMessages = effectiveMessages;

  if (officialSource?.isPdf && isScannedPdf) {
    if (geminiOcrKey) {
      const ocrOk = await transcribeScannedOfficialPdf(officialSource.relativePath, geminiOcrKey);
      if (ocrOk) {
        const refreshed = await searchLocalDocumentsDetailed(searchTerms, branch, searchOpts);
        matchedDocs = refreshed.contextText;
        officialSource = refreshed.officialSource;
        isScannedPdf = refreshed.isScannedPdf;
      }
    }

    if (officialSource?.isPdf && isScannedPdf && lastUserIdx >= 0) {
      const absPdfPath = resolveOfficialPdfPath(officialSource.relativePath);
      if (absPdfPath) {
        const extraAttachments: ClientAttachment[] = [];
        if (aiConfig.provider === 'gemini') {
          try {
            const stat = fs.statSync(absPdfPath);
            if (stat.size <= MAX_INLINE_OFFICIAL_PDF_BYTES) {
              extraAttachments.push({
                name: officialSource.name,
                type: 'pdf',
                mimeType: 'application/pdf',
                data: fs.readFileSync(absPdfPath).toString('base64'),
              });
            }
          } catch {}
        } else if (VISION_IMAGE_PROVIDERS.has(aiConfig.provider)) {
          const targetPages =
            officialSource.pages && officialSource.pages.length > 1
              ? officialSource.pages
              : Array.from({ length: Math.min(officialSource.totalPages || 1, 6) }, (_, idx) => idx + 1);
          const pngPages = await renderPdfPagesAsPngAttachments(absPdfPath, targetPages, 6);
          extraAttachments.push(...pngPages);
        }

        if (extraAttachments.length > 0) {
          inlineOfficialPdfAttached = true;
          matchedDocs = matchedDocs.replace(
            /\n?\[IMPORTANT — PDF(?: MANUSCRIT \/)? SCANNÉ SANS OCR :[^\]]+\]\n?/g,
            '\n[PDF SCANNÉ JOINT VISUELLEMENT — Lis directement les pages jointes pour extraire et traiter l’énoncé exact.]\n'
          );
          finalMessages = effectiveMessages.map((msg, idx) =>
            idx === lastUserIdx
              ? { ...msg, attachments: [...(msg.attachments || []), ...extraAttachments] }
              : msg
          );
        }
      }
    }
  }

  const validatedProfile = sanitizeStudentProfile(rawProfile);
  const validatedMemory = sanitizeStudentMemory(rawMemory, branch);

  const fullInstruction = getInstruction(effectiveMode, effectiveSocratic, matchedDocs, branch, typeof context === 'string' ? context : undefined, {
    hasOfficialPdf: Boolean(officialSource?.isPdf),
    isScannedPdf,
    inlineOfficialPdfAttached,
    officialCategory: officialSource?.category,
    solveRequested,
    skillQuery: `${lastUserText} ${matchedDocs.slice(0, 400)}`,
    studentProfile: validatedProfile,
    studentMemory: validatedMemory,
  });

  // Enregistrement télémétrique anonymisé pour le dashboard admin
  recordChatEvent(req, {
    branch,
    provider: aiConfig.provider,
    model: aiConfig.model,
    userText: slashCmd ? `/${slashCmd.command} ${slashCmd.arg}`.trim() : lastUserText,
    mode: effectiveMode,
    ragStatus: officialSource?.isPdf ? 'Document Officiel' : matchedDocs ? 'RAG Indexé' : 'Conforme Cadre',
  });

  return {
    effectiveMessages: finalMessages,
    fullInstruction,
    matchedDocs,
    officialSource,
  };
}

// Streaming Chat (Server-Sent Events)
router.post('/chat/stream', async (req, res) => {
  let aiConfig: ResolvedAIConfig;
  try {
    aiConfig = resolveAIConfig(req);
  } catch (keyErr: any) {
    return res.status(401).json({
      error: 'API_KEY_REQUIRED',
      message: keyErr?.message || 'Veuillez configurer une clé API pour continuer.',
    });
  }

  try {
    const { messages, context, mode, socraticEnabled = true, studentProfile, studentMemory } = req.body;
    const branch = normalizeBranchParam(req.body?.branch);

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Format invalide.' });
    }

    const { effectiveMessages, fullInstruction, officialSource } = await prepareChatContext(
      req,
      aiConfig,
      messages,
      context,
      mode,
      socraticEnabled,
      branch,
      studentProfile,
      studentMemory
    );

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(': ping\n\n');
    if (officialSource?.isPdf) {
      sseWrite(res, { officialSource });
    }

    // Abort upstream provider requests the moment the client disconnects
    const disconnectController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) disconnectController.abort();
    });

    const heartbeat = setInterval(() => {
      try {
        if (!res.writableEnded && !res.destroyed) res.write(': keepalive\n\n');
      } catch {}
    }, 10000);

    try {
      await streamUnifiedChat(aiConfig, effectiveMessages, fullInstruction, res, disconnectController.signal);
    } finally {
      clearInterval(heartbeat);
    }

    if (!res.writableEnded && !res.destroyed) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err: any) {
    console.warn('Erreur API Chat Stream:', err?.message || err);
    sseWrite(res, { error: trimUpstreamError(err?.message || 'Erreur de flux') });
    if (!res.writableEnded && !res.destroyed) res.end();
  }
});

// Fallback Standard Non-Streaming Chat
router.post('/chat', async (req, res) => {
  let aiConfig: ResolvedAIConfig;
  try {
    aiConfig = resolveAIConfig(req);
  } catch (keyErr: any) {
    return res.status(401).json({
      error: 'API_KEY_REQUIRED',
      message: keyErr?.message || 'Clé API requise.',
    });
  }

  try {
    const { messages, context, mode, socraticEnabled = true, studentProfile, studentMemory } = req.body;
    const branch = normalizeBranchParam(req.body?.branch);
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Format invalide.' });
    }

    const { effectiveMessages, fullInstruction, matchedDocs, officialSource } = await prepareChatContext(
      req,
      aiConfig,
      messages,
      context,
      mode,
      socraticEnabled,
      branch,
      studentProfile,
      studentMemory
    );

    const { text, model } = await generateUnifiedCompletion(aiConfig, effectiveMessages, fullInstruction, false);

    const reply = text || "Désolé mon élève, peux-tu reformuler ta question, lah yerdi 3lik ?";
    return res.json({
      reply,
      sourceDocs: Boolean(matchedDocs),
      officialSource: officialSource?.isPdf ? officialSource : undefined,
      modelUsed: model,
    });
  } catch (err: any) {
    console.error('Erreur API Chat:', err);
    return sendAiRouteError(res, err, 'Erreur lors de la communication avec Si Driss.');
  }
});

// Exam Evaluation & Grading Endpoint
router.post('/evaluate', async (req, res) => {
  let aiConfig: ResolvedAIConfig;
  try {
    aiConfig = resolveAIConfig(req);
  } catch (keyErr: any) {
    return res.status(401).json({
      error: 'API_KEY_REQUIRED',
      message: keyErr?.message || 'Clé API requise pour évaluer la réponse.',
    });
  }

  try {
    const { exerciseTitle, questionText, studentAnswer } = req.body;
    const cleanAnswer = typeof studentAnswer === 'string' ? studentAnswer.trim() : '';
    if (!cleanAnswer) {
      return res.status(400).json({ error: 'Veuillez rédiger votre réponse avant de demander un audit.' });
    }
    const branch = normalizeBranchParam(req.body?.branch);
    const branchLabel = branch === 'SM' ? 'Sciences Mathématiques (SM)' : 'Sciences Physiques (PC)';

    const prompt = `
En tant que Si Driss, correcteur officiel de l'Examen National 2ème Bac ${branchLabel} (BIOF Maroc), évalue rigoureusement la réponse suivante d'un élève.

EXERCICE : ${String(exerciseTitle || `Exercice National 2ème Bac ${branch}`).slice(0, 300)}
QUESTION : ${String(questionText || 'Résolution du problème').slice(0, 2000)}
RÉPONSE RÉDIGÉE PAR L'ÉLÈVE (Filière ${branch}) :
${cleanAnswer}

Fournis une évaluation structurée au format JSON suivant :
{
  "score": 18,
  "maxScore": 20,
  "gradeWord": "Très Bien",
  "appreciation": "Commentaire paternel et encourageant (ex. Tbarkellah 3lik)",
  "criteria": [
    {"name": "Démarche et justifications (Référentiel/Forces/Lois)", "status": "ok" | "warning" | "error", "feedback": "..."},
    {"name": "Expression littérale", "status": "ok" | "warning" | "error", "feedback": "..."},
    {"name": "Application numérique & Chiffres significatifs", "status": "ok" | "warning" | "error", "feedback": "..."},
    {"name": "Unités SI obligatoires", "status": "ok" | "warning" | "error", "feedback": "..."}
  ],
  "nationalTips": "Le conseil clé attendu par le barème national ${branch}",
  "correctedDraft": "La rédaction modèle idéale attendue par le barème ministériel ${branch} avec LaTeX et flèches obligatoires sur tout vecteur/somme des forces ($\\sum \\vec{F}_{\\text{ext}} = m\\vec{a}_G$, $\\vec{P} + \\vec{R} = m\\vec{a}_G$, zéro \\mathbf{...}) avant projection"
}
`;

    const { text } = await generateUnifiedCompletion(
      aiConfig,
      [{ role: 'user', content: prompt }],
      getSiDrissBasePrompt(branch),
      true
    );

    let data;
    try {
      data = parseLlmJsonObject(text);
    } catch {
      // Règle « Zéro Invention » (H4 côté serveur) : jamais de note fabriquée si le
      // fournisseur renvoie un format illisible — on renvoie une erreur honnête.
      console.warn('Réponse IA non parsable en JSON (evaluate):', text.slice(0, 200));
      return res.status(502).json({
        error: 'FORMAT_INVALID',
        message: "Si Driss n'a pas pu produire une évaluation exploitable (réponse du fournisseur illisible). Aucune note n'a été attribuée — réessaie dans un instant.",
      });
    }

    return res.json(data);
  } catch (err: any) {
    console.error('Erreur API Evaluation:', err);
    return sendAiRouteError(res, err, "Erreur lors de l'évaluation.");
  }
});

// Custom Exercise Generator Endpoint
router.post('/generate-exercise', async (req, res) => {
  let aiConfig: ResolvedAIConfig;
  try {
    aiConfig = resolveAIConfig(req);
  } catch (keyErr: any) {
    return res.status(401).json({
      error: 'API_KEY_REQUIRED',
      message: keyErr?.message || 'Clé API requise pour générer un sujet.',
    });
  }

  try {
    const { subject, chapter, difficulty, topicStyle } = req.body;
    const branch = normalizeBranchParam(req.body?.branch);
    const branchLabel = branch === 'SM' ? 'Sciences Mathématiques (SM)' : 'Sciences Physiques (PC)';
    const safeSubject = String(subject || 'Physique').slice(0, 80);
    const safeChapter = String(
      chapter || (branch === 'SM' ? "Rotation d'un solide autour d'un axe fixe" : 'Ondes mécaniques progressives')
    ).slice(0, 150);
    const safeDifficulty = String(difficulty || 'Standard National').slice(0, 80);
    const safeTopicStyle = String(topicStyle || 'Problème avec données expérimentales et analyse graphique').slice(0, 150);

    const prompt = `
Génère un exercice inédit de type Examen National Marocain pour la 2ème Année Bac ${branchLabel} (BIOF).

Matière : ${safeSubject}
Chapitre : ${safeChapter}
Filière cible : 2ème Bac ${branch} (respecter strictement le Cadre de Référence officiel du Ministère pour ${branch})
Difficulté : ${safeDifficulty}
Style : ${safeTopicStyle}

L'exercice doit comporter :
- Un énoncé réaliste avec contexte expérimental adapté au niveau ${branch}.
- Données précises avec unités et constantes physiques officielles.
- 3 à 4 questions progressives et numérotées selon le standard du National.
- Une question piège classique de 2ème Bac ${branch}.
- Notation marocaine BIOF obligatoire : flèches $\\vec{...}$ sur toute somme des forces et grandeur vectorielle (jamais de notation anglo-saxonne $\\mathbf{F}$ ou $\\hat{i}$).

Réponds UNIQUEMENT au format JSON :
{
  "title": "Titre officiel",
  "domain": "Physique" | "Chimie",
  "chapter": "${safeChapter.replace(/"/g, "'")}",
  "duration": "30 min",
  "context": "Texte d'introduction...",
  "parameters": [
    {"symbol": "lambda", "name": "Grandeur", "value": "valeur"}
  ],
  "questions": [
    {
      "number": "1",
      "text": "Question 1...",
      "points": "1.0 pt",
      "hint": "Indice socratique",
      "keyFormula": "$...$"
    }
  ],
  "commonPitfall": "Le piège fréquent à éviter en 2ème Bac ${branch}",
  "professorNote": "Conseil de Si Driss"
}
`;

    const { text } = await generateUnifiedCompletion(
      aiConfig,
      [{ role: 'user', content: prompt }],
      getSiDrissBasePrompt(branch),
      true
    );

    let exercise;
    try {
      exercise = parseLlmJsonObject(text);
    } catch {
      console.warn('Réponse IA non parsable en JSON (generate-exercise):', text.slice(0, 200));
      return res.status(502).json({
        error: 'FORMAT_INVALID',
        message: "Génération impossible : le fournisseur IA a renvoyé un format illisible. Réessaie dans un instant.",
      });
    }
    return res.json(exercise);
  } catch (err: any) {
    console.error('Erreur API Generate Exercise:', err);
    return sendAiRouteError(res, err, "Erreur lors de la génération d'exercice.");
  }
});

  return router;
}
