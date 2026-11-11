export interface ClientAttachment {
  name?: string;
  type?: string;
  mimeType?: string;
  data?: string;
  text?: string;
}

export interface ClientMessage {
  role: string;
  content: string;
  attachments?: ClientAttachment[];
}

function extractRawBase64(data: unknown): string {
  if (typeof data !== 'string') return '';
  const compact = data.replace(/\s+/g, '');
  if (!compact) return '';
  const commaIdx = compact.indexOf(',');
  return commaIdx >= 0 ? compact.slice(commaIdx + 1) : compact;
}

function buildDataUrl(data: unknown, mimeType: string): string {
  if (typeof data !== 'string') return '';
  const compact = data.trim();
  if (!compact) return '';
  if (compact.startsWith('data:')) return compact.replace(/\s+/g, '');
  return `data:${mimeType};base64,${compact.replace(/\s+/g, '')}`;
}

export function formatMessagesForGemini(messages: ClientMessage[]) {
  const safeMessages = Array.isArray(messages)
    ? messages.filter((m): m is ClientMessage => Boolean(m && typeof m === 'object'))
    : [];

  const rawTurns = safeMessages.map((m) => {
    const parts: any[] = [];
    const textContent = (typeof m.content === 'string' ? m.content : String(m.content || '')).trim();

    if (m.attachments && Array.isArray(m.attachments) && m.attachments.length > 0) {
      let attachmentTextSummary = '';

      for (const att of m.attachments) {
        if (!att || typeof att !== 'object') continue;
        if (att.data && att.mimeType && (att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf')) {
          const rawBase64 = extractRawBase64(att.data);
          if (rawBase64) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: rawBase64,
              },
            });
          }
        }

        if (att.text) {
          attachmentTextSummary += `\n\n--- [DOCUMENT JOINT: ${att.name || 'Document'}] ---\n${att.text}\n---------------------------------------------`;
        }
      }

      if (textContent || attachmentTextSummary) {
        parts.unshift({
          text: (textContent ? textContent : "Voici le document ou l'exercice que j'ai joint pour analyse.") + attachmentTextSummary,
        });
      }
    } else {
      parts.push({ text: textContent || 'Bonjour Si Driss' });
    }

    if (parts.length === 0) {
      parts.push({ text: 'Bonjour Si Driss' });
    }

    return {
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts,
    };
  });

  // Drop leading 'model' welcome messages so conversation starts with 'user'
  const firstUserIdx = rawTurns.findIndex((t) => t.role === 'user');
  const slicedTurns = firstUserIdx >= 0 ? rawTurns.slice(firstUserIdx) : rawTurns;

  // Coalesce consecutive turns with the same role to satisfy strict Gemini turn alternation
  const normalized: { role: string; parts: any[] }[] = [];
  for (const turn of slicedTurns) {
    const prev = normalized[normalized.length - 1];
    if (prev && prev.role === turn.role) {
      prev.parts.push(...turn.parts);
    } else {
      normalized.push({ role: turn.role, parts: [...turn.parts] });
    }
  }

  if (normalized.length === 0) {
    normalized.push({ role: 'user', parts: [{ text: 'Bonjour Si Driss' }] });
  }

  return normalized;
}

function appendNonImageAttachmentText(att: ClientAttachment): string {
  if (!att || typeof att !== 'object') return '';
  if (att.text) {
    return `\n\n--- [DOCUMENT JOINT: ${att.name || 'Document'}] ---\n${att.text}\n---------------------------------------------`;
  }
  if (att.mimeType === 'application/pdf') {
    return `\n\n--- [DOCUMENT PDF JOINT: ${att.name || 'Document.pdf'}] ---\n[PDF scanné sans couche texte extractible automatiquement par ce fournisseur. Invite l'élève à utiliser Google Gemini ou à envoyer une capture d'écran de l'énoncé si besoin.]\n---------------------------------------------`;
  }
  return '';
}

