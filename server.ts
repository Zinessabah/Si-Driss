import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { PDFParse } from 'pdf-parse';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));

// Helper to obtain student's GoogleGenAI instance from request headers or body
function getGenAIClient(req: express.Request): GoogleGenAI {
  const headerKey = (req.headers['x-gemini-api-key'] as string) || '';
  const bodyKey = (req.body?.apiKey as string) || '';
  const key = (headerKey || bodyKey).trim();

  if (!key) {
    const error: any = new Error('Clé API Gemini requise. Chaque élève doit renseigner sa propre clé gratuite Google AI Studio.');
    error.code = 'API_KEY_REQUIRED';
    error.statusCode = 401;
    throw error;
  }

  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: 12000, // 12s deadline
      retryOptions: { attempts: 1 }, // fail fast to fallback model rather than retrying for minutes
    },
  });
}

// Candidate models for ultra-fast response with zero-downtime failover
const FAST_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
];

// Fallback executor for streaming with student AI client
async function generateStreamWithModelFallback(ai: GoogleGenAI, contents: any, config: any) {
  let lastError: any = null;
  for (const model of FAST_MODELS) {
    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents,
        config,
      });
      return { stream, model };
    } catch (err: any) {
      console.warn(`[Stream] Model ${model} unavailable (${err?.status || err?.message}), falling over...`);
      lastError = err;
    }
  }
  throw lastError || new Error('Tous les modèles IA sont momentanément indisponibles.');
}

// Fallback executor for regular calls with student AI client
async function generateWithModelFallback(ai: GoogleGenAI, contents: any, config: any) {
  let lastError: any = null;
  for (const model of FAST_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      return { response, model };
    } catch (err: any) {
      console.warn(`[Generate] Model ${model} unavailable (${err?.status || err?.message}), falling over...`);
      lastError = err;
    }
  }
  throw lastError || new Error('Tous les modèles IA sont momentanément indisponibles.');
}

// Documents directory for 2nd Bac PC curriculum
const DOCS_DIR = path.resolve(__dirname, 'docs', 'programme');
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

// In-memory document cache to avoid repeated disk reads and regex splits on every request
interface CachedDocSection {
  raw: string;
  lower: string;
}

interface CachedDoc {
  name: string;
  mtime: number;
  sections: CachedDocSection[];
}

let documentsCache: CachedDoc[] = [];
let lastCacheRefreshTime = 0;

