import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import path from 'path';
import { PORT, ROOT_DIR, DOCS_DIR } from './server/config';
import { apiLimiter, accessGate } from './server/security';
import { createAiRouter } from './server/routes/ai';
import { createDocumentsRouter } from './server/routes/documents';

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
  });
}

startServer();
