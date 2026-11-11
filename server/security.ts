import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { ACCESS_TOKEN, ADMIN_TOKEN } from './config';

/**
 * Comparaison en temps constant via empreintes SHA-256 pour éviter
 * toute fuite temporelle sur la longueur ou les caractères des jetons.
 */
export function safeTokenEqual(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = crypto.createHash('sha256').update(provided, 'utf8').digest();
  const b = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

export const RATE_LIMIT_MSG = { error: 'Trop de requêtes. Réessaie dans quelques minutes, lah yerdi 3lik.' };

export const apiLimiter = rateLimit({
  windowMs: 5 * 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/documents/sync/status' || req.path === '/rag/status' || req.path === '/ai-status',
  message: RATE_LIMIT_MSG,
});

export const validateKeyLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MSG,
});

export const documentMutationLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MSG,
});

/** Mot de passe de classe optionnel : toutes les routes /api/* (sauf la sonde
 * de statut) exigent l'en-tête x-access-token quand SI_DRISS_ACCESS_TOKEN est défini. */
export function accessGate(req: Request, res: Response, next: NextFunction) {
  if (!ACCESS_TOKEN) return next();
  if (req.path === '/ai-status') return next();
  const provided = String(req.headers['x-access-token'] || '');
  if (safeTokenEqual(provided, ACCESS_TOKEN)) return next();
  return res.status(401).json({
    error: 'ACCESS_TOKEN_REQUIRED',
    message: 'Mot de passe de classe requis. Ajoute ?token=... à l’URL ou contacte ton professeur.',
  });
}

// Document mutation (upload/delete) requires ADMIN_TOKEN. In local development with no
// ADMIN_TOKEN configured, mutations stay open (single-user machine); in production they
// are refused until the admin configures a token.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_TOKEN) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        error: 'Gestion des documents désactivée : configurez la variable ADMIN_TOKEN côté serveur.',
      });
    }
    return next();
  }
  const provided = String(req.headers['x-admin-token'] || '');
  if (safeTokenEqual(provided, ADMIN_TOKEN)) return next();
  return res.status(401).json({ error: 'Jeton administrateur requis (en-tête x-admin-token).' });
}
