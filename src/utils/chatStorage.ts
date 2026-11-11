import { SavedSession, ChatMessage, ChatAttachment } from '../types/chat';

export const SESSIONS_STORAGE_KEY = 'sidriss_saved_sessions_v1';
export const ACTIVE_SESSION_STORAGE_KEY = 'sidriss_active_session_v1';

/**
 * Compresse et redimensionne une image côté client pour éviter la saturation mémoire de localStorage.
 * Une photo de 5 Mo devient typiquement 80-150 Ko sans aucune perte de lisibilité pour l'IA et l'élève.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1280,
  quality = 0.75
): Promise<{ dataUrl: string; size: number }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      resolve({ dataUrl: '', size: file.size });
    };
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        resolve({ dataUrl: '', size: file.size });
        return;
      }

      const img = new Image();
      img.onerror = () => {
        resolve({ dataUrl: src, size: file.size });
      };
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ dataUrl: src, size: file.size });
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          const approxBytes = Math.round((compressedDataUrl.length * 3) / 4);
          resolve({ dataUrl: compressedDataUrl, size: approxBytes });
        } catch {
          resolve({ dataUrl: src, size: file.size });
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

const MAX_IMAGE_STORAGE_CHARS = 150000;
const MAX_TEXT_STORAGE_CHARS = 12000;

/**
 * Allège une pièce jointe pour le stockage persistant dans localStorage (5 Mo max par domaine).
 */
function sanitizeAttachmentForStorage(att: ChatAttachment): ChatAttachment {
  if (att.type === 'pdf') {
    return {
      ...att,
      data: undefined,
      previewUrl: undefined,
      text: att.text ? att.text.slice(0, MAX_TEXT_STORAGE_CHARS) : undefined,
    };
  }
  if (att.type === 'image') {
    const safePreview =
      att.previewUrl && att.previewUrl.length <= MAX_IMAGE_STORAGE_CHARS ? att.previewUrl : undefined;
    if (att.data && att.data.length > MAX_IMAGE_STORAGE_CHARS) {
      return {
        ...att,
        data: safePreview,
        previewUrl: safePreview,
      };
    }
    return safePreview !== att.previewUrl ? { ...att, previewUrl: safePreview } : att;
  }
  if (att.text && att.text.length > MAX_TEXT_STORAGE_CHARS) {
    return {
      ...att,
      text: att.text.slice(0, MAX_TEXT_STORAGE_CHARS),
    };
  }
  return att;
}

/**
 * Allège une session complète pour le stockage.
 */
export function sanitizeSessionForStorage(session: SavedSession): SavedSession {
  return {
    ...session,
    messages: session.messages.map((m) => ({
      ...m,
      attachments: m.attachments?.map(sanitizeAttachmentForStorage),
    })),
  };
}

/**
 * Sauvegarde sécurisée des sessions avec mécanisme d'élagage automatique anti-saturation.
 * Garantit que l'utilisateur n'aura plus jamais l'erreur "mémoire saturée du navigateur".
 */
export function safeSaveSessions(sessions: SavedSession[]): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  const sanitized = sessions.slice(0, 30).map(sanitizeSessionForStorage);

  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sanitized));
    return true;
  } catch (err) {
    console.warn('[chatStorage] Quota localStorage dépassé, élagage automatique des anciennes discussions...', err);

    // Niveau 1 d'élagage : garder les 15 plus récentes et supprimer le base64 lourd des sessions archivées
    try {
      const pruned = sanitized.slice(0, 15).map((s, idx) => {
        if (idx === 0) return s; // Garder la plus récente intacte
        return {
          ...s,
          messages: s.messages.map((m) => ({
            ...m,
            attachments: m.attachments?.map((a) => ({
              id: a.id,
              name: a.name,
              type: a.type,
              size: a.size,
            })),
          })),
        };
      });
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(pruned));
      return true;
    } catch {
      // Niveau 2 d'élagage d'urgence : garder uniquement le texte des 10 dernières discussions
      try {
        const textOnly = sanitized.slice(0, 10).map((s) => ({
          ...s,
          messages: s.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            mode: m.mode,
          })),
        }));
        localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(textOnly));
        return true;
      } catch (finalErr) {
        console.error('[chatStorage] Impossible de libérer de la place dans localStorage:', finalErr);
        return false;
      }
    }
  }
}

/**
 * Charge les sessions enregistrées de manière sûre.
 */
export function safeLoadSessions(): SavedSession[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Migre l'éventuelle session active précédente dans l'historique et libère le canvas
 * pour que chaque démarrage de Si Driss s'ouvre sur un canvas propre comme Google Gemini.
 */
export function migrateAndClearActiveSessionOnStartup(): SavedSession[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];

  const existing = safeLoadSessions();

  try {
    const rawActive = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (rawActive) {
      const parsedActive = JSON.parse(rawActive);
      const hasUserMessages =
        Array.isArray(parsedActive.messages) &&
        parsedActive.messages.some((m: ChatMessage) => m.role === 'user');

      if (hasUserMessages && parsedActive.id) {
        const alreadyInList = existing.some((s) => s.id === parsedActive.id);
        if (!alreadyInList) {
          const autoTitle =
            parsedActive.title && parsedActive.title !== 'Nouvelle discussion'
              ? parsedActive.title
              : parsedActive.messages.find((m: ChatMessage) => m.role === 'user')?.content.slice(0, 42).replace(/\n/g, ' ').trim() || 'Session d\'exercices';

          const migrated: SavedSession = {
            id: parsedActive.id,
            title: autoTitle,
            createdAt: parsedActive.createdAt || new Date().toISOString(),
            updatedAt: parsedActive.updatedAt || new Date().toISOString(),
            messages: parsedActive.messages,
            socraticEnabled: parsedActive.socraticEnabled ?? true,
            coachingMode: parsedActive.coachingMode || 'socratic',
          };
          existing.unshift(migrated);
          safeSaveSessions(existing);
        }
      }
      // On retire la session active pour garantir le démarrage vierge style Gemini
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[chatStorage] Erreur migration session active:', err);
  }

  return existing;
}
