import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

let pkgVersion = '2.2.0';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
  if (pkg.version) pkgVersion = pkg.version;
} catch {}

// Charger l'éventuel version.json existant (pour préserver le commit git réel dans Docker)
const versionJsonPath = path.join(ROOT_DIR, 'version.json');
let existing: any = {};
if (fs.existsSync(versionJsonPath)) {
  try {
    existing = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
  } catch {}
}

let commit = process.env.RENDER_GIT_COMMIT || '';
if (!commit) {
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: ROOT_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    // Si git n'est pas disponible (ex: conteneur Docker où .git est exclu), préserver le commit existant
    if (existing.commit && existing.commit !== 'latest') {
      commit = existing.commit;
    } else {
      commit = 'latest';
    }
  }
} else if (commit.length > 7) {
  commit = commit.substring(0, 7);
}

let commitDate = '';
try {
  commitDate = execSync('git log -1 --format=%cI', { cwd: ROOT_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
  if (existing.commitDate) {
    commitDate = existing.commitDate;
  } else {
    commitDate = new Date().toISOString();
  }
}

let commitMessage = '';
try {
  commitMessage = execSync('git log -1 --format=%s', { cwd: ROOT_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
  if (existing.commitMessage) {
    commitMessage = existing.commitMessage;
  } else {
    commitMessage = 'Dernière mise à jour';
  }
}

const versionData = {
  version: pkgVersion,
  commit,
  commitDate,
  commitMessage,
  buildTime: new Date().toISOString(),
};

fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2), 'utf-8');
console.log(`[Version] Fichier version.json généré avec succès : commit ${commit} (${commitDate})`);
