import { Router } from 'express';
import { validateKeyLimiter } from '../security';
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
import { searchLocalDocuments } from '../rag';
import { getSiDrissBasePrompt, getInstruction } from '../prompts';
import type { ClientMessage } from '../ai/adapters';

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
    const { messages, context, mode, socraticEnabled = true, branch = 'PC' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Format invalide.' });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    let searchTerms = lastUser?.content || '';
    if (lastUser?.attachments && Array.isArray(lastUser.attachments)) {
      for (const att of lastUser.attachments) {
        if (att.name) searchTerms += ' ' + att.name;
        if (att.text) searchTerms += ' ' + att.text.slice(0, 200);
      }
    }
    const matchedDocs = await searchLocalDocuments(searchTerms);
    const fullInstruction = getInstruction(mode, socraticEnabled, matchedDocs, branch, context);

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(': ping\n\n');

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
      await streamUnifiedChat(aiConfig, messages, fullInstruction, res, disconnectController.signal);
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
    const { messages, context, mode, socraticEnabled = true, branch = 'PC' } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Format invalide.' });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    let searchTerms = lastUser?.content || '';
    if (lastUser?.attachments && Array.isArray(lastUser.attachments)) {
      for (const att of lastUser.attachments) {
        if (att.name) searchTerms += ' ' + att.name;
        if (att.text) searchTerms += ' ' + att.text.slice(0, 200);
      }
    }
    const matchedDocs = await searchLocalDocuments(searchTerms);
    const fullInstruction = getInstruction(mode, socraticEnabled, matchedDocs, branch, context);

    const { text, model } = await generateUnifiedCompletion(aiConfig, messages, fullInstruction, false);

    const reply = text || "Désolé mon élève, peux-tu reformuler ta question, lah yerdi 3lik ?";
    return res.json({ reply, sourceDocs: Boolean(matchedDocs), modelUsed: model });
  } catch (err: any) {
    console.error('Erreur API Chat:', err);
    return res.status(500).json({
      error: 'Erreur lors de la communication avec Si Driss.',
      details: trimUpstreamError(err?.message || String(err)),
    });
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
    const { exerciseTitle, questionText, studentAnswer, branch = 'PC' } = req.body;
    const branchLabel = branch === 'SM' ? 'Sciences Mathématiques (SM)' : 'Sciences Physiques (PC)';

    const prompt = `
En tant que Si Driss, correcteur officiel de l'Examen National 2ème Bac ${branchLabel} (BIOF Maroc), évalue rigoureusement la réponse suivante d'un élève.

EXERCICE : ${exerciseTitle || `Exercice National 2ème Bac ${branch}`}
QUESTION : ${questionText || 'Résolution du problème'}
RÉPONSE RÉDIGÉE PAR L'ÉLÈVE (Filière ${branch}) :
${studentAnswer}

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
  "correctedDraft": "La rédaction modèle idéale attendue par le barème ministériel ${branch} avec LaTeX"
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
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      data = JSON.parse(cleanJson);
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
    return res.status(500).json({ error: "Erreur lors de l'évaluation." });
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
    const { subject, chapter, difficulty, topicStyle, branch = 'PC' } = req.body;
    const branchLabel = branch === 'SM' ? 'Sciences Mathématiques (SM)' : 'Sciences Physiques (PC)';

    const prompt = `
Génère un exercice inédit de type Examen National Marocain pour la 2ème Année Bac ${branchLabel} (BIOF).

Matière : ${subject || 'Physique'}
Chapitre : ${chapter || (branch === 'SM' ? "Rotation d'un solide autour d'un axe fixe" : 'Ondes mécaniques progressives')}
Filière cible : 2ème Bac ${branch} (respecter strictement le Cadre de Référence officiel du Ministère pour ${branch})
Difficulté : ${difficulty || 'Standard National'}
Style : ${topicStyle || 'Problème avec données expérimentales et analyse graphique'}

L'exercice doit comporter :
- Un énoncé réaliste avec contexte expérimental adapté au niveau ${branch}.
- Données précises avec unités et constantes physiques officielles.
- 3 à 4 questions progressives et numérotées selon le standard du National.
- Une question piège classique de 2ème Bac ${branch}.

Réponds UNIQUEMENT au format JSON :
{
  "title": "Titre officiel",
  "domain": "Physique" | "Chimie",
  "chapter": "${chapter || 'Chapitre'}",
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

    const cleanJson = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    let exercise;
    try {
      exercise = JSON.parse(cleanJson);
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
    return res.status(500).json({ error: "Erreur lors de la génération d'exercice." });
  }
});

  return router;
}
