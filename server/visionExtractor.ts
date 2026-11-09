import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

export const SCIENTIFIC_VISION_MARKER = '=== TRANSCRIPTION VISUELLE DES SCHÉMAS & GRAPHES (IA Si Driss) ===';

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
 * pour décoder tous les schémas, graphes, circuits et figures.
 */
export async function extractVisualDataFromPdf(
  pdfPath: string,
  apiKey: string
): Promise<string> {
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) return '';

  if (!fs.existsSync(pdfPath)) {
    console.warn(`[VisionExtractor] Fichier introuvable: ${pdfPath}`);
    return '';
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  // Capacité max pour l'envoi direct en inlineData base64 : ~25 Mo
  if (pdfBuffer.byteLength > 25 * 1024 * 1024) {
    console.warn(`[VisionExtractor] Fichier trop volumineux (>25Mo) pour analyse inline: ${pdfPath}`);
    return '';
  }

  const base64Data = pdfBuffer.toString('base64');
  const fileName = path.basename(pdfPath);

  const ai = new GoogleGenAI({
    apiKey: cleanKey,
    httpOptions: {
      headers: { 'User-Agent': 'si-driss-universal' },
    },
  });

  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
  ];

  for (const model of candidateModels) {
    try {
      console.log(`[VisionExtractor] Décodage visuel des schémas & graphes pour "${fileName}" via ${model}...`);
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
      });

      const visualText = response.text || '';
      if (visualText.trim().length > 50) {
        console.log(`[VisionExtractor] Succès pour "${fileName}": ${visualText.length} caractères de décodage visuel.`);
        return visualText.trim();
      }
    } catch (err: any) {
      console.warn(`[VisionExtractor] Tentative échouée avec ${model}:`, err?.message || err);
      // Clé invalide ou refus d'accès : inutile de tenter d'autres modèles
      if (err?.message?.includes('API_KEY_INVALID') || err?.status === 400 || err?.status === 403) {
        break;
      }
    }
  }

  return '';
}
