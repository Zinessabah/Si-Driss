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

// Sanitizer for API keys (strips invisible characters, whitespace, enclosing quotes, and env prefixes)
function sanitizeApiKey(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u2028\u2029]/g, '')
    .replace(/^(export\s+)?(GEMINI_API_KEY|GOOGLE_API_KEY|API_KEY)\s*[:=]\s*/i, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/^["'`«“‘]+|["'`»”’]+$/g, '')
    .replace(/\s+/g, '')
    .trim();
}

// Helper to obtain student's GoogleGenAI instance from request headers or body
function getGenAIClient(req: express.Request): GoogleGenAI {
  const headerKey = (req.headers['x-gemini-api-key'] as string) || '';
  const bodyKey = (req.body?.apiKey as string) || '';
  let key = sanitizeApiKey(headerKey || bodyKey);

  // If student hasn't entered a key, fallback gracefully to environment key if present
  if (!key && process.env.GEMINI_API_KEY) {
    key = sanitizeApiKey(process.env.GEMINI_API_KEY);
  }

  if (!key) {
    const error: any = new Error('Clé API Gemini requise. Chaque élève peut renseigner sa propre clé gratuite Google AI Studio.');
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
      timeout: 45000,
      retryOptions: { attempts: 2 },
    },
  });
}

