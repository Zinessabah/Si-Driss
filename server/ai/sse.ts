import type { Response } from 'express';

export function sseWrite(res: Response, payload: object): void {
  if (res.writableEnded || res.destroyed) return;
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {}
}

/**
 * (Architecture) Parser SSE partagé : remplace les boucles de lecture de flux
 * copiées-collées (Anthropic + tous les fournisseurs OpenAI-compatibles).
 * Gère le buffering de lignes, le préfixe `data: `, la sentinelle [DONE],
 * l'arrêt propre à la déconnexion du client et les fragments JSON invalides.
 */
export async function pipeSseEvents(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onEvent: (payload: any) => void;
    /** Quand vrai, le flux est annulé et la lecture s'arrête (client déconnecté). */
    shouldStop?: () => boolean;
  }
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (handlers.shouldStop?.()) {
        await reader.cancel().catch(() => {});
        return;
      }
      const { done, value } = await reader.read();
      if (done) return;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const rawData = line.slice(6).trim();
        if (rawData === '[DONE]') return; // fin réelle du flux (plus de lecture après)
        try {
          handlers.onEvent(JSON.parse(rawData));
        } catch {
          /* fragment non JSON : ignoré */
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}