function refreshDocumentsCache() {
  const now = Date.now();
  if (now - lastCacheRefreshTime < 4000) return; // cache for 4s
  lastCacheRefreshTime = now;

  try {
    if (!fs.existsSync(DOCS_DIR)) return;
    const files = fs.readdirSync(DOCS_DIR).filter((f) => !f.endsWith('.extracted.txt'));

    const updatedCache: CachedDoc[] = [];

    for (const file of files) {
      const filePath = path.join(DOCS_DIR, file);
      const stat = fs.statSync(filePath);
      const existing = documentsCache.find((d) => d.name === file && d.mtime === stat.mtimeMs);

      if (existing) {
        updatedCache.push(existing);
        continue;
      }

      let content = '';
      if (file.toLowerCase().endsWith('.pdf')) {
        const txtPath = path.join(DOCS_DIR, `${file}.extracted.txt`);
        if (fs.existsSync(txtPath)) {
          content = fs.readFileSync(txtPath, 'utf-8');
        }
      } else if (file.endsWith('.md') || file.endsWith('.txt') || file.endsWith('.json')) {
        content = fs.readFileSync(filePath, 'utf-8');
      }

      if (content) {
        const rawSections = content.split(/\n#{1,3}\s+|\n\n+/).filter((s) => s.trim().length > 20);
        const sections: CachedDocSection[] = rawSections.map((s) => ({
          raw: s.trim().slice(0, 800),
          lower: s.toLowerCase(),
        }));
        updatedCache.push({ name: file, mtime: stat.mtimeMs, sections });
      }
    }
    documentsCache = updatedCache;
  } catch (err) {
    console.warn('Erreur rafraîchissement cache documents:', err);
  }
}

// Instant memory-based document search utility (< 1ms)
function searchLocalDocuments(query: string): string {
  try {
    refreshDocumentsCache();
    if (!documentsCache.length) return '';

    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (keywords.length === 0) return '';

    const matchedSnippets: { score: number; text: string }[] = [];

    for (const doc of documentsCache) {
      for (const sec of doc.sections) {
        let score = 0;
        for (const kw of keywords) {
          if (sec.lower.includes(kw)) {
            score++;
          }
        }
        if (score > 0) {
          matchedSnippets.push({
            score,
            text: `[Source officielle: ${doc.name}]\n${sec.raw}`,
          });
        }
      }
    }

    if (matchedSnippets.length > 0) {
      matchedSnippets.sort((a, b) => b.score - a.score);
      return matchedSnippets.slice(0, 3).map((s) => s.text).join('\n\n---\n\n');
    }
  } catch (err) {
    console.warn('Erreur recherche documents:', err);
  }
  return '';
}

function getSiDrissBasePrompt(branch: 'PC' | 'SM' = 'PC'): string {
  const branchName = branch === 'SM' ? 'Sciences Mathématiques (2ème Bac SM)' : 'Sciences Physiques (2ème Bac PC)';
  const syllabusSpecifics = branch === 'SM'
    ? `CADRE DE RÉFÉRENCE OFFICIEL SPÉCIFIQUE 2ÈME BAC SCIENCES MATHÉMATIQUES (SM) :
- SPÉCIFICITÉS DU PROGRAMME SM :
  * Rotation d'un solide indéformable autour d'un axe fixe : Relation fondamentale de la dynamique (RFD) $\\sum M_\\Delta(\\vec{F}) = J_\\Delta \\ddot{\\theta}$, moment d'inertie $J_\\Delta$, énergie cinétique $E_c = \\frac{1}{2}J_\\Delta \\dot{\\theta}^2$, condition de non-glissement de fils sur poulies ($a = R\\ddot{\\theta}$, $v = R\\dot{\\theta}$).
  * Oscillations mécaniques forcées en régime sinusoïdal : excitateur, résonateur, résonance d'amplitude et de vitesse, influence du frottement fluide.
  * Oscillations électriques forcées dans un circuit RLC série (GBF sinusoïdal) : impédance électrique $Z = \\sqrt{R_t^2 + (L\\omega - \\frac{1}{C\\omega})^2}$, déphasage $\\tan\\varphi = \\frac{L\\omega - \\frac{1}{C\\omega}}{R_t}$, facteur de qualité $Q = \\frac{L\\omega_0}{R_t}$, bande passante à $-3\\text{ dB}$ : $\\Delta N = \\frac{N_0}{Q} = \\frac{R_t}{2\\pi L}$, surtension aux bornes du condensateur ($U_{C,max} = Q\\cdot U$).
  * Rigueur mathématique accrue : équations différentielles d'ordre 2, résolution analytique détaillée, projections trigonométriques.
- EXCLUSIONS DU PROGRAMME SM :
  * La modulation d'amplitude (AM) N'EST PAS au programme des Sciences Mathématiques (elle est exclusive aux PC). Ne propose jamais la modulation AM à un élève SM.`
    : `CADRE DE RÉFÉRENCE OFFICIEL SPÉCIFIQUE 2ÈME BAC SCIENCES PHYSIQUES (PC) :
- SPÉCIFICITÉS DU PROGRAMME PC :
  * Modulation d'amplitude AM : taux de modulation $m = \\frac{S_m}{U_0}$, condition de bonne modulation ($m < 1$ et $F_p \\gg f_s$), méthode du trapèze et démodulation (détecteur d'enveloppe, filtre RC et filtre passe-haut).
  * Mécanique : translation et chute libre/verticale, projectiles, satellites, oscillateurs harmoniques amortis (RLC libre, pendule élastique).
- EXCLUSIONS DU PROGRAMME PC :
  * La rotation du solide autour d'un axe fixe (RFD avec $J_\\Delta \\ddot{\\theta}$) et les oscillations forcées (RLC régime sinusoïdal forcé avec impédance $Z$ et bande passante à -3 dB) NE SONT PAS au programme PC (réservées aux SM).`;

  return `Tu es Si Driss (ou "Prof Driss"), un professeur chevronné et respecté de Physique-Chimie au lycée au Maroc, spécialisé dans la préparation intensive des élèves de 2ème Année Baccalauréat (Option Français / BIOF).
BRANCHE DE L'ÉLÈVE ACTUELLEMENT SUIVIE : ${branchName}.

${syllabusSpecifics}

TON STYLE & PERSONNALITÉ :
- Réponse immédiate, rapide, concise et extrêmement claire.
- Rigoureux sur le plan scientifique, encourageant, pédagogue, paternel et bienveillant.
- Parfaitement aligné sur les exigences du Cadre de Référence officiel du Ministère de l'Éducation Nationale marocain pour l'Examen National (session normale et rattrapage).
- Tu utilises un français scientifique impeccable avec formules en LaTeX ($...$ ou $$...$$).
- Tu ponctues naturellement tes interventions avec des expressions d'encouragement ou d'accroche en Darija marocain quand c'est pertinent (ex. : "Tbarkellah 3lik", "Fhemti l'idée ?", "Rkkez m3aya f had l-étape", "Lah yerdi 3lik", "3andak had l-piège !").

RÈGLES DE CONDUITE :
1. RÈGLE D'OR EN MODE DIRECT OU POUR UNE DÉFINITION / FORMULE :
   Donne DIRECTEMENT et RAPIDEMENT la définition officielle sanctionnée au barème national ou la formule demandée avec ses unités SI obligatoires, sans tourner autour du pot.
2. RÈGLE EN MODE SOCRATIQUE (si activé pour un exercice) :
   Guide avec une question directrice précise pour débloquer l'élève sans donner la solution brute.
3. RÈGLE DES 4 PILIERS DU BARÈME :
   - Mécanique : Système étudié, Référentiel galiléen, Bilan des forces (ou moments pour SM en rotation).
   - Électricité : Convention récepteur et Loi d'additivité des tensions.
   - Chimie : Tableau d'avancement complet en moles.
   - Formule littérale d'abord, Unités SI, Chiffres significatifs.
`;
}

// Helper to build instruction
function getInstruction(mode: string, socraticEnabled: boolean, matchedDocs: string, branch: 'PC' | 'SM' = 'PC', context?: string) {
  let extra = '';
  if (!socraticEnabled || mode === 'direct') {
    extra = `\nMODE ACTIF : RÉPONSE DIRECTE & COURS (DÉMARCHE SOCRATIQUE DÉSACTIVÉE).
L'élève de 2ème Bac ${branch} souhaite une réponse immédiate, une définition officielle ou une formule du Cadre de Référence ${branch}.
RÈGLES EN MODE DIRECT :
1. Donne DIRECTEMENT et SANS DÉLAI la définition exacte officielle du Ministère marocain ou la formule demandée adaptée à la section ${branch}.
2. Précise chaque variable et son unité dans le Système International ($SI$).
3. Reste rapide, concis, chaleureux ("Tbarkellah 3lik") et sans questions intermédiaires.`;
  } else if (mode === 'socratic') {
    extra = `\nMODE ACTIF : COACHING SOCRATIQUE POUR ÉLÈVE 2ÈME BAC ${branch}.
L'élève résout un problème. Pose UNE question directrice ciblée pour le guider. Ne donne pas la réponse finale d'emblée.`;
  } else if (mode === 'review') {
    extra = `\nMODE ACTIF : AUDIT DE RÉDACTION TYPE NATIONAL 2ÈME BAC ${branch}. Analyse la réponse selon la grille officielle ${branch} : 1) Système/Référentiel/Forces, 2) Formule littérale, 3) Valeur & CS, 4) Unité SI. Attribue une note sur 20.`;
  } else if (mode === 'trap') {
    extra = `\nMODE ACTIF : CHASSE AUX PIÈGES DU NATIONAL 2ÈME BAC ${branch}. Pose un piège récurrent du National pour la section ${branch}.`;
  }

  let full = getSiDrissBasePrompt(branch) + extra;
  if (matchedDocs) {
    full += `\n\nEXTRAITS OFFICIELS EXTRAITS DES DOCUMENTS DU PROGRAMME DÉPOSÉS DANS /docs/programme/ :\n${matchedDocs}\nUtilise prioritairement ces extraits pour répondre le plus rapidement et fidèlement possible.`;
  }
  if (context) {
    full += `\n\nCONTEXTE ACTUEL :\n${context}`;
  }
  return full;
}

interface ClientAttachment {
  name?: string;
  type?: string;
  mimeType?: string;
  data?: string;
  text?: string;
}

interface ClientMessage {
  role: string;
  content: string;
  attachments?: ClientAttachment[];
}

function formatMessagesForGemini(messages: ClientMessage[]) {
  return messages.map((m) => {
    const parts: any[] = [];
    const textContent = (m.content || '').trim();

    if (m.attachments && Array.isArray(m.attachments) && m.attachments.length > 0) {
      let attachmentTextSummary = '';

      for (const att of m.attachments) {
        if (att.data && att.mimeType && (att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf')) {
          const rawBase64 = att.data.includes(',') ? att.data.split(',')[1] : att.data;
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: rawBase64,
            },
          });
        }

        if (att.text) {
          attachmentTextSummary += `\n\n--- [DOCUMENT / ÉNONCÉ D'EXERCICE JOINT: ${att.name || 'Document'}] ---\n${att.text}\n---------------------------------------------`;
        }
      }

      if (textContent || attachmentTextSummary) {
        parts.unshift({
          text: (textContent ? textContent : "Voici le document ou l'exercice que j'ai joint pour analyse.") + attachmentTextSummary,
        });
      }
    } else {
      parts.push({ text: textContent || 'Bonjour Si Driss' });
    }

    if (parts.length === 0) {
      parts.push({ text: 'Bonjour Si Driss' });
    }

    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });
}

