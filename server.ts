import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import path from 'path';
import { PORT, ROOT_DIR, DOCS_DIR } from './server/config';
import { apiLimiter, accessGate } from './server/security';
import { createAiRouter } from './server/routes/ai';
import { createDocumentsRouter } from './server/routes/documents';
import { createAdminRouter } from './server/routes/admin';
import { createVersionRouter } from './server/routes/version';

// NOTE (Architecture) : ce fichier n'est plus qu'un point d'entrée. La logique vit
// dans server/ : config (env), security (rate limit + jetons), ai/ (fournisseurs,
// adaptateurs de messages, parser SSE partagé, moteur de complétion), rag (index
// des documents du programme), prompts (cadre de référence), routes/ (API).
// Le chargement de dotenv est fait par server/config.ts, évalué avant tout module
// qui lit process.env au chargement.

const app = express();

// Trust a single reverse-proxy hop (Nginx/Cloud Run) so rate limiting sees real client IPs
app.set('trust proxy', 1);

app.use(express.json({ limit: '25mb' }));

// Rate limiting global puis mot de passe de classe optionnel sur toutes les routes /api/*
app.use('/api/', apiLimiter);
app.use('/api/', accessGate);

// Routes API
app.use('/api', createAiRouter());
app.use('/api', createDocumentsRouter());
app.use('/api', createAdminRouter());
app.use('/api', createVersionRouter());

// Toute route /api/* inconnue doit répondre en JSON 404 — jamais la SPA en 200.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route API inconnue.' });
});

// -----------------------------------------------------------------------------
// Vite Middleware & Static Server
// -----------------------------------------------------------------------------
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
    app.use(express.static(path.resolve(ROOT_DIR, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(ROOT_DIR, 'dist/index.html'));
    });
  }

  httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 Si Driss Universal Platform running on port ${PORT}`);
    console.log(`📚 Documents repository ready: ${DOCS_DIR}`);
    console.log(`🤖 Universal AI Engine: Gemini, Groq, OpenAI, Claude, DeepSeek, Mistral, Ollama/Local`);
    console.log(`=======================================================`);

    // RAG local 100% autonome et confidentiel (dossiers docs/programme/PC et SM)
    import('./server/rag').then(({ getLocalRagStatus, startBackgroundOfficialSync }) => {
      const rag = getLocalRagStatus();
      console.log(`📚 RAG Local Actif : ${rag.pcCount} document(s) 2BAC PC, ${rag.smCount} document(s) 2BAC SM`);
      console.log(`🔒 Étanchéité pédagogique stricte : PC et SM 100% isolés (sans dossier commun)`);

      // Garde-fou automatique : détecte les PDF scannés sans texte lisible et lance
      // la pré-conversion en tâche de fond si une clé Vision serveur est configurée.
      import('./server/scannedPdfGuard')
        .then(({ findPendingScannedPdfs, buildSyncVisionOptions }) => {
          const pendingScans = findPendingScannedPdfs();
          if (pendingScans.length === 0) return;

          const syncVision = buildSyncVisionOptions(undefined, { allowServerFallback: true });
          if (syncVision.visionApiKey || syncVision.customScannedOcr) {
            console.log(
              `📄 Garde-fou scans : ${pendingScans.length} PDF scanné(s) sans OCR détecté(s) — conversion automatique cadencée via ${syncVision.visionProviderLabel}...`
            );
            const timer = setTimeout(() => {
              startBackgroundOfficialSync({
                branch: 'PC',
                visionApiKey: syncVision.visionApiKey,
                customScannedOcr: syncVision.customScannedOcr,
                visionProviderLabel: syncVision.visionProviderLabel,
              });
            }, 4000);
            timer.unref?.();
          } else {
            console.log(
              `📄 Garde-fou scans : ${pendingScans.length} PDF scanné(s) sans texte — conversion automatique à la demande dès qu'un utilisateur consulte un scan avec Gemini, NVIDIA NIM, OpenRouter, OpenAI ou Claude.`
            );
          }
        })
        .catch(() => {});
    });

    // Planificateur biquotidien Drive (actif lorsque les dossiers Drive sont configurés)
    import('./server/driveSync').then(({ startDriveAutoSyncSchedule }) => {
      startDriveAutoSyncSchedule();
    }).catch((err) => {
      console.warn('[DriveAutoSync] Impossible de démarrer le planificateur:', err);
    });

    // Contrôle automatique de version locale vs Cloud (si-driss.onrender.com)
    import('./server/version').then(async ({ checkCloudVersion, isCloudEnvironment }) => {
      if (!isCloudEnvironment()) {
        const check = await checkCloudVersion();
        if (check.cloudReachable) {
          if (check.upToDate) {
            console.log(`☁️  Cloud Sync : Code local synchronisé avec si-driss.onrender.com (commit ${check.localCommit})`);
          } else {
            console.log(`⚠️  Cloud Sync : Mise à jour disponible sur le Cloud !`);
            console.log(`    Local: ${check.localCommit} | Cloud: ${check.cloudCommit}`);
            console.log(`    Pour mettre à jour : tapez 'git pull origin main' ou mettez à jour depuis l'interface.`);
          }
        } else {
          console.log(`☁️  Cloud Sync : Serveur cloud non joignable (mode 100% local autonome).`);
        }
      }
    }).catch(() => {});
  });
}

startServer().catch((err) => {
  console.error('Erreur au démarrage du serveur:', err);
  process.exit(1);
});
