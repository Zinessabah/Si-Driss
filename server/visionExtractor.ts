import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { GEMINI_FAST_MODELS } from './ai/providers';

export const SCIENTIFIC_VISION_MARKER = '=== TRANSCRIPTION VISUELLE DES SCHÉMAS & GRAPHES (IA Si Driss) ===';

/** Capacité max brute pour rester sous la limite ~20 Mo d'inlineData JSON base64 de Gemini. */
const MAX_INLINE_PDF_BYTES = 14 * 1024 * 1024;
const VISION_REQUEST_TIMEOUT_MS = 45_000;

export interface VisionExtractionOutcome {
  text: string;
  status: 'ok' | 'skipped' | 'rate_limited' | 'transient_error' | 'invalid_key';
  retryAfterMs?: number;
  errorMessage?: string;
}

/**
 * Vérifie rapidement si une clé API correspond au format attendu pour Google Gemini (AIza...).
 * Évite d'envoyer des clés Groq (gsk_), OpenAI (sk-proj-), Anthropic (sk-ant-), etc. vers Gemini Vision.
 */
export function isLikelyGeminiKey(apiKey?: string): boolean {
  const clean = String(apiKey || '').trim();
  if (!clean) return false;
  if (/^(gsk_|sk-ant-|sk-or-|sk-proj-|xai-)/i.test(clean)) return false;
  return clean.startsWith('AIza') || clean.length >= 30;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractHttpStatus(err: any): number {
  const direct = Number(err?.status ?? err?.statusCode ?? err?.code ?? 0);
  if (Number.isFinite(direct) && direct >= 400) return direct;
  const msg = String(err?.message || err || '');
  const match = msg.match(/\b(400|401|403|404|413|429|500|502|503|504)\b/);
  return match ? Number(match[1]) : 0;
}

function extractRetryAfterMs(err: any): number {
  const msg = String(err?.message || '');
  const secMatch = msg.match(/retry(?:\s+in|\s*after|\s*Delay["':=\s]+)\s*(\d+(?:\.\d+)?)\s*s/i);
  if (secMatch) {
    return Math.min(45_000, Math.max(5_000, Math.ceil(Number(secMatch[1]) * 1000)));
  }
  return 15_000;
}

function isRateLimitError(err: any, status: number): boolean {
  if (status === 429) return true;
  const msg = String(err?.message || '').toUpperCase();
  return msg.includes('RESOURCE_EXHAUSTED') || msg.includes('TOO MANY REQUESTS') || msg.includes('QUOTA');
}

function isInvalidKeyError(err: any, status: number): boolean {
  if (status === 401 || status === 403) return true;
  const msg = String(err?.message || '').toUpperCase();
  return msg.includes('API_KEY_INVALID') || msg.includes('API KEY NOT VALID') || msg.includes('PERMISSION_DENIED');
}

function isTransientUpstreamError(err: any, status: number): boolean {
  if (status === 500 || status === 502 || status === 503 || status === 504) return true;
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('bad gateway') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed')
  );
}

/**
 * Prompt d'extraction et de décodage visuel scientifique spécialisé pour le programme 2BAC PC / SM (BIOF).
 */
export const SCIENTIFIC_VISION_PROMPT = `Tu es un professeur agrégé et inspecteur national de Physique-Chimie du baccalauréat marocain (2BAC BIOF).
Analyse minutieusement ce document officiel (sujet d'examen national ou document de référence).
Ton objectif est de décoder EXHAUSTIVEMENT TOUS les schémas de montages, circuits électriques, graphes expérimentaux, oscillogrammes et dispositifs mécaniques présents, afin que Si Driss puisse résoudre les exercices avec une exactitude mathématique et physique absolue.

Pour CHAQUE figure, graphe ou schéma présent dans le document, produis un bloc d'analyse structuré au format Markdown suivant :

--- [FIGURE / SCHÉMA DÉCODÉ : <Nom ou Numéro exact de la figure, ex: Figure 1, Figure 2, الشكل 1, Courbe 1>] ---
- **Contexte de l'exercice** : <ex: Électricité (Dipôle RC, RL, RLC), Mécanique (Plan incliné, Chute verticale, Oscillateurs), Chimie (Dosage pH-métrique/conductimétrique, Suivi cinétique), Ondes (Diffraction, Cuve à ondes)>
- **Description du dispositif ou montage** :
  * Composants & notations : <ex: Générateur de tension (E = 6V), résistor R, condensateur C, bobine (L, r), interrupteur K>
  * Branchements & oscilloscope : <ex: Voie Y1 mesure la tension u_C(t), voie Y2 mesure u_R(t), masse entre les dipôles>
- **Analyse détaillée du graphe / de la courbe (si applicable)** :
  * Grandeur en ordonnée (Axe vertical Y) : <Symbole, unité, échelle exacte par division (ex: 1V/div, ou 2V par carreau)>
  * Grandeur en abscisse (Axe horizontal X) : <Symbole, unité, échelle exacte par division (ex: 2ms/div, ou 5 min par division)>
  * Allure de la courbe : <ex: Exponentielle croissante, oscillations sinusoïdales amorties (pseudo-périodiques), courbe en S avec saut de pH>
  * Valeurs remarquables & points clés :
    - Valeur initiale à t=0 : <ex: u_C(0) = 0 V ou pH(0) = 2.8>
    - Asymptote / Valeur finale en régime permanent : <ex: u_C(infini) = E = 6 V>
    - Tangente à l'origine (t=0) : <Intersection exacte avec l'asymptote -> temps tau ou vitesse initiale v0>
    - Pseudo-période T ou période propre T0 : <Mesure sur plusieurs périodes pour précision, ex: 3T = 30 ms -> T = 10 ms>
    - Point d'équivalence (titrage) : <Coordonnées déduites par la méthode des tangentes : V_bE et pH_E>
- **Formules et équations exploitables déduites de la figure** :
  * <ex: u_C(t) = E * (1 - e^(-t/tau)) avec tau = R*C>
  * <ex: À t = tau, u_C(tau) = 0.63 * E = 3.78 V>
--------------------------------------------------------------------------------

Important :
1. Ne résume pas le texte de l'énoncé qui est déjà extrait.
2. Concentre-toi UNIQUEMENT sur les éléments VISUELS, GÉOMÉTRIQUES, GRAPHIQUES et SCHÉMATIQUES invisibles au lecteur de texte.
3. Sois d'une précision mathématique irréprochable sur les valeurs numériques lues sur les axes.`;

/**
 * Analyse visuellement un PDF avec un modèle de vision multimodal (Gemini)
 * avec gestion fine des quotas (429), pannes amont (502/503) et délais d'attente.
 */
export async function extractVisualDataFromPdfDetailed(
  pdfPath: string,
  apiKey: string
): Promise<VisionExtractionOutcome> {
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey || !isLikelyGeminiKey(cleanKey)) {
    return {
      text: '',
      status: 'invalid_key',
      errorMessage: 'Clé API absente ou incompatible avec Gemini Vision.',
    };
  }

  if (!fs.existsSync(pdfPath)) {
    console.warn(`[VisionExtractor] Fichier introuvable: ${pdfPath}`);
    return { text: '', status: 'skipped', errorMessage: 'Fichier introuvable.' };
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(pdfPath);
  } catch {
    return { text: '', status: 'skipped', errorMessage: 'Impossible de lire les métadonnées du PDF.' };
  }

  if (stat.size > MAX_INLINE_PDF_BYTES) {
    console.warn(
      `[VisionExtractor] Fichier "${path.basename(pdfPath)}" ignoré pour la vision (${(
        stat.size /
        (1024 * 1024)
      ).toFixed(1)} Mo > 14 Mo inline max). Texte déjà indexé.`
    );
    return { text: '', status: 'skipped', errorMessage: 'PDF trop volumineux pour analyse vision inline (>14 Mo).' };
  }

  const base64Data = fs.readFileSync(pdfPath).toString('base64');
  const fileName = path.basename(pdfPath);

  const ai = new GoogleGenAI({
    apiKey: cleanKey,
    httpOptions: {
      headers: { 'User-Agent': 'si-driss-universal' },
    },
  });

  const candidateModels = Array.from(new Set([...GEMINI_FAST_MODELS, 'gemini-flash-latest']));
  let retried429 = false;
  let lastTransientMsg = '';

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    try {
      console.log(`[VisionExtractor] Décodage visuel pour "${fileName}" via ${model}...`);
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: base64Data,
                },
              },
              {
                text: SCIENTIFIC_VISION_PROMPT,
              },
            ],
          },
        ],
        config: {
          temperature: 0.1,
          abortSignal: AbortSignal.timeout(VISION_REQUEST_TIMEOUT_MS),
        },
      });

      const visualText = response.text || '';
      if (visualText.trim().length > 50) {
        console.log(`[VisionExtractor] Succès pour "${fileName}": ${visualText.length} caractères.`);
        return { text: visualText.trim(), status: 'ok' };
      }
      return { text: '', status: 'skipped', errorMessage: 'Aucune figure détectée.' };
    } catch (err: any) {
      const httpStatus = extractHttpStatus(err);
      const errMsg = String(err?.message || err || '').slice(0, 220);
      console.warn(`[VisionExtractor] Tentative échouée (${fileName} / ${model}, status=${httpStatus || 'n/a'}):`, errMsg);

      if (isInvalidKeyError(err, httpStatus)) {
        return {
          text: '',
          status: 'invalid_key',
          errorMessage: 'Clé Gemini invalide ou autorisations insuffisantes (401/403).',
        };
      }

      if (isRateLimitError(err, httpStatus)) {
        const retryAfterMs = extractRetryAfterMs(err);
        // Un seul essai après pause si quota par minute ; au deuxième 429 on arrête le lot proprement
        if (!retried429 && retryAfterMs <= 20_000) {
          retried429 = true;
          console.log(`[VisionExtractor] Pause quota 429 de ${Math.round(retryAfterMs / 1000)}s avant réessai...`);
          await sleep(retryAfterMs + Math.floor(Math.random() * 1000));
          i--; // réessayer le même modèle une seule fois
          continue;
        }
        return {
          text: '',
          status: 'rate_limited',
          retryAfterMs,
          errorMessage: 'Quota API Gemini temporairement atteint (429).',
        };
      }

      if (isTransientUpstreamError(err, httpStatus)) {
        lastTransientMsg = `Erreur temporaire serveur IA (${httpStatus || '502/503'}) : ${errMsg}`;
        if (i < candidateModels.length - 1) {
          await sleep(2500 + Math.floor(Math.random() * 1000));
        }
        continue;
      }

      // Erreur 400 payload invalide sur ce PDF ou 404 modèle inconnu : essayer modèle suivant si 404, sinon abandonner ce PDF
      if (httpStatus === 404 && i < candidateModels.length - 1) {
        continue;
      }

      lastTransientMsg = errMsg;
      if (httpStatus === 400) {
        return { text: '', status: 'skipped', errorMessage: `Document non décodable en vision (${errMsg}).` };
      }
    }
  }

  return {
    text: '',
    status: lastTransientMsg ? 'transient_error' : 'skipped',
    errorMessage: lastTransientMsg || undefined,
  };
}

/**
 * Wrapper rétrocompatible retournant uniquement le texte extrait (ou vide si échec/ignoré).
 */
export async function extractVisualDataFromPdf(
  pdfPath: string,
  apiKey: string
): Promise<string> {
  const outcome = await extractVisualDataFromPdfDetailed(pdfPath, apiKey);
  return outcome.text;
}