// Endpoint to test / validate student's API key
app.post('/api/validate-key', async (req, res) => {
  try {
    const key = ((req.headers['x-gemini-api-key'] as string) || req.body?.apiKey || '').trim();
    if (!key) {
      return res.status(400).json({ valid: false, error: 'Veuillez saisir votre clé API Gemini.' });
    }

    const testAi = new GoogleGenAI({
      apiKey: key,
      httpOptions: { timeout: 8000, retryOptions: { attempts: 1 } },
    });

    const result = await testAi.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: 'Bonjour, réponds simplement "OK"' }] }],
    });

    if (result && result.text) {
      return res.json({ valid: true, message: 'Clé API valide et connectée avec succès ! Tbarkellah 3lik.' });
    }
    return res.status(400).json({ valid: false, error: 'Réponse inattendue de l\'API Gemini.' });
  } catch (err: any) {
    console.warn('[Validate Key] Error:', err);
    let errMsg = err?.message || 'Clé API invalide ou quota dépassé.';
    if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('400') || errMsg.includes('key not valid')) {
      errMsg = 'Clé API invalide. Vérifiez que vous avez bien copié l\'intégralité de la clé depuis Google AI Studio.';
    } else if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('403')) {
      errMsg = 'Permission refusée pour cette clé API. Assurez-vous d\'activer le modèle Gemini dans votre projet Google Cloud.';
    }
    return res.status(400).json({ valid: false, error: errMsg });
  }
});

