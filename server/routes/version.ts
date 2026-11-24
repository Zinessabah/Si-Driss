import { Router, Request, Response } from 'express';
import { getLocalVersionInfo, checkCloudVersion, performLocalUpdate, isCloudEnvironment } from '../version';

export function createVersionRouter(): Router {
  const router = Router();

  /**
   * Statut et métadonnées de version de l'instance locale ou cloud.
   */
  router.get('/version', (_req: Request, res: Response) => {
    try {
      const info = getLocalVersionInfo();
      return res.json(info);
    } catch (err: any) {
      return res.status(500).json({ error: 'Impossible de lire les informations de version.' });
    }
  });

  /**
   * Compare le code local avec le serveur cloud de référence (si-driss.onrender.com).
   */
  router.get('/version/check', async (_req: Request, res: Response) => {
    try {
      const result = await checkCloudVersion();
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        error: 'Erreur lors de la vérification de version avec le cloud.',
        details: err?.message || String(err),
      });
    }
  });

  /**
   * Déclenche une mise à jour locale directe (git pull origin main).
   * Sécurisé : strictement réservé aux appels provenant de localhost (127.0.0.1 ou ::1).
   */
  router.post('/version/update', async (req: Request, res: Response) => {
    if (isCloudEnvironment()) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'La mise à jour directe est désactivée sur l\'instance Cloud.',
      });
    }

    // Vérification de sécurité : uniquement depuis localhost
    const ip = req.ip || req.socket.remoteAddress || '';
    const isLocalhost =
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip === '::ffff:127.0.0.1' ||
      req.hostname === 'localhost';

    if (!isLocalhost) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'La mise à jour du code ne peut être déclenchée que localement sur la machine hôte.',
      });
    }

    try {
      const result = await performLocalUpdate();
      if (!result.success) {
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        error: 'UPDATE_FAILED',
        message: err?.message || 'Échec de la mise à jour locale.',
      });
    }
  });

  return router;
}
