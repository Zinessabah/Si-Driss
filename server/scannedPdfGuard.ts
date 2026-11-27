import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { DOCS_DIR } from './config';
import {
  DEFAULT_BASE_URLS,
  DEFAULT_MODELS,
  sanitizeApiKey,
  type ResolvedAIConfig,
  type SupportedProvider,
} from './ai/providers';
import { generateUnifiedCompletion } from './ai/completion';
import {
  discoverProgrammeFiles,
  hasReadablePdfText,
  isExtractedTextFresh,
  renderPdfPagesAsPngAttachments,
  resolveOfficialPdfPath,
  transcribeScannedOfficialPdf,
  upsertCachedDoc,
  type DiscoveredFile,
} from './rag';
import {
  SCANNED_PDF_OCR_PROMPT,
  SCIENTIFIC_VISION_MARKER,
  extractOcrFromPdfBuffer,
  isLikelyGeminiKey,
  type VisionExtractionOutcome,
} from './visionExtractor';

export const VISION_CAPABLE_PROVIDERS = new Set<SupportedProvider>([
  'gemini',
  'nvidia',
  'openai',
  'anthropic',
  'openrouter',
]);

const OPENROUTER_VISION_FALLBACK_MODEL = 'google/gemma-4-31b-it:free';
const DEFAULT_OPENROUTER_VISION_MODEL = 'nvidia/nemotron-3.5-super-vl:free';
const DEFAULT_CHUNK_SIZE = 3;
const MAX_UPLOAD_BUFFER_OCR_PAGES = 9;

const inflightOfficialConversions = new Map<string, Promise<boolean>>();

export function isVisionCapableProvider(provider: SupportedProvider): boolean {
  return VISION_CAPABLE_PROVIDERS.has(provider);
}

/**
 * Détermine si un modèle donné accepte directement les images multimodales
 * (évite d'envoyer des PNG bruts à un modèle purement textuel sur NVIDIA/OpenRouter).
 */
export function isVisionCapableModel(provider: SupportedProvider, model?: string): boolean {
  const m = String(model || '').trim();
  switch (provider) {
    case 'gemini':
    case 'anthropic':
      return true;
    case 'openai':
      return !/text-embedding|tts|whisper|dall-e|gpt-3\.5/i.test(m);
    case 'nvidia':
      return /(?:^|\/|-)(?:vl|vision)(?:-|:|$)|kimi-k3\.1/i.test(m);
    case 'openrouter':
      return /(?:^|\/|-)(?:vl|vision)(?:-|:|$)|gemma-4|gemini|gpt-4o|gpt-4\.1|gpt-5|claude-3|claude-4/i.test(m);
    default:
      return false;
  }
}

function selectOcrModelForProvider(provider: SupportedProvider, activeModel?: string): string {
  switch (provider) {
    case 'gemini':
      return 'gemini-3.8-flash';
    case 'nvidia':
      return isVisionCapableModel('nvidia', activeModel)
        ? String(activeModel)
        : process.env.NVIDIA_VISION_MODEL || DEFAULT_MODELS.nvidia || 'nvidia/nemotron-3.5-super-vl-120b-a12b';
    case 'openrouter':
      return isVisionCapableModel('openrouter', activeModel)
        ? String(activeModel)
        : process.env.OPENROUTER_VISION_MODEL || DEFAULT_OPENROUTER_VISION_MODEL;
    case 'openai':
      return isVisionCapableModel('openai', activeModel) && activeModel
        ? activeModel
        : process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
    case 'anthropic':
      return activeModel || process.env.ANTHROPIC_VISION_MODEL || 'claude-3-7-sonnet-20250219';
    default:
      return '';
  }
}

/**
 * Résout une configuration Vision utilisable pour convertir un PDF scanné en texte + schémas :
 * 1) Utilise d'abord le fournisseur/clé actif de la session s'il supporte la Vision
 *    (en basculant temporairement sur le modèle VLM du fournisseur si l'élève discute avec un modèle texte).
 * 2) Sinon, bascule de manière transparente sur une clé Vision configurée dans l'environnement serveur.
 */
