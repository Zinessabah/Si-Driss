import { Router } from 'express';
import { requireAdmin } from '../security';
import { getAggregatedMetrics, recordSimulationEvent, resetMetrics, seedDemoMetrics } from '../metrics';

export function createAdminRouter(): Router {
  const router = Router();

  // Middleware CORS dédié aux routes d'administration
  // Permet au dashboard externe (ouvert depuis file:// ou un domaine admin) de requêter l'API
  router.use('/admin', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token, x-access-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  /**
   * GET /api/admin/metrics
   * Renvoie l'intégralité des indicateurs, compteurs et journaux d'activité en temps réel.
   * Protégé par x-admin-token.
   */
  router.get('/admin/metrics', requireAdmin, (req, res) => {
    try {
      const branchFilter = typeof req.query.branch === 'string' ? req.query.branch : undefined;
      const period = typeof req.query.period === 'string' ? req.query.period : undefined;
      const metrics = getAggregatedMetrics(branchFilter, period);
      return res.json(metrics);
    } catch (err: any) {
      console.error('[Admin] Erreur lors de la récupération des métriques:', err);
      return res.status(500).json({ error: 'Erreur interne de télémétrie.' });
    }
  });

  /**
   * POST /api/admin/metrics/reset
   * Réinitialise les compteurs à 0 (ou restaure la démo si seedDemo=true).
   * Protégé par x-admin-token.
   */
  router.post('/admin/metrics/reset', requireAdmin, (req, res) => {
    try {
      const seedDemo = Boolean(req.body?.seedDemo);
      const metrics = seedDemo ? seedDemoMetrics() : resetMetrics(true);
      return res.json({ ok: true, metrics: getAggregatedMetrics() });
    } catch (err: any) {
      console.error('[Admin] Erreur lors de la réinitialisation des métriques:', err);
      return res.status(500).json({ error: 'Erreur lors de la réinitialisation.' });
    }
  });

  /**
   * POST /api/admin/metrics/event
   * Point de collecte pour les événements frontaux anonymisés (ex: lancement d'une simulation ExAO).
   */
  router.post('/admin/metrics/event', (req, res) => {
    try {
      const { simulatorName, branch, detail } = req.body || {};
      if (simulatorName) {
        recordSimulationEvent(req, {
          simulatorName,
          branch: branch === 'SM' ? 'SM' : 'PC',
          detail,
        });
      }
      return res.json({ ok: true });
    } catch {
      return res.status(400).json({ error: 'Événement invalide' });
    }
  });

  return router;
}

