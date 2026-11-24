import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

let pkgVersion = '2.1.0';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
  if (pkg.version) pkgVersion = pkg.version;
} catch {}

let commit = process.env.RENDER_GIT_COMMIT || '';
if (!commit) {
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: ROOT_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    commit = 'latest';
  }
} else if (commit.length > 7) {
  commit = commit.substring(0, 7);
}

let commitDate = '';
try {
  commitDate = execSync('git log -1 --format=%cI', { cwd: ROOT_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
  commitDate = new Date().toISOString();
}

let commitMessage = '';
try {
  commitMessage = execSync('git log -1 --format=%s', { cwd: ROOT_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
  commitMessage = 'Dernière mise à jour';
}

const versionData = {
  version: pkgVersion,
  commit,
  commitDate,
  commitMessage,
  buildTime: new Date().toISOString(),
};

fs.writeFileSync(path.join(ROOT_DIR, 'version.json'), JSON.stringify(versionData, null, 2), 'utf-8');
console.log(`[Version] Fichier version.json généré avec succès : commit ${commit} (${commitDate})`);