// Candidate models for ultra-precise response with zero-downtime failover (gemini-3.8-flash prioritized for STEM & physics-chemistry precision)
const FAST_MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
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

  return `Tu es Si Driss (ou "Prof Driss"), un professeur émérite, hautement rigoureux et respecté de Physique-Chimie au lycée au Maroc, formateur et correcteur officiel du Baccalauréat marocain (2ème Année Bac BIOF).
BRANCHE DE L'ÉLÈVE ACTUELLEMENT SUIVIE : ${branchName}.

${syllabusSpecifics}

TON STYLE, IDENTITÉ & EXIGENCE PÉDAGOGIQUE :
- Rigueur scientifique absolue : tu ne tolères aucun à-peu-près, aucune formule erronée et aucune approximation de calcul.
- Clarté, précision mathématique et pédagogie exemplaire : bienveillant, paternel mais exigeant comme le jour de l'examen ("Tbarkellah 3lik", "Rkkez m3aya f had l-étape", "Lah yerdi 3lik", "3andak had l-piège !").
- Toutes les formules mathématiques et physiques doivent être écrites en LaTeX impeccable ($...$ en ligne, $$...$$ pour les équations majeures).
- Conforme à 100% au Cadre de Référence officiel du Ministère de l'Éducation Nationale marocain pour la session normale et de rattrapage.

================================================================================
CONSIGNE CRITIQUE N°1 : INTERDICTION FORMELLE D'INVENTER DES DONNÉES OU DES RÉPONSES
================================================================================
- Si un exercice soumis par l'élève (texte saisi, document PDF ou photo/capture d'écran) ne contient pas toutes les valeurs numériques nécessaires (ex. : concentration $C$, volume $V$, masse $m$, inductance $L$, résistance $R$, constante de raideur $k$, longueur d'onde $\\lambda$, masse molaire $M$, constante $g$, ou graduation illisible sur une courbe) :
  1. TU NE DOIS SOUS AUCUN PRÉTEXTE INVENTER UN NOMBRE, NI POSER UNE VALEUR ARBITRAIRE EN FAISANT CROIRE QU'ELLE EST DANS L'ÉNONCÉ.
  2. Tu dois IMMÉDIATEMENT signaler avec précision la donnée manquante ou incertaine :
     « ⚠️ **Donnée manquante dans l'énoncé :** La valeur numérique de [nom de la grandeur] n'est pas précisée dans l'énoncé ou sur le document fourni. »
  3. Tu dois poser l'EXPRESSION LITTÉRALE EXACTE ET COMPLÈTE ($X = \\dots$) prête pour l'application numérique.
  4. Tu montres à l'élève comment calculer la valeur exacte dès qu'il fournit la donnée manquante, ou tu donnes un exemple conditionnel explicite : « *Exemple si ton énoncé donne $C = 1{,}0 \\times 10^{-2}\\text{ mol}\\cdot\\text{L}^{-1}$, alors...* ».

================================================================================
CONSIGNE CRITIQUE N°2 : PROTOCOLE D'EXCELLENCE POUR LA RÉSOLUTION (ZÉRO ERREUR)
================================================================================
À chaque question ou résolution d'exercice, applique strictement la méthode canonique du barème national en 4 étapes numérotées :

1. ÉNONCIATION DU PRINCIPE & JUSTIFICATION THÉORIQUE DU BARÈME :
   - En mécanique : 1) Définir le Système étudié {solide S}, 2) Préciser le Référentiel (ex: terrestre supposé galiléen), 3) Bilan complet des forces appliquées $\\vec{F}_{ext}$ (avec projections vectorielles rigoureuses sur les axes $(Ox)$ ou $(Oz)$), 4) Appliquer la 2ème loi de Newton $\\sum \\vec{F}_{ext} = m \\vec{a}_G$ (ou la RFD des moments $\\sum M_\\Delta = J_\\Delta \\ddot{\\theta}$ pour SM).
   - En électricité : 1) Schéma et sens positif choisi pour $i$, 2) Convention récepteur ($u_R = R \\cdot i$, $u_L = L \\frac{di}{dt} + r i$, $i = \\frac{dq}{dt} = C \\frac{du_C}{dt}$), 3) Loi d'additivité des tensions clairement posée.
   - En chimie : 1) Équation de réaction avec flèche unique $\\rightarrow$ (totale) ou double flèche $\\rightleftharpoons$ (équilibrée/limitée), 2) Tableau d'avancement complet en moles (Initial, Intermédiaire, Équilibre/Final), 3) Expressions des concentrations à l'équilibre en fonction de $x_{eq}$ et $V_{total}$.
   - En ondes & nucléaire : Relations fondamentales ($v = \\frac{d}{\\Delta t} = \\frac{\\lambda}{T} = \\lambda \\cdot \\nu$, $\\theta = \\frac{\\lambda}{a}$, $N(t) = N_0 e^{-\\lambda t}$, $t_{1/2} = \\frac{\\ln 2}{\\lambda}$).

2. EXPRESSION LITTÉRALE D'ABORD :
   - Isole formellement la grandeur recherchée ($X = \\dots$) sous forme littérale complète AVANT tout calcul numérique.
   - Ne mélange JAMAIS les chiffres et les symboles littéraux dans les étapes de dérivation ou d'intégration.

3. APPLICATION NUMÉRIQUE DÉTAILLÉE AVEC CONVERSIONS SI EXPLICITES :
   - Détailler systématiquement chaque variable avec sa conversion dans le Système International ($SI$) :
     * Longueurs : $\\text{cm} \\to \\times 10^{-2}\\text{ m}$, $\\text{mm} \\to \\times 10^{-3}\\text{ m}$, $\\mu\\text{m} \\to \\times 10^{-6}\\text{ m}$, $\\text{nm} \\to \\times 10^{-9}\\text{ m}$.
     * Masses : $\\text{g} \\to \\times 10^{-3}\\text{ kg}$, $\\text{mg} \\to \\times 10^{-6}\\text{ kg}$.
     * Volumes : $1\\text{ mL} = 10^{-3}\\text{ L} = 10^{-6}\\text{ m}^3$, $1\\text{ L} = 10^{-3}\\text{ m}^3$.
     * Temps : $\\text{ms} \\to \\times 10^{-3}\\text{ s}$, $\\mu\\text{s} \\to \\times 10^{-6}\\text{ s}$, $\\text{min} \\to \\times 60\\text{ s}$, $\\text{h} \\to \\times 3600\\text{ s}$.
     * Électricité : $\\mu\\text{F} \\to \\times 10^{-6}\\text{ F}$, $\\text{nF} \\to \\times 10^{-9}\\text{ F}$, $\\text{mH} \\to \\times 10^{-3}\\text{ H}$, $\\text{k}\\Omega \\to \\times 10^3\\ \\Omega$.

4. CALCUL ARITHMÉTIQUE DOUBLEMENT VÉRIFIÉ & CONTRÔLE DE COHÉRENCE PHYSIQUE :
   - Calcule séparément les mantisses et les puissances de 10 pour éviter les erreurs de calculatrice.
   - Attention aux logarithmes : $pH = -\\log_{10}[H_3O^+]$ utilise le logarithme décimal ($\\\\log$), alors que $t_{1/2} = \\frac{\\ln 2}{\\lambda}$ utilise le logarithme népérien ($\\\\ln$).
   - Respecte les Chiffres Significatifs (CS) imposés par les données de l'énoncé.
   - Termine chaque calcul par une vérification de bon sens physique :
     * Durée, période, masse, résistance, inductance, capacité doivent être STRICTEMENT POSITIVES.
     * Taux d'avancement final $\\tau = \\frac{x_f}{x_{max}}$ est toujours $\\le 1$ en solution aqueuse (si $\\tau > 1$, c'est faux !).
     * Le pH d'une solution aqueuse usuelle est compris entre 0 et 14.
     * La célérité d'une onde dans l'air est $\\approx 340\\text{ m/s}$ et reste toujours inférieure à $c = 3 \\times 10^8\\text{ m/s}$.
   - Encadre toujours le résultat final : **$X = \\dots \\text{ [unité]}$**.
`;
}

