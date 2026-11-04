import dotenv from 'dotenv';

// IMPORTANT : dotenv doit être chargé avant toute lecture de process.env.
// Les modules ESM sont évalués en profondeur d'abord, donc ce module doit être
// la première dépendance de tout module lisant l'environnement au chargement.
dotenv.config();

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Racine du projet (ce fichier vit dans server/). */
export const ROOT_DIR = path.resolve(__dirname, '..');

/** Port d'écoute HTTP. */
export const PORT = process.env.PORT || 3000;

/** Répertoire des documents officiels indexés dans le prompt (RAG). */
export const DOCS_DIR = path.resolve(ROOT_DIR, 'docs', 'programme');
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

/** Mot de passe de classe optionnel : si défini, /api/* exige x-access-token. */
export const ACCESS_TOKEN = (process.env.SI_DRISS_ACCESS_TOKEN || '').trim();

/** Jeton admin requis pour téléverser/supprimer des documents du programme. */
export const ADMIN_TOKEN = (process.env.ADMIN_TOKEN || '').trim();

/** Liens ou identifiants des 2 dossiers Google Drive publics officiels (PC & SM) */
export const GOOGLE_DRIVE_FOLDER_PC = (process.env.GOOGLE_DRIVE_FOLDER_PC || '').trim();
export const GOOGLE_DRIVE_FOLDER_SM = (process.env.GOOGLE_DRIVE_FOLDER_SM || '').trim();
export const GOOGLE_DRIVE_API_KEY = (process.env.GOOGLE_DRIVE_API_KEY || '').trim();
export const GOOGLE_DRIVE_APPS_SCRIPT_URL = (process.env.GOOGLE_DRIVE_APPS_SCRIPT_URL || '').trim();

/** Fréquence d'auto-synchronisation Drive en heures (par défaut 12h = 2 fois par jour) */
export const DRIVE_SYNC_INTERVAL_HOURS = Math.max(1, Number(process.env.DRIVE_SYNC_INTERVAL_HOURS || 12));