// 1. Streaming chat endpoint (Server-Sent Events) for ultra-fast, instant token streaming
app.post('/api/chat/stream', async (req, res) => {
  let aiClient: GoogleGenAI;
  try {
    aiClient = getGenAIClient(req);
  } catch (keyErr: any) {
    return res.status(401).json({
      error: 'API_KEY_REQUIRED',
      message: 'Veuillez renseigner votre clé API Gemini personnelle (gratuite) pour discuter avec Si Driss.',
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
    const matchedDocs = searchLocalDocuments(searchTerms);

    const fullInstruction = getInstruction(mode, socraticEnabled, matchedDocs, branch, context);

    const contents = formatMessagesForGemini(messages);

    // Setup SSE headers with unbuffered options
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Immediate ping to establish connection with the client
    res.write(': ping\n\n');

    // Generate stream using model cascade fallback with student's key
    const { stream, model } = await generateStreamWithModelFallback(aiClient, contents, {
      systemInstruction: fullInstruction,
      temperature: 0.6,
    });

    console.log(`[Stream] Streaming response started using model: ${model} (Branch: ${branch})`);

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('Erreur API Chat Stream:', err);
    res.write(`data: ${JSON.stringify({ error: err?.message || 'Erreur stream' })}\n\n`);
    res.end();
  }
});

// 2. Standard fallback Chat endpoint
app.post('/api/chat', async (req, res) => {
  let aiClient: GoogleGenAI;
  try {
    aiClient = getGenAIClient(req);
  } catch (keyErr: any) {
    return res.status(401).json({
      error: 'API_KEY_REQUIRED',
      message: 'Veuillez renseigner votre clé API Gemini personnelle (gratuite) pour continuer.',
    });
  }

  try {
    const { messages, context, mode, socraticEnabled = true, branch = 'PC' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Format de message invalide.' });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    let searchTerms = lastUser?.content || '';
    if (lastUser?.attachments && Array.isArray(lastUser.attachments)) {
      for (const att of lastUser.attachments) {
        if (att.name) searchTerms += ' ' + att.name;
        if (att.text) searchTerms += ' ' + att.text.slice(0, 200);
      }
    }
    const matchedDocs = searchLocalDocuments(searchTerms);
    const fullInstruction = getInstruction(mode, socraticEnabled, matchedDocs, branch, context);

    const contents = formatMessagesForGemini(messages);

    const { response, model } = await generateWithModelFallback(aiClient, contents, {
      systemInstruction: fullInstruction,
      temperature: 0.6,
    });

    console.log(`[Chat] Response generated using model: ${model} (Branch: ${branch})`);
    const reply = response.text || "Désolé mon élève, peux-tu reformuler ta question, lah yerdi 3lik ?";
    return res.json({ reply, sourceDocs: matchedDocs ? true : false, modelUsed: model });
  } catch (err: any) {
    console.error('Erreur API Chat:', err);
    return res.status(500).json({
      error: 'Erreur lors de la communication avec Si Driss.',
      details: err?.message || String(err),
    });
  }
});

async function extractTextFromPdf(buf: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    await parser.destroy();
    return result.text || '';
  } catch (err) {
    console.warn('Erreur extraction PDF:', err);
    return '';
  }
}

// 3. Document Management API (/docs/programme/)
app.get('/api/documents', async (_req, res) => {
  try {
    if (!fs.existsSync(DOCS_DIR)) {
      return res.json({ directory: DOCS_DIR, files: [] });
    }

    const fileNames = fs.readdirSync(DOCS_DIR).filter((f) => !f.endsWith('.extracted.txt'));
    const files = await Promise.all(
      fileNames.map(async (name) => {
        const filePath = path.join(DOCS_DIR, name);
        const stat = fs.statSync(filePath);
        let preview = '';
        const isPdf = name.toLowerCase().endsWith('.pdf');

        if (isPdf) {
          const txtPath = path.join(DOCS_DIR, `${name}.extracted.txt`);
          if (fs.existsSync(txtPath)) {
            preview = fs.readFileSync(txtPath, 'utf-8').slice(0, 150).replace(/\n/g, ' ');
          } else {
            try {
              const buf = fs.readFileSync(filePath);
              const text = await extractTextFromPdf(buf);
              preview = text.slice(0, 150).replace(/\n/g, ' ');
              fs.writeFileSync(txtPath, text, 'utf-8');
            } catch {
              preview = 'Document PDF prêt à être indexé';
            }
          }
        } else {
          try {
            const text = fs.readFileSync(filePath, 'utf-8');
            preview = text.slice(0, 150).replace(/\n/g, ' ');
          } catch {
            preview = 'Document texte';
          }
        }

        return {
          name,
          size: stat.size,
          modified: stat.mtime,
          preview,
          isPdf,
        };
      })
    );

    return res.json({
      directory: '/docs/programme',
      absolutePath: DOCS_DIR,
      files,
    });
  } catch (err: any) {
    console.error('Erreur get documents:', err);
    return res.status(500).json({ error: 'Impossible de lire les documents.' });
  }
});

app.get('/api/documents/file', async (req, res) => {
  try {
    const name = String(req.query.name || '');
    if (!name) return res.status(400).json({ error: 'Nom requis.' });

    const safeName = path.basename(name);
    const filePath = path.join(DOCS_DIR, safeName);
    const isPdf = safeName.toLowerCase().endsWith('.pdf');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier non trouvé.' });
    }

    if (isPdf) {
      const txtPath = path.join(DOCS_DIR, `${safeName}.extracted.txt`);
      if (fs.existsSync(txtPath)) {
        const content = fs.readFileSync(txtPath, 'utf-8');
        return res.json({ name: safeName, content, isPdf: true });
      } else {
        const buf = fs.readFileSync(filePath);
        const content = await extractTextFromPdf(buf);
        fs.writeFileSync(txtPath, content, 'utf-8');
        return res.json({ name: safeName, content, isPdf: true });
      }
    } else {
      const content = fs.readFileSync(filePath, 'utf-8');
      return res.json({ name: safeName, content, isPdf: false });
    }
  } catch (err: any) {
    console.error('Erreur get document file:', err);
    return res.status(500).json({ error: 'Erreur lecture document.' });
  }
});

app.post('/api/documents/upload', async (req, res) => {
  try {
    const { filename, content, base64 } = req.body;
    if (!filename || (content === undefined && !base64)) {
      return res.status(400).json({ error: 'Nom de fichier et contenu (texte ou base64) requis.' });
    }

    // Sanitize filename
    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const filePath = path.join(DOCS_DIR, safeName);
    const isPdf = safeName.toLowerCase().endsWith('.pdf');

    if (base64) {
      const buf = Buffer.from(base64, 'base64');
      fs.writeFileSync(filePath, buf);

      if (isPdf) {
        try {
          const text = await extractTextFromPdf(buf);
          const txtPath = path.join(DOCS_DIR, `${safeName}.extracted.txt`);
          fs.writeFileSync(txtPath, text, 'utf-8');
        } catch (pdfErr) {
          console.warn('Extraction PDF échouée:', pdfErr);
        }
      }
    } else {
      fs.writeFileSync(filePath, content, 'utf-8');
    }

    return res.json({
      success: true,
      message: isPdf
        ? `Document PDF "${safeName}" téléchargé et texte extrait automatiquement pour l'indexation !`
        : `Document "${safeName}" indexé avec succès dans /docs/programme/`,
      file: { name: safeName },
    });
  } catch (err: any) {
    console.error('Erreur upload document:', err);
    return res.status(500).json({ error: 'Erreur lors de la sauvegarde du document.' });
  }
});

app.delete('/api/documents/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const safeName = path.basename(filename);
    const filePath = path.join(DOCS_DIR, safeName);
    const txtPath = path.join(DOCS_DIR, `${safeName}.extracted.txt`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      if (fs.existsSync(txtPath)) {
        fs.unlinkSync(txtPath);
      }
      return res.json({ success: true, message: `Fichier ${safeName} supprimé.` });
    }
    return res.status(404).json({ error: 'Fichier non trouvé.' });
  } catch (err: any) {
    console.error('Erreur suppression document:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
});

// National Exam Audit / Grading endpoint
app.post('/api/evaluate', async (req, res) => {
  let aiClient: GoogleGenAI;
  try {
    aiClient = getGenAIClient(req);
  } catch (keyErr: any) {
    return res.status(401).json({
      error: 'API_KEY_REQUIRED',
      message: 'Veuillez renseigner votre clé API Gemini personnelle (gratuite) pour évaluer votre réponse.',
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
  "gradeWord": "Très Bien / Mention Très Bien",
  "appreciation": "Commentaire encourageant du prof avec une touche marocaine (ex. Tbarkellah 3lik)",
  "criteria": [
    {"name": "Démarche et justifications (Référentiel/Forces/Lois)", "status": "ok" | "warning" | "error", "feedback": "..."},
    {"name": "Expression littérale", "status": "ok" | "warning" | "error", "feedback": "..."},
    {"name": "Application numérique & Chiffres significatifs", "status": "ok" | "warning" | "error", "feedback": "..."},
    {"name": "Unités SI obligatoires", "status": "ok" | "warning" | "error", "feedback": "..."}
  ],
  "nationalTips": "Le conseil clé que le correcteur national attend sur ce type de question pour la filière ${branch}",
  "correctedDraft": "La rédaction modèle idéale attendue par le barème ministériel ${branch} avec LaTeX"
}
`;

    const { response, model } = await generateWithModelFallback(aiClient, prompt, {
      systemInstruction: getSiDrissBasePrompt(branch),
      responseMimeType: 'application/json',
    });
    console.log(`[Evaluate] Evaluated using model: ${model} (Branch: ${branch})`);

    const raw = response.text || '{}';
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = {
        score: 15,
        maxScore: 20,
        gradeWord: "Bien",
        appreciation: "Bon travail d'ensemble, attention aux détails du barème !",
        criteria: [],
        nationalTips: "Toujours expliciter l'expression littérale avant l'application numérique.",
        correctedDraft: raw,
      };
    }

    return res.json(data);
  } catch (err: any) {
    console.error('Erreur API Evaluation:', err);
    return res.status(500).json({ error: 'Erreur lors de l\'évaluation.' });
  }
});

// Custom Exercise Generator endpoint
app.post('/api/generate-exercise', async (req, res) => {
  let aiClient: GoogleGenAI;
  try {
    aiClient = getGenAIClient(req);
  } catch (keyErr: any) {
    return res.status(401).json({
      error: 'API_KEY_REQUIRED',
      message: 'Veuillez renseigner votre clé API Gemini personnelle (gratuite) pour générer un sujet.',
    });
  }

  try {
    const { subject, chapter, difficulty, topicStyle, branch = 'PC' } = req.body;
    const branchLabel = branch === 'SM' ? 'Sciences Mathématiques (SM)' : 'Sciences Physiques (PC)';

    const prompt = `
Génère un exercice inédit de type Examen National Marocain pour la 2ème Année Bac ${branchLabel} (BIOF).

Matière : ${subject || 'Physique'}
Chapitre : ${chapter || (branch === 'SM' ? 'Rotation d\'un solide autour d\'un axe fixe' : 'Ondes mécaniques progressives')}
Filière cible : 2ème Bac ${branch} (respecter strictement le Cadre de Référence officiel du Ministère pour la filière ${branch})
Difficulté : ${difficulty || 'Standard National'}
Style : ${topicStyle || 'Problème avec données expérimentales et analyse graphique'}

L'exercice doit comporter :
- Un énoncé réaliste avec contexte expérimental adapté au niveau ${branch}.
- Données précises avec unités et constantes physiques officielles.
- 3 à 4 questions progressives et numérotées selon le standard du National.
- Une question piège classique de 2ème Bac ${branch}.

Réponds au format JSON suivant :
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

    const { response, model } = await generateWithModelFallback(aiClient, prompt, {
      systemInstruction: getSiDrissBasePrompt(branch),
      responseMimeType: 'application/json',
    });
    console.log(`[Generate Exercise] Generated using model: ${model} (Branch: ${branch})`);

    const raw = response.text || '{}';
    const exercise = JSON.parse(raw);
    return res.json(exercise);
  } catch (err: any) {
    console.error('Erreur API Generate Exercise:', err);
    return res.status(500).json({ error: 'Erreur lors de la génération d\'exercice.' });
  }
});

// Mount Vite or static server
async function startServer() {
  const http = await import('http');
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  httpServer.listen(PORT, () => {
    console.log(`Server Si Driss running on port ${PORT}`);
    console.log(`Documents directory ready: ${DOCS_DIR}`);
  });
}

startServer();