export function resolveVisionOcrConfig(
  aiConfig?: Partial<ResolvedAIConfig>,
  options: { allowServerFallback?: boolean } = {}
): ResolvedAIConfig | null {
  const allowServerFallback = options.allowServerFallback !== false;

  if (aiConfig?.provider && aiConfig.apiKey && isVisionCapableProvider(aiConfig.provider)) {
    const cleanKey = sanitizeApiKey(aiConfig.apiKey);
    if (cleanKey && (aiConfig.provider !== 'gemini' || isLikelyGeminiKey(cleanKey))) {
      const model = selectOcrModelForProvider(aiConfig.provider, aiConfig.model);
      return {
        provider: aiConfig.provider,
        apiKey: cleanKey,
        model,
        baseUrl: aiConfig.baseUrl || DEFAULT_BASE_URLS[aiConfig.provider] || '',
        clientProvidedKey: Boolean(aiConfig.clientProvidedKey),
      };
    }
  }

  if (!allowServerFallback) {
    return null;
  }

  const geminiKey = sanitizeApiKey(process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '');
  if (isLikelyGeminiKey(geminiKey)) {
    return {
      provider: 'gemini',
      apiKey: geminiKey,
      model: 'gemini-3.8-flash',
      baseUrl: '',
      clientProvidedKey: false,
    };
  }

  const nvidiaKey = sanitizeApiKey(process.env.NVIDIA_API_KEY || '');
  if (nvidiaKey) {
    return {
      provider: 'nvidia',
      apiKey: nvidiaKey,
      model: process.env.NVIDIA_VISION_MODEL || DEFAULT_MODELS.nvidia || 'nvidia/nemotron-3.5-super-vl-120b-a12b',
      baseUrl: DEFAULT_BASE_URLS.nvidia || 'https://integrate.api.nvidia.com/v1',
      clientProvidedKey: false,
    };
  }

  const openaiKey = sanitizeApiKey(process.env.OPENAI_API_KEY || '');
  if (openaiKey) {
    return {
      provider: 'openai',
      apiKey: openaiKey,
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
      baseUrl: DEFAULT_BASE_URLS.openai || 'https://api.openai.com/v1',
      clientProvidedKey: false,
    };
  }

  const anthropicKey = sanitizeApiKey(process.env.ANTHROPIC_API_KEY || '');
  if (anthropicKey) {
    return {
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: process.env.ANTHROPIC_VISION_MODEL || 'claude-3-7-sonnet-20250219',
      baseUrl: DEFAULT_BASE_URLS.anthropic || 'https://api.anthropic.com/v1',
      clientProvidedKey: false,
    };
  }

  const openrouterKey = sanitizeApiKey(process.env.OPENROUTER_API_KEY || '');
  if (openrouterKey) {
    return {
      provider: 'openrouter',
      apiKey: openrouterKey,
      model: process.env.OPENROUTER_VISION_MODEL || DEFAULT_OPENROUTER_VISION_MODEL,
      baseUrl: DEFAULT_BASE_URLS.openrouter || 'https://openrouter.ai/api/v1',
      clientProvidedKey: false,
    };
  }

  return null;
}

async function getPdfPageCount(pdfSource: string | Buffer): Promise<number> {
  let parser: PDFParse | null = null;
  try {
    const data = typeof pdfSource === 'string' ? fs.readFileSync(pdfSource) : pdfSource;
    parser = new PDFParse({ data });
    const info = await parser.getInfo();
    return Math.max(1, Number(info?.total || 1));
  } catch {
    return 6;
  } finally {
    if (parser) {
      await parser.destroy().catch(() => {});
    }
  }
}

function buildFinalScannedContent(rawOcrText: string): string {
  const clean = rawOcrText.trim();
  return clean.includes(SCIENTIFIC_VISION_MARKER)
    ? `${clean}\n`
    : `${clean}\n\n================================================================================\n${SCIENTIFIC_VISION_MARKER}\n================================================================================\n`;
}

function classifyVisionError(err: any): VisionExtractionOutcome {
  const msg = String(err?.message || err || '');
  const upper = msg.toUpperCase();
  if (/\b(401|403)\b/.test(msg) || upper.includes('INVALID_KEY') || upper.includes('UNAUTHORIZED')) {
    return { text: '', status: 'invalid_key', errorMessage: msg.slice(0, 220) };
  }
  if (/\b429\b/.test(msg) || upper.includes('RATE LIMIT') || upper.includes('QUOTA') || upper.includes('TOO MANY')) {
    return { text: '', status: 'rate_limited', retryAfterMs: 15_000, errorMessage: msg.slice(0, 220) };
  }
  if (/\b(500|502|503|504)\b/.test(msg) || /timeout|aborted|econnreset|fetch failed/i.test(msg)) {
    return { text: '', status: 'transient_error', errorMessage: msg.slice(0, 220) };
  }
  return { text: '', status: 'skipped', errorMessage: msg.slice(0, 220) };
}

/**
 * Transcrit un PDF scanné en texte + schémas via rendu PNG par lots de pages
 * avec n'importe quel fournisseur multimodal (NVIDIA NIM, OpenRouter, OpenAI, Anthropic).
 */
