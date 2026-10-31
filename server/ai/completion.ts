import { GoogleGenAI } from '@google/genai';
import type { Response } from 'express';
import {
  DEFAULT_BASE_URLS,
  GEMINI_FAST_MODELS,
  LEGACY_DEEPSEEK_MODELS,
  type ResolvedAIConfig,
} from './providers';
import {
  formatMessagesForAnthropic,
  formatMessagesForGemini,
  formatMessagesForOpenAI,
  type ClientMessage,
} from './adapters';
import { pipeSseEvents, sseWrite } from './sse';

export function trimUpstreamError(text: string, max = 300): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/**
 * DeepSeek API specifics (api-docs.deepseek.com):
 * - temperature is clamped/ignored (thinking: 0.95–1.0; non-thinking: fixed 1.0) → don't send it
 * - thinking mode is ON by default (effort high); reasoning_effort=none disables it
 * - reasoning deltas stream as `reasoning_content` (ignored by our parser — only `content` is forwarded)
 */
function applyDeepSeekParams(reqBody: any, config: ResolvedAIConfig): void {
  if (config.provider !== 'deepseek') return;
  delete reqBody.temperature;
  if (config.reasoningEffort) {
    reqBody.reasoning_effort = config.reasoningEffort;
    if (config.reasoningEffort === 'none') {
      reqBody.thinking = { type: 'disabled' };
    }
  }
}

/** SSE write that silently stops once the client has disconnected. */
export async function streamUnifiedChat(
  config: ResolvedAIConfig,
  messages: ClientMessage[],
  systemInstruction: string,
  res: Response,
  abortSignal?: AbortSignal
) {
  const { provider, apiKey, model, baseUrl } = config;
  const upstreamSignal = abortSignal
    ? AbortSignal.any([abortSignal, AbortSignal.timeout(180_000)])
    : AbortSignal.timeout(180_000);

  if (provider === 'gemini') {
    // Single key: resolveAIConfig already applied the server env fallback when the
    // client sent no key. A client key is never "rescued" by the server key (quota theft).
    const contents = formatMessagesForGemini(messages);
    const candidateModels = [model, ...GEMINI_FAST_MODELS.filter((m) => m !== model)];

    let streamResult: any = null;
    let usedModel = model;
    let lastError: any = null;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'si-driss-universal' },
      },
    });

    for (const mod of candidateModels) {
      try {
        const stream = await ai.models.generateContentStream({
          model: mod,
          contents,
          config: {
            systemInstruction,
            temperature: 0.1,
            abortSignal: upstreamSignal,
          },
        });
        streamResult = stream;
        usedModel = mod;
        break;
      } catch (err: any) {
        console.warn(`[Gemini Stream] Failover from ${mod}:`, trimUpstreamError(err?.message || ''));
        lastError = err;
        // Invalid key: no point trying other models
        if (err?.message?.includes('API_KEY_INVALID') || err?.status === 400 || err?.status === 403) {
          break;
        }
      }
    }

    if (!streamResult) {
      throw lastError || new Error('Erreur de connexion Gemini.');
    }

    console.log(`[Stream] Provider: gemini | Model: ${usedModel}`);
    for await (const chunk of streamResult) {
      if (res.writableEnded || res.destroyed) break;
      const text = chunk.text;
      if (text) {
        sseWrite(res, { text });
      }
    }
    return;
  }

  if (provider === 'anthropic') {
    const targetUrl = `${(baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '')}/messages`;
    const anthropicMessages = formatMessagesForAnthropic(messages);

    const apiRes = await fetch(targetUrl, {
      method: 'POST',
      signal: upstreamSignal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemInstruction,
        messages: anthropicMessages,
        stream: true,
        temperature: 0.1,
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      throw new Error(`Erreur Anthropic (${apiRes.status}): ${trimUpstreamError(errText)}`);
    }

    if (!apiRes.body) throw new Error('Corps de réponse Anthropic vide.');

    // (Architecture) Parser SSE partagé — plus de boucle de lecture dupliquée
    await pipeSseEvents(apiRes.body, {
      shouldStop: () => res.writableEnded || res.destroyed,
      onEvent: (parsed) => {
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          sseWrite(res, { text: parsed.delta.text });
        }
      },
    });
    return;
  }

  // OpenAI-compatible providers (Groq, OpenAI, Mistral, DeepSeek, OpenRouter, Custom/Ollama)
  const rootUrl = (baseUrl || DEFAULT_BASE_URLS[provider] || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const targetUrl = rootUrl.endsWith('/chat/completions') ? rootUrl : `${rootUrl}/chat/completions`;

  const openAiMessages = formatMessagesForOpenAI(messages, systemInstruction);

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    reqHeaders['Authorization'] = `Bearer ${apiKey}`;
  }
  if (provider === 'openrouter') {
    reqHeaders['HTTP-Referer'] = 'https://sidriss-bac.maroc';
    reqHeaders['X-Title'] = 'Si Driss Bac BIOF';
  }

  console.log(`[Stream] Provider: ${provider} | Model: ${model} | Endpoint: ${targetUrl}`);

  const streamBody: any = {
    model,
    messages: openAiMessages,
    stream: true,
    temperature: 0.1,
  };
  applyDeepSeekParams(streamBody, config);

  const apiRes = await fetch(targetUrl, {
    method: 'POST',
    signal: upstreamSignal,
    headers: reqHeaders,
    body: JSON.stringify(streamBody),
  });

  if (!apiRes.ok) {
    const errText = await apiRes.text();
    throw new Error(`Erreur ${provider.toUpperCase()} (${apiRes.status}): ${trimUpstreamError(errText)}`);
  }

  if (!apiRes.body) throw new Error('Corps de flux vide.');

  // (Architecture) Parser SSE partagé — plus de boucle de lecture dupliquée
  await pipeSseEvents(apiRes.body, {
    shouldStop: () => res.writableEnded || res.destroyed,
    onEvent: (parsed) => {
      const chunkText = parsed.choices?.[0]?.delta?.content || '';
      if (chunkText) {
        sseWrite(res, { text: chunkText });
      }
    },
  });
}