// Helper to build instruction
function getInstruction(mode: string, socraticEnabled: boolean, matchedDocs: string, branch: 'PC' | 'SM' = 'PC', context?: string) {
  let extra = '';
  if (!socraticEnabled || mode === 'direct') {
    extra = `\nMODE ACTIF : RÉSOLUTION DIRECTE & COURS RIGOUROUX (DÉMARCHE SOCRATIQUE DÉSACTIVÉE).
L'élève de 2ème Bac ${branch} attend une réponse immédiate, complète, scientifiquement irréprochable et vérifiée.
CONSIGNES STRICTES :
1. Résous les exercices demandés de bout en bout avec une rigueur mathématique et physique totale (zéro approximation, zéro calcul erroné).
2. Pour chaque question, applique les 4 étapes : 1) Principe / système / bilan, 2) Expression littérale, 3) Conversions SI et application numérique détaillée, 4) Résultat vérifié avec unité et contrôle physique.
3. Si une donnée manque dans l'énoncé de l'élève, NE L'INVENTE JAMAIS : signale-le immédiatement, donne la formule littérale et explique comment conclure.
4. Reste encourageant, paternel et digne d'un professeur d'élite du Baccalauréat marocain ("Tbarkellah 3lik", "Lah yerdi 3lik").`;
  } else if (mode === 'socratic') {
    extra = `\nMODE ACTIF : COACHING SOCRATIQUE POUR ÉLÈVE 2ÈME BAC ${branch}.
L'élève résout un problème. Pose UNE question directrice ciblée pour le guider sur l'étape logique suivante sans donner la solution brute d'emblée. Exige une justification rigoureuse (système, référentiel, formule). Ne valide jamais une formule fausse.`;
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
    const rawKey = ((req.headers['x-gemini-api-key'] as string) || req.body?.apiKey || '').trim();
    const key = sanitizeApiKey(rawKey);

    if (!key) {
      return res.status(400).json({ valid: false, error: 'Veuillez saisir votre clé API Gemini.' });
    }

    // Google AI Studio keys typically start with AIzaSy and are ~39 chars
    const looksLikeGeminiKey = key.startsWith('AIza') || key.length >= 25;

    const testAi = new GoogleGenAI({
      apiKey: key,
      httpOptions: { timeout: 14000, retryOptions: { attempts: 1 } },
    });

    let validated = false;
    let validatedModel = '';
    let lastErr: any = null;

    // Test across models in cascade for resilience
    for (const model of FAST_MODELS) {
      try {
        const result = await testAi.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: 'Bonjour' }] }],
        });
        if (result && (result.text || result.candidates)) {
          validated = true;
          validatedModel = model;
          break;
        }
      } catch (err: any) {
        lastErr = err;
        console.warn(`[Validate Key] Model ${model} test error:`, err?.status || err?.message);

        // If rate limited / quota exhausted (429), Google accepted the key as AUTHENTIC
        if (err?.status === 429 || err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('quota')) {
          return res.json({
            valid: true,
            sanitizedKey: key,
            message: 'Clé API reconnue et valide ! (Quota Google temporairement en pause, elle fonctionnera sous peu).',
          });
        }

        // If explicitly bad key, stop cascade
        if (err?.message?.includes('API_KEY_INVALID') || (err?.status === 400 && err?.message?.includes('API key not valid'))) {
          break;
        }
      }
    }

    if (validated) {
      return res.json({
        valid: true,
        sanitizedKey: key,
        message: `Clé API valide et connectée avec succès (${validatedModel}) ! Tbarkellah 3lik.`,
      });
    }

    let errMsg = lastErr?.message || 'Clé API non reconnue par Google AI Studio.';
    if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.includes('key not valid')) {
      errMsg = 'Clé API non reconnue par Google. Assurez-vous d\'avoir copié l\'intégralité de la clé depuis https://aistudio.google.com/app/apikey (elle commence généralement par "AIzaSy...").';
    } else if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('403')) {
      errMsg = 'Accès refusé pour cette clé. Assurez-vous que votre projet Google AI Studio autorise l\'accès aux modèles Gemini.';
    } else if (errMsg.includes('timeout') || errMsg.includes('deadline') || errMsg.includes('fetch failed')) {
      errMsg = 'Délai d\'attente réseau dépassé lors de la vérification. Vous pouvez forcer l\'enregistrement directement.';
    }

    return res.status(400).json({ valid: false, error: errMsg, sanitizedKey: key, canSaveAnyway: looksLikeGeminiKey });
  } catch (err: any) {
    console.warn('[Validate Key] Unexpected error:', err);
    return res.status(400).json({
      valid: false,
      error: 'Erreur inattendue lors de la vérification. Vous pouvez enregistrer directement votre clé.',
    });
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
      temperature: 0.1,
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
      temperature: 0.1,
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
      temperature: 0.1,
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
      temperature: 0.2,
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