export function formatMessagesForOpenAI(messages: ClientMessage[], systemInstruction: string) {
  const result: any[] = [];

  if (systemInstruction) {
    result.push({ role: 'system', content: systemInstruction });
  }

  const safeMessages = Array.isArray(messages)
    ? messages.filter((m): m is ClientMessage => Boolean(m && typeof m === 'object'))
    : [];

  // Drop leading assistant welcome messages so conversation starts with a user turn
  const firstUserIdx = safeMessages.findIndex((m) => m.role !== 'assistant' && m.role !== 'model');
  const relevantMessages = firstUserIdx >= 0 ? safeMessages.slice(firstUserIdx) : [];

  if (relevantMessages.length === 0) {
    result.push({ role: 'user', content: 'Bonjour Si Driss' });
    return result;
  }

  for (const m of relevantMessages) {
    const isAssistant = m.role === 'assistant' || m.role === 'model';
    const role = isAssistant ? 'assistant' : 'user';
    const baseText = (typeof m.content === 'string' ? m.content : String(m.content || '')).trim();
    const atts = Array.isArray(m.attachments) ? m.attachments.filter((a) => a && typeof a === 'object') : [];

    const hasImages = atts.some(
      (a) => a.mimeType?.startsWith('image/') && typeof a.data === 'string' && a.data.trim().length > 0
    );

    if (hasImages && !isAssistant) {
      const contentParts: any[] = [];
      let textContent = baseText;

      for (const att of atts) {
        if (att.mimeType?.startsWith('image/') && att.data) {
          const dataUrl = buildDataUrl(att.data, att.mimeType);
          if (dataUrl) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: dataUrl },
            });
          }
        }
        textContent += appendNonImageAttachmentText(att);
      }

      contentParts.unshift({
        type: 'text',
        text: textContent || "Voici l'image pour analyse physique-chimie.",
      });

      result.push({ role, content: contentParts });
    } else {
      let text = baseText;
      for (const att of atts) {
        text += appendNonImageAttachmentText(att);
      }
      result.push({ role, content: text || (isAssistant ? '...' : 'Bonjour Si Driss') });
    }
  }

  return result;
}

export function formatMessagesForAnthropic(messages: ClientMessage[]) {
  const rawTurns: { role: 'user' | 'assistant'; content: any }[] = [];
  const safeMessages = Array.isArray(messages)
    ? messages.filter((m): m is ClientMessage => Boolean(m && typeof m === 'object'))
    : [];

  for (const m of safeMessages) {
    const isAssistant = m.role === 'assistant' || m.role === 'model';
    const role: 'user' | 'assistant' = isAssistant ? 'assistant' : 'user';
    const baseText = (typeof m.content === 'string' ? m.content : String(m.content || '')).trim();
    const atts = Array.isArray(m.attachments) ? m.attachments.filter((a) => a && typeof a === 'object') : [];

    const hasImages = atts.some(
      (a) => a.mimeType?.startsWith('image/') && typeof a.data === 'string' && a.data.trim().length > 0
    );

    if (hasImages && !isAssistant) {
      const contentParts: any[] = [];
      let textContent = baseText;

      for (const att of atts) {
        if (att.mimeType?.startsWith('image/') && att.data) {
          const rawBase64 = extractRawBase64(att.data);
          if (rawBase64) {
            contentParts.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: att.mimeType,
                data: rawBase64,
              },
            });
          }
        }
        textContent += appendNonImageAttachmentText(att);
      }

      contentParts.unshift({
        type: 'text',
        text: textContent || "Voici l'image pour analyse.",
      });

      rawTurns.push({ role, content: contentParts });
    } else {
      let text = baseText;
      for (const att of atts) {
        text += appendNonImageAttachmentText(att);
      }
      rawTurns.push({ role, content: text || (isAssistant ? '...' : 'Bonjour Si Driss') });
    }
  }

  // Anthropic API requirement: Conversation MUST start with a 'user' turn.
  // Drop leading assistant messages (e.g. the initial welcome message).
  const firstUserIdx = rawTurns.findIndex((t) => t.role === 'user');
  const slicedTurns = firstUserIdx >= 0 ? rawTurns.slice(firstUserIdx) : [];

  if (slicedTurns.length === 0) {
    return [{ role: 'user', content: 'Bonjour Si Driss' }];
  }

  // Anthropic API requirement: Dialogue turns MUST strictly alternate between 'user' and 'assistant'.
  // Coalesce consecutive turns with the same role.
  const normalized: { role: 'user' | 'assistant'; content: any }[] = [];

  for (const turn of slicedTurns) {
    const prev = normalized[normalized.length - 1];
    if (prev && prev.role === turn.role) {
      if (typeof prev.content === 'string' && typeof turn.content === 'string') {
        prev.content = `${prev.content}\n\n${turn.content}`;
      } else {
        const prevArray = Array.isArray(prev.content)
          ? prev.content
          : [{ type: 'text', text: String(prev.content) }];
        const currArray = Array.isArray(turn.content)
          ? turn.content
          : [{ type: 'text', text: String(turn.content) }];
        prev.content = [...prevArray, ...currArray];
      }
    } else {
      normalized.push({
        role: turn.role,
        content: turn.content,
      });
    }
  }

  // Ensure first turn is user
  if (normalized.length === 0 || normalized[0].role !== 'user') {
    normalized.unshift({ role: 'user', content: 'Bonjour Si Driss' });
  }

  return normalized;
}