export async function extractScannedPdfViaVisionImages(
  pdfSource: string | Buffer,
  fileName: string,
  cfg: ResolvedAIConfig,
  options: { maxPages?: number; chunkSize?: number } = {}
): Promise<VisionExtractionOutcome> {
  const detectedPages = await getPdfPageCount(pdfSource);
  const totalPages = options.maxPages ? Math.min(detectedPages, options.maxPages) : detectedPages;
  const chunkSize = Math.max(1, options.chunkSize || DEFAULT_CHUNK_SIZE);

  const pageChunks: number[][] = [];
  for (let start = 1; start <= totalPages; start += chunkSize) {
    const chunk: number[] = [];
    for (let p = start; p < start + chunkSize && p <= totalPages; p++) {
      chunk.push(p);
    }
    pageChunks.push(chunk);
  }

  const candidateModels =
    cfg.provider === 'openrouter' && cfg.model !== OPENROUTER_VISION_FALLBACK_MODEL
      ? [cfg.model, OPENROUTER_VISION_FALLBACK_MODEL]
      : [cfg.model];

  let lastOutcome: VisionExtractionOutcome = {
    text: '',
    status: 'skipped',
    errorMessage: 'Aucune page PNG exploitable générée.',
  };

  for (const model of candidateModels) {
    const attemptCfg: ResolvedAIConfig = { ...cfg, model };
    const transcribedParts: string[] = [];
    let abortedOutcome: VisionExtractionOutcome | null = null;

    for (const pages of pageChunks) {
      const pngs = await renderPdfPagesAsPngAttachments(pdfSource, pages, pages.length);
      if (pngs.length === 0) continue;

      const batchPrompt =
        `${SCANNED_PDF_OCR_PROMPT}\n\n` +
        `IMPORTANT : Tu reçois ici les pages ${pages.join(', ')} sur ${totalPages} du document "${fileName}". ` +
        `Utilise exactement les marqueurs \`-- ${pages[0]} of ${totalPages} --\` (jusqu'à \`-- ${pages[pages.length - 1]} of ${totalPages} --\`).`;

      try {
        const { text } = await generateUnifiedCompletion(
          attemptCfg,
          [{ role: 'user', content: batchPrompt, attachments: pngs }],
          'Tu es un moteur OCR scientifique 2BAC BIOF extrêmement fidèle et rigoureux.',
          false
        );
        if (text?.trim()) {
          transcribedParts.push(text.trim());
        }
      } catch (err: any) {
        abortedOutcome = classifyVisionError(err);
        if (abortedOutcome.status === 'invalid_key') {
          return abortedOutcome;
        }
        break;
      }
    }

    if (abortedOutcome) {
      lastOutcome = abortedOutcome;
      continue;
    }

    const combined = transcribedParts.join('\n\n').trim();
    if (hasReadablePdfText(combined)) {
      return { text: buildFinalScannedContent(combined), status: 'ok' };
    }

    lastOutcome = {
      text: '',
      status: 'skipped',
      errorMessage: 'La transcription retournée était vide ou insuffisante.',
    };
  }

  return lastOutcome;
}

/**
 * Point d'entrée unifié : convertit un PDF scanné (sur disque) avec le moteur Vision résolu.
 */
export async function extractScannedOfficialWithConfig(
  absPath: string,
  fileName: string,
  cfg: ResolvedAIConfig
): Promise<VisionExtractionOutcome> {
  if (cfg.provider === 'gemini' && isLikelyGeminiKey(cfg.apiKey)) {
    const { extractScannedPdfFullContent } = await import('./visionExtractor');
    const outcome = await extractScannedPdfFullContent(absPath, cfg.apiKey, 50_000);
    if (outcome.status === 'ok' && hasReadablePdfText(outcome.text)) {
      return { ...outcome, text: buildFinalScannedContent(outcome.text) };
    }
    return outcome;
  }

  return extractScannedPdfViaVisionImages(absPath, fileName, cfg);
}

/**
 * Garde-fou à la demande : si un document officiel est un PDF scanné sans texte lisible,
 * l'application le convertit automatiquement une fois via le moteur Vision disponible,
 * sauvegarde le cache `.extracted.txt` et met à jour l'index RAG pour tous les modèles (même texte).
 */
