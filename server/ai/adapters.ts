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

export function formatMessagesForGemini(messages: ClientMessage[]) {
  const rawTurns = messages.map((m) => {
    const parts: any[] = [];
    const textContent = (m.content || '').trim();

    if (m.attachments && Array.isArray(m.attachments) && m.attachments.length > 0) {
      let attachmentTextSummary = '';

      for (const att of m.attachments) {
        if (att.data && att.mimeType && (att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf')) {
          const rawBase64 = att.data.includes(',') ? att.data.split(',')[1] : att.data;
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: rawBase64,
            },
          });
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

export function formatMessagesForOpenAI(messages: ClientMessage[], systemInstruction: string) {
  const result: any[] = [];

  if (systemInstruction) {
    result.push({ role: 'system', content: systemInstruction });
  }

  for (const m of messages) {
    const isAssistant = m.role === 'assistant' || m.role === 'model';
    const role = isAssistant ? 'assistant' : 'user';

    const hasImages = m.attachments?.some(
      (a) => a.mimeType?.startsWith('image/') && a.data
    );

    if (hasImages && !isAssistant) {
      const contentParts: any[] = [];
      let textContent = (m.content || '').trim();

      for (const att of m.attachments || []) {
        if (att.mimeType?.startsWith('image/') && att.data) {
          const dataUrl = att.data.startsWith('data:') ? att.data : `data:${att.mimeType};base64,${att.data}`;
          contentParts.push({
            type: 'image_url',
            image_url: { url: dataUrl },
          });
        }
        if (att.text) {
          textContent += `\n\n--- [DOCUMENT JOINT: ${att.name || 'Document'}] ---\n${att.text}\n---------------------------------------------`;
        }
      }

      contentParts.unshift({
        type: 'text',
        text: textContent || "Voici l'image pour analyse physique-chimie.",
      });

      result.push({ role, content: contentParts });
    } else {
      let text = (m.content || '').trim();
      if (m.attachments) {
        for (const att of m.attachments) {
          if (att.text) {
            text += `\n\n--- [DOCUMENT JOINT: ${att.name || 'Document'}] ---\n${att.text}\n---------------------------------------------`;
          }
        }
      }
      result.push({ role, content: text || 'Bonjour Si Driss' });
    }
  }

  return result;
}

export function formatMessagesForAnthropic(messages: ClientMessage[]) {
  const result: any[] = [];

  for (const m of messages) {
    const isAssistant = m.role === 'assistant' || m.role === 'model';
    const role = isAssistant ? 'assistant' : 'user';

    const hasImages = m.attachments?.some(
      (a) => a.mimeType?.startsWith('image/') && a.data
    );

    if (hasImages && !isAssistant) {
      const contentParts: any[] = [];
      let textContent = (m.content || '').trim();

      for (const att of m.attachments || []) {
        if (att.mimeType?.startsWith('image/') && att.data) {
          const rawBase64 = att.data.includes(',') ? att.data.split(',')[1] : att.data;
          contentParts.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: att.mimeType,
              data: rawBase64,
            },
          });
        }
        if (att.text) {
          textContent += `\n\n--- [DOCUMENT JOINT: ${att.name || 'Document'}] ---\n${att.text}\n---------------------------------------------`;
        }
      }

      contentParts.unshift({
        type: 'text',
        text: textContent || "Voici l'image pour analyse.",
      });

      result.push({ role, content: contentParts });
    } else {
      let text = (m.content || '').trim();
      if (m.attachments) {
        for (const att of m.attachments) {
          if (att.text) {
            text += `\n\n--- [DOCUMENT JOINT: ${att.name || 'Document'}] ---\n${att.text}\n---------------------------------------------`;
          }
        }
      }
      result.push({ role, content: text || 'Bonjour Si Driss' });
    }
  }

  return result;
}