export async function generateUnifiedCompletion(
  config: ResolvedAIConfig,
  messages: ClientMessage[],
  systemInstruction: string,
  jsonMode: boolean = false
): Promise<{ text: string; model: string }> {
  const { provider, apiKey, model, baseUrl } = config;

  if (provider === 'gemini') {
    const contents = formatMessagesForGemini(messages);
    const candidateModels = [model, ...GEMINI_FAST_MODELS.filter((m) => m !== model)];

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'si-driss-universal' },
      },
    });

    let lastError: any = null;
    for (const mod of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: mod,
          contents,
          config: {
            systemInstruction,
            temperature: 0.1,
            responseMimeType: jsonMode ? 'application/json' : undefined,
          },
        });
        return { text: response.text || '', model: mod };
      } catch (err: any) {
        console.warn(`[Gemini Complete] Failover from ${mod}:`, trimUpstreamError(err?.message || ''));
        lastError = err;
        if (err?.message?.includes('API_KEY_INVALID') || err?.status === 400 || err?.status === 403) {
          break;
        }
      }
    }
    throw lastError || new Error('Erreur de génération Gemini.');
  }

  if (provider === 'anthropic') {
    const targetUrl = `${(baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '')}/messages`;
    const anthropicMessages = formatMessagesForAnthropic(messages);

    const apiRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemInstruction + (jsonMode ? '\n\nIMPORTANT: Réponds EXCLUSIVEMENT au format JSON valide.' : ''),
        messages: anthropicMessages,
        temperature: 0.1,
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      throw new Error(`Erreur Anthropic (${apiRes.status}): ${trimUpstreamError(errText)}`);
    }

    const data: any = await apiRes.json();
    const text = data.content?.[0]?.text || '';
    return { text, model };
  }

  // OpenAI-compatible providers
  const rootUrl = (baseUrl || DEFAULT_BASE_URLS[provider] || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const targetUrl = rootUrl.endsWith('/chat/completions') ? rootUrl : `${rootUrl}/chat/completions`;

  const openAiMessages = formatMessagesForOpenAI(messages, systemInstruction);

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    reqHeaders['Authorization'] = `Bearer ${apiKey}`;
  }
  if (provider === 'openrouter') {
    reqHeaders['HTTP-Referer'] = 'https://sidriss-bac.maroc';
    reqHeaders['X-Title'] = 'Si Driss Bac BIOF';
  }

  const reqBody: any = {
    model,
    messages: openAiMessages,
    temperature: 0.1,
  };
  applyDeepSeekParams(reqBody, config);

  if (jsonMode) {
    // Some local models or deepseek reasoners don't support response_format, so append instruction
    reqBody.response_format = { type: 'json_object' };
  }

  console.log(`[Complete] Provider: ${provider} | Model: ${model} | Endpoint: ${targetUrl}`);

  const apiRes = await fetch(targetUrl, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(reqBody),
  });

  if (!apiRes.ok) {
    // If json_object was rejected, retry without it — appending a separate instruction
    // message instead of mutating messages[0].content (which can be a multimodal array)
    if (jsonMode && apiRes.status === 400) {
      delete reqBody.response_format;
      reqBody.messages = [
        ...openAiMessages,
        { role: 'user', content: 'IMPORTANT: Réponds UNIQUEMENT avec un objet JSON pur sans balise markdown.' },
      ];
      const retryRes = await fetch(targetUrl, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(reqBody),
      });
      if (retryRes.ok) {
        const retryData: any = await retryRes.json();
        return { text: retryData.choices?.[0]?.message?.content || '', model };
      }
    }

    const errText = await apiRes.text();
    throw new Error(`Erreur ${provider.toUpperCase()} (${apiRes.status}): ${trimUpstreamError(errText)}`);
  }

  const data: any = await apiRes.json();
  const text = data.choices?.[0]?.message?.content || '';
  return { text, model };
}