export async function ensureScannedPdfConverted(
  relativePath: string,
  aiConfig?: Partial<ResolvedAIConfig>,
  options: { allowServerFallback?: boolean } = {}
): Promise<boolean> {
  if (!relativePath) return false;

  const absPath = resolveOfficialPdfPath(relativePath);
  if (!absPath) return false;
  const txtPath = `${absPath}.extracted.txt`;

  if (fs.existsSync(txtPath) && isExtractedTextFresh(absPath, txtPath)) {
    const cachedTxt = fs.readFileSync(txtPath, 'utf-8');
    if (hasReadablePdfText(cachedTxt)) return true;
  }

  const visionCfg = resolveVisionOcrConfig(aiConfig, options);
  if (!visionCfg) return false;

  if (visionCfg.provider === 'gemini') {
    return transcribeScannedOfficialPdf(relativePath, visionCfg.apiKey);
  }

  const existing = inflightOfficialConversions.get(relativePath);
  if (existing) return existing;

  const job = (async () => {
    try {
      const fileName = path.basename(absPath);
      console.log(`[ScanGuard] Conversion automatique de "${relativePath}" via ${visionCfg.provider.toUpperCase()} (${visionCfg.model})...`);
      const outcome = await extractScannedPdfViaVisionImages(absPath, fileName, visionCfg);
      if (outcome.status !== 'ok' || !hasReadablePdfText(outcome.text)) {
        console.warn(`[ScanGuard] Conversion échouée pour "${relativePath}" (${outcome.status}): ${outcome.errorMessage || 'vide'}`);
        return false;
      }

      try {
        fs.writeFileSync(txtPath, outcome.text, 'utf-8');
      } catch (writeErr) {
        console.warn('[ScanGuard] Impossible de sauvegarder le cache .extracted.txt:', writeErr);
      }

      const discovered = discoverProgrammeFiles(DOCS_DIR).find(
        (f) => f.relativePath === relativePath || f.absolutePath === absPath
      );
      if (discovered) {
        upsertCachedDoc(discovered, outcome.text);
      }

      console.log(`[ScanGuard] "${relativePath}" converti et mis en cache RAG avec succès.`);
      return true;
    } finally {
      inflightOfficialConversions.delete(relativePath);
    }
  })();

  inflightOfficialConversions.set(relativePath, job);
  return job;
}

/**
 * Garde-fou pour les pièces jointes PDF envoyées directement dans le chat par l'élève :
 * tente une conversion OCR via Gemini natif ou VLM (NVIDIA, OpenRouter, OpenAI, Anthropic)
 * afin que même les modèles purement textuels lisent le PDF scanné.
 */
export async function convertScannedPdfBufferWithGuard(
  pdfBuffer: Buffer,
  fileName: string,
  aiConfig?: Partial<ResolvedAIConfig>
): Promise<string | null> {
  const visionCfg = resolveVisionOcrConfig(aiConfig, { allowServerFallback: true });
  if (!visionCfg) return null;

  if (visionCfg.provider === 'gemini') {
    const ocr = await extractOcrFromPdfBuffer(pdfBuffer, fileName, visionCfg.apiKey, 45_000);
    if (ocr.status === 'ok' && hasReadablePdfText(ocr.text)) {
      return ocr.text;
    }
    return null;
  }

  const outcome = await extractScannedPdfViaVisionImages(pdfBuffer, fileName, visionCfg, {
    maxPages: MAX_UPLOAD_BUFFER_OCR_PAGES,
  });
  if (outcome.status === 'ok' && hasReadablePdfText(outcome.text)) {
    return outcome.text;
  }
  return null;
}

/**
 * Liste tous les PDF officiels du programme qui sont encore à l'état de scan sans texte lisible.
 */
export function findPendingScannedPdfs(onlyCategory?: DiscoveredFile['category']): DiscoveredFile[] {
  const allFiles = discoverProgrammeFiles(DOCS_DIR);
  return allFiles.filter((f) => {
    if (!f.name.toLowerCase().endsWith('.pdf')) return false;
    if (onlyCategory && f.category !== onlyCategory) return false;
    const txtPath = `${f.absolutePath}.extracted.txt`;
    if (!fs.existsSync(txtPath)) return true;
    const raw = fs.readFileSync(txtPath, 'utf-8');
    return !hasReadablePdfText(raw);
  });
}

/**
 * Prépare les paramètres Vision pour `startBackgroundOfficialSync` à partir d'une config
 * client ou serveur (Gemini natif ou VLM multi-fournisseurs).
 */
export function buildSyncVisionOptions(
  aiConfig?: Partial<ResolvedAIConfig>,
  options: { allowServerFallback?: boolean } = {}
): {
  visionApiKey: string;
  customScannedOcr?: (absPath: string, fileName: string) => Promise<VisionExtractionOutcome>;
  visionProviderLabel?: string;
} {
  const visionCfg = resolveVisionOcrConfig(aiConfig, options);
  if (!visionCfg) {
    return { visionApiKey: '' };
  }

  if (visionCfg.provider === 'gemini') {
    return {
      visionApiKey: visionCfg.apiKey,
      visionProviderLabel: `GEMINI (${visionCfg.model})`,
    };
  }

  return {
    visionApiKey: '',
    visionProviderLabel: `${visionCfg.provider.toUpperCase()} (${visionCfg.model})`,
    customScannedOcr: (absPath: string, fileName: string) =>
      extractScannedPdfViaVisionImages(absPath, fileName, visionCfg),
  };
}

