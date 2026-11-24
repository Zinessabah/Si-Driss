import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ROOT_DIR } from './config';

export const CLOUD_SERVER_URL = process.env.CLOUD_SERVER_URL || 'https://si-driss.onrender.com';

export interface VersionInfo {
  version: string;
  commit: string;
  commitDate: string;
  commitMessage: string;
  buildTime: string;
  isCloud: boolean;
  environment: string;
  cloudUrl: string;
}

export interface VersionCheckResult {
  isCloud: boolean;
  cloudReachable: boolean;
  upToDate: boolean;
  hasUpdate: boolean;
  localCommit: string;
  localDate: string;
  cloudCommit?: string;
  cloudDate?: string;
  cloudCommitMessage?: string;
  message: string;
  checkedAt: string;
}

export function isCloudEnvironment(): boolean {
  return Boolean(
    process.env.RENDER ||
    process.env.IS_RENDER ||
    process.env.RENDER_SERVICE_ID ||
    process.env.RENDER_INSTANCE_ID
  );
}

/**
 * Lit ou extrait les métadonnées de version de l'application locale.
 * Sur une machine locale avec Git, Git HEAD est la source de vérité prioritaire.
 */
export function getLocalVersionInfo(): VersionInfo {
  let pkgVersion = '2.2.0';
  try {
    const pkgPath = path.join(ROOT_DIR, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.version) pkgVersion = pkg.version;
    }
  } catch {}

  let versionFileContent: Partial<VersionInfo> = {};
  const versionFilePath = path.join(ROOT_DIR, 'version.json');
  if (fs.existsSync(versionFilePath)) {
    try {
      versionFileContent = JSON.parse(fs.readFileSync(versionFilePath, 'utf-8'));
    } catch {}
  }

  // 1. Tenter d'interroger directement Git (source de vérité absolue en local)
  let commit = '';
  let commitDate = '';
  let commitMessage = '';

  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: ROOT_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {}

  if (commit) {
    if (commit.length > 7) commit = commit.substring(0, 7);
    try {
      commitDate = execSync('git log -1 --format=%cI', { cwd: ROOT_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {}
    try {
      commitMessage = execSync('git log -1 --format=%s', { cwd: ROOT_DIR, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {}
  }

  // 2. Si Git n'est pas disponible (ex: conteneur Docker de production), fallback sur version.json
  if (!commit) {
    commit = versionFileContent.commit || process.env.RENDER_GIT_COMMIT || 'latest';
    if (commit.length > 7) commit = commit.substring(0, 7);
  }
  if (!commitDate) {
    commitDate = versionFileContent.commitDate || new Date().toISOString();
  }
  if (!commitMessage) {
    commitMessage = versionFileContent.commitMessage || 'Dernière mise à jour';
  }

  const buildTime = versionFileContent.buildTime || new Date().toISOString();

  return {
    version: pkgVersion,
    commit,
    commitDate,
    commitMessage,
    buildTime,
    isCloud: isCloudEnvironment(),
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    cloudUrl: CLOUD_SERVER_URL,
  };
}

/**
 * Compare la version locale en cours d'exécution avec celle déployée sur le serveur cloud (si-driss.onrender.com).
 */
export async function checkCloudVersion(): Promise<VersionCheckResult> {
  const local = getLocalVersionInfo();
  const checkedAt = new Date().toISOString();

  // Si cette instance est déjà le serveur cloud de production
  if (local.isCloud) {
    return {
      isCloud: true,
      cloudReachable: true,
      upToDate: true,
      hasUpdate: false,
      localCommit: local.commit,
      localDate: local.commitDate,
      cloudCommit: local.commit,
      cloudDate: local.commitDate,
      cloudCommitMessage: local.commitMessage,
      message: 'Serveur Cloud de référence (si-driss.onrender.com).',
      checkedAt,
    };
  }

  try {
    const cloudApiUrl = `${CLOUD_SERVER_URL.replace(/\/+$/, '')}/api/version`;
    const res = await fetch(cloudApiUrl, {
      signal: AbortSignal.timeout(3500),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return {
        isCloud: false,
        cloudReachable: false,
        upToDate: true,
        hasUpdate: false,
        localCommit: local.commit,
        localDate: local.commitDate,
        message: 'Serveur cloud joignable mais réponse non standard (mode local autonome conservé).',
        checkedAt,
      };
    }

    const cloudData = (await res.json()) as VersionInfo;
    const cloudCommit = (cloudData.commit || '').trim().substring(0, 7).toLowerCase();
    const localCommit = (local.commit || '').trim().substring(0, 7).toLowerCase();

    // 1. Si les commits sont strictement identiques
    if (cloudCommit && localCommit && cloudCommit === localCommit) {
      return {
        isCloud: false,
        cloudReachable: true,
        upToDate: true,
        hasUpdate: false,
        localCommit,
        localDate: local.commitDate,
        cloudCommit,
        cloudDate: cloudData.commitDate,
        cloudCommitMessage: cloudData.commitMessage,
        message: 'Votre version locale est parfaitement synchronisée avec le serveur Cloud.',
        checkedAt,
      };
    }

    // 2. Si le cloud renvoie "latest" ou n'a pas de SHA de commit Git identifiable
    if (!cloudCommit || cloudCommit === 'latest' || localCommit === 'latest') {
      const isSameVersion = Boolean(local.version && cloudData.version && local.version === cloudData.version);
      return {
        isCloud: false,
        cloudReachable: true,
        upToDate: isSameVersion,
        hasUpdate: !isSameVersion,
        localCommit,
        localDate: local.commitDate,
        cloudCommit: cloudCommit || 'latest',
        cloudDate: cloudData.commitDate,
        cloudCommitMessage: cloudData.commitMessage,
        message: isSameVersion
          ? `Votre version locale est à jour avec le serveur Cloud (version ${local.version}).`
          : `Une nouvelle version (${cloudData.version}) est disponible sur le Cloud.`,
        checkedAt,
      };
    }

    // 3. Les deux sont des commits Git valides : vérifier l'ascendance avec Git local
    let isAncestor = false;
    try {
      // Si cloudCommit est un ancêtre de HEAD, local POSSÈDE DÉJÀ ce commit (ou est en avance)
      execSync(`git merge-base --is-ancestor ${cloudCommit} HEAD`, { cwd: ROOT_DIR, stdio: ['ignore', 'ignore', 'ignore'] });
      isAncestor = true;
    } catch {}

    if (isAncestor) {
      // Le code local a déjà le commit du cloud (ou un commit plus récent)
      return {
        isCloud: false,
        cloudReachable: true,
        upToDate: true,
        hasUpdate: false,
        localCommit,
        localDate: local.commitDate,
        cloudCommit,
        cloudDate: cloudData.commitDate,
        cloudCommitMessage: cloudData.commitMessage,
        message: 'Votre version locale est à jour avec le serveur Cloud.',
        checkedAt,
      };
    }

    // 4. Le commit cloud n'est pas dans l'historique de HEAD : vérifier si local est ancêtre du cloud (cloud en avance)
    let isCloudAhead = false;
    try {
      execSync(`git merge-base --is-ancestor HEAD ${cloudCommit}`, { cwd: ROOT_DIR, stdio: ['ignore', 'ignore', 'ignore'] });
      isCloudAhead = true;
    } catch {}

    let hasNewerCloudVersion = false;
    if (isCloudAhead) {
      hasNewerCloudVersion = true;
    } else if (cloudData.commitDate && local.commitDate) {
      const cloudTime = new Date(cloudData.commitDate).getTime();
      const localTime = new Date(local.commitDate).getTime();
      // Marge de sécurité de 60s pour absorber la dérive d'horloge
      hasNewerCloudVersion = cloudTime > (localTime + 60_000);
    } else {
      hasNewerCloudVersion = true;
    }

    return {
      isCloud: false,
      cloudReachable: true,
      upToDate: !hasNewerCloudVersion,
      hasUpdate: hasNewerCloudVersion,
      localCommit,
      localDate: local.commitDate,
      cloudCommit,
      cloudDate: cloudData.commitDate,
      cloudCommitMessage: cloudData.commitMessage,
      message: hasNewerCloudVersion
        ? `Une mise à jour plus récente est disponible sur le serveur Cloud (${cloudCommit}).`
        : 'Votre version locale est synchronisée avec le serveur Cloud.',
      checkedAt,
    };
  } catch (err: any) {
    return {
      isCloud: false,
      cloudReachable: false,
      upToDate: true,
      hasUpdate: false,
      localCommit: local.commit,
      localDate: local.commitDate,
      message: 'Serveur cloud inaccessible ou hors-ligne (fonctionnement 100% local autonome).',
      checkedAt,
    };
  }
}

/**
 * Lance une mise à jour locale directe depuis GitHub (git pull origin main).
 * Uniquement autorisé sur une machine locale de développement/élève/professeur.
 */
export async function performLocalUpdate(): Promise<{ success: boolean; message: string; output?: string }> {
  if (isCloudEnvironment()) {
    return {
      success: false,
      message: 'Opération non autorisée sur l\'instance Cloud de production.',
    };
  }

  try {
    const gitStatus = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf-8' }).trim();
    if (gitStatus) {
      return {
        success: false,
        message: 'Des modifications locales non commitées sont présentes. Veuillez les enregistrer avant de mettre à jour.',
      };
    }

    const pullOutput = execSync('git pull origin main', { cwd: ROOT_DIR, encoding: 'utf-8' });
    const installOutput = execSync('npm install --prefer-offline --no-audit', { cwd: ROOT_DIR, encoding: 'utf-8' });

    return {
      success: true,
      message: 'Mise à jour réussie avec succès depuis GitHub ! Rechargez la page web pour appliquer tous les changements.',
      output: `${pullOutput}\n${installOutput}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Erreur lors du git pull : ${err?.message || err}`,
    };
  }
}
