import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { PDFParse } from 'pdf-parse';
import { rateLimit } from 'express-rate-limit';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Trust a single reverse-proxy hop (Nginx/Cloud Run) so rate limiting sees real client IPs
app.set('trust proxy', 1);

app.use(express.json({ limit: '25mb' }));

// -----------------------------------------------------------------------------
// Security Middleware: Rate Limiting, Access Gate & Admin Gate
// -----------------------------------------------------------------------------

const RATE_LIMIT_MSG = { error: 'Trop de requêtes. Réessaie dans quelques minutes, lah yerdi 3lik.' };

const apiLimiter = rateLimit({
  windowMs: 5 * 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MSG,
});

const validateKeyLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MSG,
});

const documentMutationLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MSG,
});

app.use('/api/', apiLimiter);

// Optional classroom access token: when SI_DRISS_ACCESS_TOKEN is set, every /api/*
// route (except the harmless status probe) requires the matching x-access-token header.
const ACCESS_TOKEN = (process.env.SI_DRISS_ACCESS_TOKEN || '').trim();
app.use('/api/', (req, res, next) => {
  if (!ACCESS_TOKEN) return next();
  if (req.path === '/ai-status') return next();
  const provided = String(req.headers['x-access-token'] || '');
  if (provided && provided === ACCESS_TOKEN) return next();
  return res.status(401).json({
    error: 'ACCESS_TOKEN_REQUIRED',
    message: 'Mot de passe de classe requis. Ajoute ?token=... à l’URL ou contacte ton professeur.',
  });
});

// Document mutation (upload/delete) requires ADMIN_TOKEN. In local development with no
// ADMIN_TOKEN configured, mutations stay open (single-user machine); in production they
// are refused until the admin configures a token.
const ADMIN_TOKEN = (process.env.ADMIN_TOKEN || '').trim();
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!ADMIN_TOKEN) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        error: 'Gestion des documents désactivée : configurez la variable ADMIN_TOKEN côté serveur.',
      });
    }
    return next();
  }
  const provided = String(req.headers['x-admin-token'] || '');
  if (provided && provided === ADMIN_TOKEN) return next();
  return res.status(401).json({ error: 'Jeton administrateur requis (en-tête x-admin-token).' });
}

// -----------------------------------------------------------------------------
// Universal AI Provider Configuration & Sanitation
// -----------------------------------------------------------------------------
export type SupportedProvider =
  | 'gemini'
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'mistral'
  | 'openrouter'
  | 'custom';

function sanitizeApiKey(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u2028\u2029]/g, '')
    .replace(/^(export\s+)?([A-Z0-9_]*API_KEY|[A-Z0-9_]*TOKEN)\s*[:=]\s*/i, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/^["'`«“‘]+|["'`»”’]+$/g, '')
    .replace(/\s+/g, '')
    .trim();
}

const DEFAULT_MODELS: Record<SupportedProvider, string> = {
  gemini: 'gemini-3.5-flash-lite',
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
  deepseek: 'deepseek-flash',
  mistral: 'mistral-small-latest',
  openrouter: 'google/gemini-3.8-flash',
  custom: 'llama3.3',
};

const DEFAULT_BASE_URLS: Partial<Record<SupportedProvider, string>> = {
  groq: 'https://api.groq.com/openai/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  // Canonical DeepSeek endpoint (no /v1): https://api.deepseek.com/chat/completions
  deepseek: 'https://api.deepseek.com',
  mistral: 'https://api.mistral.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  custom: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
};

// Legacy DeepSeek model names (V3/R1 era) remapped to the current catalog
const LEGACY_DEEPSEEK_MODELS: Record<string, string> = {
  'deepseek-chat': 'deepseek-flash',
  'deepseek-reasoner': 'deepseek-flash',
};

const DEEPSEEK_REASONING_EFFORTS = new Set(['none', 'low', 'high', 'max', 'minimal', 'medium', 'xhigh']);

// Candidate models for Gemini fallback (sub-second responsive models prioritized)
const GEMINI_FAST_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
];

const DEPRECATED_OR_SLOW_GEMINI_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-3.8-flash',
  'gemini-flash-latest',
]);

interface ResolvedAIConfig {
  provider: SupportedProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  /** True when the client sent its own key (vs. server env fallback). Server keys must never be sent to client-chosen URLs. */
  clientProvidedKey: boolean;
  /** DeepSeek thinking-mode effort: none/low/high/max (aliases accepted). Undefined = API default (enabled, high). */
  reasoningEffort?: string;
}

/**
 * SSRF guard: custom/local providers (Ollama) may only target loopback, RFC1918
 * or host.docker.internal endpoints over http(s).
 */
function isAllowedLocalBaseUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === 'host.docker.internal' || host === '::1' || host === '[::1]') {
      return true;
    }
    const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a > 255 || b > 255 || Number(m[3]) > 255 || Number(m[4]) > 255) return false;
      if (a === 127 || a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function resolveAIConfig(req: express.Request): ResolvedAIConfig {
  const headerProvider = (req.headers['x-ai-provider'] as string) || '';
  const bodyProvider = (req.body?.provider as string) || '';

  // Determine provider: Client header -> Client body -> Env default -> Auto-detect from env keys
  let provider = (headerProvider || bodyProvider || process.env.AI_PROVIDER || '').toLowerCase() as SupportedProvider;

  if (!provider || !DEFAULT_MODELS[provider]) {
    if (process.env.GEMINI_API_KEY) provider = 'gemini';
    else if (process.env.GROQ_API_KEY) provider = 'groq';
    else if (process.env.OPENAI_API_KEY) provider = 'openai';
    else if (process.env.ANTHROPIC_API_KEY) provider = 'anthropic';
    else if (process.env.DEEPSEEK_API_KEY) provider = 'deepseek';
    else if (process.env.MISTRAL_API_KEY) provider = 'mistral';
    else if (process.env.OPENROUTER_API_KEY) provider = 'openrouter';
    else if (process.env.OLLAMA_BASE_URL) provider = 'custom';
    else provider = 'gemini';
  }

  // Extract key
  const headerKey = (req.headers['x-ai-key'] as string) || (req.headers['x-gemini-api-key'] as string) || '';
  const bodyKey = (req.body?.apiKey as string) || '';
  const clientProvidedKey = sanitizeApiKey(headerKey || bodyKey);
  let apiKey = clientProvidedKey;

  // Fallback to provider-specific or generic env key if not passed by client
  if (!apiKey) {
    switch (provider) {
      case 'gemini':
        apiKey = sanitizeApiKey(process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '');
        break;
      case 'groq':
        apiKey = sanitizeApiKey(process.env.GROQ_API_KEY || process.env.AI_API_KEY || '');
        break;
      case 'openai':
        apiKey = sanitizeApiKey(process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '');
        break;
      case 'anthropic':
        apiKey = sanitizeApiKey(process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY || '');
        break;
      case 'deepseek':
        apiKey = sanitizeApiKey(process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY || '');
        break;
      case 'mistral':
        apiKey = sanitizeApiKey(process.env.MISTRAL_API_KEY || process.env.AI_API_KEY || '');
        break;
      case 'openrouter':
        apiKey = sanitizeApiKey(process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY || '');
        break;
      case 'custom':
        apiKey = sanitizeApiKey(process.env.CUSTOM_API_KEY || process.env.AI_API_KEY || '');
        break;
    }
  }

  // Model
  const headerModel = (req.headers['x-ai-model'] as string) || '';
  const bodyModel = (req.body?.model as string) || '';
  let model = headerModel || bodyModel || process.env.AI_MODEL || DEFAULT_MODELS[provider] || 'gemini-3.5-flash-lite';
  if (provider === 'gemini' && (DEPRECATED_OR_SLOW_GEMINI_MODELS.has(model) || !model.startsWith('gemini-'))) {
    model = 'gemini-3.5-flash-lite';
  }
  // Remap retired DeepSeek model names (V3/R1 era) to the current catalog
  if (provider === 'deepseek' && LEGACY_DEEPSEEK_MODELS[model]) {
    model = LEGACY_DEEPSEEK_MODELS[model];
  }

  // DeepSeek thinking-mode effort control (header/body/env), validated against the API vocabulary
  let reasoningEffort: string | undefined;
  if (provider === 'deepseek') {
    const rawEffort = String(
      (req.headers['x-ai-reasoning-effort'] as string) ||
        req.body?.reasoningEffort ||
        process.env.DEEPSEEK_REASONING_EFFORT ||
        ''
    )
      .toLowerCase()
      .trim();
    if (rawEffort && DEEPSEEK_REASONING_EFFORTS.has(rawEffort)) {
      reasoningEffort = rawEffort;
    }
  }

  // Base URL — SSRF protection:
  // A client-supplied baseUrl is honored ONLY (a) for the local `custom` provider and
  // restricted to loopback/RFC1918 hosts, or (b) when the client also supplied its OWN
  // API key (BYOK against their own gateway). A server env key is never sent to a
  // client-chosen URL.
  const headerBaseUrl = (req.headers['x-ai-base-url'] as string) || '';
  const bodyBaseUrl = (req.body?.baseUrl as string) || '';
  const clientBaseUrl = headerBaseUrl || bodyBaseUrl;

  if (clientBaseUrl) {
    if (provider === 'custom') {
      if (!isAllowedLocalBaseUrl(clientBaseUrl)) {
        const error: any = new Error(
          'URL locale non autorisée : seuls localhost / réseau privé (Ollama) sont acceptés pour le fournisseur Custom.'
        );
        error.code = 'INVALID_BASE_URL';
        error.statusCode = 400;
        throw error;
      }
    } else if (!clientProvidedKey) {
      const error: any = new Error(
        'URL personnalisée interdite sans clé API client : fournis ta propre clé pour utiliser une passerelle personnalisée.'
      );
      error.code = 'BASE_URL_REQUIRES_CLIENT_KEY';
      error.statusCode = 400;
      throw error;
    }
  }

  const baseUrl = clientBaseUrl || process.env.AI_BASE_URL || DEFAULT_BASE_URLS[provider] || '';

  // Validation: Custom/Local endpoints don't strictly require a key
  if (provider !== 'custom' && !apiKey) {
    const error: any = new Error(
      `Clé API requise pour le fournisseur ${provider.toUpperCase()}. Renseignez votre clé ou configurez une variable d'environnement.`
    );
    error.code = 'API_KEY_REQUIRED';
    error.statusCode = 401;
    throw error;
  }

  return { provider, apiKey, model, baseUrl, clientProvidedKey: Boolean(clientProvidedKey), reasoningEffort };
}

// -----------------------------------------------------------------------------
// Message Adapters for Multi-Provider AI
// -----------------------------------------------------------------------------
interface ClientAttachment {
  name?: string;
  type?: string;
  mimeType?: string;
  data?: string;
  text?: string;
}

interface ClientMessage {
  role: string;
  content: string;
  attachments?: ClientAttachment[];
}

function formatMessagesForGemini(messages: ClientMessage[]) {
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

function formatMessagesForOpenAI(messages: ClientMessage[], systemInstruction: string) {
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

function formatMessagesForAnthropic(messages: ClientMessage[]) {
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

// -----------------------------------------------------------------------------
// Unified AI Generation & Streaming Core
// -----------------------------------------------------------------------------

/** Truncates upstream provider error bodies before they reach logs or clients. */
function trimUpstreamError(text: string, max = 300): string {
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
function sseWrite(res: express.Response, payload: object): void {
  if (res.writableEnded || res.destroyed) return;
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {}
}

async function streamUnifiedChat(
  config: ResolvedAIConfig,
  messages: ClientMessage[],
  systemInstruction: string,
  res: express.Response,
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

    const reader = apiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      if (res.writableEnded || res.destroyed) {
        reader.cancel().catch(() => {});
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const rawData = line.slice(6).trim();
          if (rawData === '[DONE]') break;
          try {
            const parsed = JSON.parse(rawData);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              sseWrite(res, { text: parsed.delta.text });
            }
          } catch {}
        }
      }
    }
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

  const reader = apiRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    if (res.writableEnded || res.destroyed) {
      reader.cancel().catch(() => {});
      break;
    }
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const rawData = line.slice(6).trim();
        if (rawData === '[DONE]') break;
        try {
          const parsed = JSON.parse(rawData);
          const chunkText = parsed.choices?.[0]?.delta?.content || '';
          if (chunkText) {
            sseWrite(res, { text: chunkText });
          }
        } catch {}
      }
    }
  }
}

async function generateUnifiedCompletion(
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

// -----------------------------------------------------------------------------
// Documents Directory for Moroccan 2nd Bac Curriculum
// -----------------------------------------------------------------------------
const DOCS_DIR = path.resolve(__dirname, 'docs', 'programme');
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

interface CachedDocSection {
  raw: string;
  lower: string;
}

interface CachedDoc {
  name: string;
  mtime: number;
  sections: CachedDocSection[];
}

let documentsCache: CachedDoc[] = [];
let lastCacheRefreshTime = 0;

function refreshDocumentsCache() {
  const now = Date.now();
  if (now - lastCacheRefreshTime < 4000) return;
  lastCacheRefreshTime = now;

  try {
    if (!fs.existsSync(DOCS_DIR)) return;
    const files = fs.readdirSync(DOCS_DIR).filter((f) => !f.endsWith('.extracted.txt'));

    const updatedCache: CachedDoc[] = [];

    for (const file of files) {
      const filePath = path.join(DOCS_DIR, file);
      const stat = fs.statSync(filePath);
      const existing = documentsCache.find((d) => d.name === file && d.mtime === stat.mtimeMs);

      if (existing) {
        updatedCache.push(existing);
        continue;
      }

      let content = '';
      if (file.toLowerCase().endsWith('.pdf')) {
        const txtPath = path.join(DOCS_DIR, `${file}.extracted.txt`);
        if (fs.existsSync(txtPath)) {
          content = fs.readFileSync(txtPath, 'utf-8');
        }
      } else if (file.endsWith('.md') || file.endsWith('.txt') || file.endsWith('.json')) {
        content = fs.readFileSync(filePath, 'utf-8');
      }

      if (content) {
        const rawSections = content.split(/\n#{1,3}\s+|\n\n+/).filter((s) => s.trim().length > 20);
        const sections: CachedDocSection[] = rawSections.map((s) => ({
          raw: s.trim().slice(0, 800),
          lower: s.toLowerCase(),
        }));
        updatedCache.push({ name: file, mtime: stat.mtimeMs, sections });
      }
    }
    documentsCache = updatedCache;
  } catch (err) {
    console.warn('Erreur rafraîchissement cache documents:', err);
  }
}

function searchLocalDocuments(query: string): string {
  try {
    refreshDocumentsCache();
    if (!documentsCache.length) return '';

    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (keywords.length === 0) return '';

    const matchedSnippets: { score: number; text: string }[] = [];

    for (const doc of documentsCache) {
      for (const sec of doc.sections) {
        let score = 0;
        for (const kw of keywords) {
          if (sec.lower.includes(kw)) {
            score++;
          }
        }
        if (score > 0) {
          matchedSnippets.push({
            score,
            text: `[Source officielle: ${doc.name}]\n${sec.raw}`,
          });
        }
      }
    }

    if (matchedSnippets.length > 0) {
      matchedSnippets.sort((a, b) => b.score - a.score);
      return matchedSnippets.slice(0, 3).map((s) => s.text).join('\n\n---\n\n');
    }
  } catch (err) {
    console.warn('Erreur recherche documents:', err);
  }
  return '';
}

// -----------------------------------------------------------------------------
// Pedagogical Guidelines & Moroccan Curriculum Prompt
// -----------------------------------------------------------------------------
function getSiDrissBasePrompt(branch: 'PC' | 'SM' = 'PC'): string {
  const branchName = branch === 'SM' ? 'Sciences Mathématiques (2ème Bac SM)' : 'Sciences Physiques (2ème Bac PC)';
  const syllabusSpecifics = branch === 'SM'
    ? `CADRE DE RÉFÉRENCE OFFICIEL SPÉCIFIQUE 2ÈME BAC SCIENCES MATHÉMATIQUES (SM) :
- SPÉCIFICITÉS DU PROGRAMME SM :
  * Rotation d'un solide indéformable autour d'un axe fixe : Relation fondamentale de la dynamique (RFD) $\\sum M_\\Delta(\\vec{F}) = J_\\Delta \\ddot{\\theta}$, moment d'inertie $J_\\Delta$, énergie cinétique $E_c = \\frac{1}{2}J_\\Delta \\dot{\\theta}^2$, condition de non-glissement de fils sur poulies ($a = R\\ddot{\\theta}$, $v = R\\dot{\\theta}$).
  * Oscillations mécaniques forcées en régime sinusoïdal : excitateur, résonateur, résonance d'amplitude et de vitesse, influence du frottement fluide.
  * Oscillations électriques forcées dans un circuit RLC série (GBF sinusoïdal) : impédance électrique $Z = \\sqrt{R_t^2 + (L\\omega - \\frac{1}{C\\omega})^2}$, déphasage $\\tan\\varphi = \\frac{L\\omega - \\frac{1}{C\\omega}}{R_t}$, facteur de qualité $Q = \\frac{L\\omega_0}{R_t}$, bande passante à $-3\\text{ dB}$ : $\\Delta N = \\frac{N_0}{Q} = \\frac{R_t}{2\\pi L}$, surtension aux bornes du condensateur ($U_{C,max} = Q\\cdot U$).
  * Rigueur mathématique accrue : équations différentielles d'ordre 2, résolution analytique détaillée, projections trigonométriques.
- EXCLUSIONS DU PROGRAMME SM :
  * La modulation d'amplitude (AM) N'EST PAS au programme des Sciences Mathématiques (elle est exclusive aux PC). Ne propose jamais la modulation AM à un élève SM.`
    : `CADRE DE RÉFÉRENCE OFFICIEL SPÉCIFIQUE 2ÈME BAC SCIENCES PHYSIQUES (PC) :
- SPÉCIFICITÉS DU PROGRAMME PC :
  * Modulation d'amplitude AM : taux de modulation $m = \\frac{S_m}{U_0}$, condition de bonne modulation ($m < 1$ et $F_p \\gg f_s$), méthode du trapèze et démodulation (détecteur d'enveloppe, filtre RC et filtre passe-haut).
  * Mécanique : translation et chute libre/verticale, projectiles, satellites, oscillateurs harmoniques amortis (RLC libre, pendule élastique).
- EXCLUSIONS DU PROGRAMME PC :
  * La rotation du solide autour d'un axe fixe (RFD avec $J_\\Delta \\ddot{\\theta}$) et les oscillations forcées (RLC régime sinusoïdal forcé avec impédance $Z$ et bande passante à -3 dB) NE SONT PAS au programme PC (réservées aux SM).`;

  return `Tu es Si Driss (ou "Prof Driss"), un professeur émérite, hautement rigoureux et respecté de Physique-Chimie au lycée au Maroc, formateur et correcteur officiel du Baccalauréat marocain (2ème Année Bac BIOF).
BRANCHE DE L'ÉLÈVE ACTUELLEMENT SUIVIE : ${branchName}.

${syllabusSpecifics}

TON STYLE, IDENTITÉ & EXIGENCE PÉDAGOGIQUE :
- Rigueur scientifique absolue : tu ne tolères aucun à-peu-près, aucune formule erronée et aucune approximation de calcul.
- Clarté, précision mathématique et pédagogie exemplaire : bienveillant, paternel mais exigeant comme le jour de l'examen ("Tbarkellah 3lik", "Rkkez m3aya f had l-étape", "Lah yerdi 3lik", "3andak had l-piège !").
- Toutes les formules mathématiques et physiques doivent être écrites en LaTeX impeccable ($...$ en ligne, $$...$$ pour les équations majeures).
- Conforme à 100% au Cadre de Référence officiel du Ministère de l'Éducation Nationale marocain pour la session normale et de rattrapage.

================================================================================
CONSIGNE CRITIQUE N°1 : INTERDICTION FORMELLE D'INVENTER DES DONNÉES OU DES RÉPONSES
================================================================================
- Si un exercice soumis par l'élève (texte saisi, document PDF ou photo/capture d'écran) ne contient pas toutes les valeurs numériques nécessaires (ex. : concentration $C$, volume $V$, masse $m$, inductance $L$, résistance $R$, constante de raideur $k$, longueur d'onde $\\lambda$, masse molaire $M$, constante $g$, ou graduation illisible sur une courbe) :
  1. TU NE DOIS SOUS AUCUN PRÉTEXTE INVENTER UN NOMBRE, NI POSER UNE VALEUR ARBITRAIRE EN FAISANT CROIRE QU'ELLE EST DANS L'ÉNONCÉ.
  2. Tu dois IMMÉDIATEMENT signaler avec précision la donnée manquante ou incertaine :
     « ⚠️ **Donnée manquante dans l'énoncé :** La valeur numérique de [nom de la grandeur] n'est pas précisée dans l'énoncé ou sur le document fourni. »
  3. Tu dois poser l'EXPRESSION LITTÉRALE EXACTE ET COMPLÈTE ($X = \\dots$) prête pour l'application numérique.
  4. Tu montres à l'élève comment conclure dès qu'il fournit la donnée manquante.

================================================================================
CONSIGNE CRITIQUE N°2 : PROTOCOLE D'EXCELLENCE POUR LA RÉSOLUTION (ZÉRO ERREUR)
================================================================================
À chaque question ou résolution d'exercice, applique strictement la méthode canonique du barème national en 4 étapes numérotées :
1. Énonciation du Principe & Justification théorique (Système, Référentiel, Forces / Convention récepteur / Équation bilan).
2. Expression littérale isolée avant calcul.
3. Conversions SI détaillées et application numérique rigoureuse.
4. Contrôle de cohérence physique et résultat final mis en gras (sans utiliser \\boxed ni cadre).
`;
}

function getInstruction(mode: string, socraticEnabled: boolean, matchedDocs: string, branch: 'PC' | 'SM' = 'PC', context?: string) {
  let extra = '';
  if (!socraticEnabled || mode === 'direct') {
    extra = `\nMODE ACTIF : RÉSOLUTION DIRECTE & COURS RIGOUROUX (DÉMARCHE SOCRATIQUE DÉSACTIVÉE).
L'élève de 2ème Bac ${branch} attend une réponse immédiate, complète, scientifiquement irréprochable et vérifiée.`;
  } else if (mode === 'socratic') {
    extra = `\nMODE ACTIF : COACHING SOCRATIQUE POUR ÉLÈVE 2ÈME BAC ${branch}.
L'élève résout un problème. Pose UNE question directrice ciblée pour le guider sur l'étape logique suivante sans donner la solution brute d'emblée. Exige une justification rigoureuse.`;
  } else if (mode === 'review') {
    extra = `\nMODE ACTIF : AUDIT DE RÉDACTION TYPE NATIONAL 2ÈME BAC ${branch}. Analyse la réponse selon la grille officielle : 1) Système/Référentiel/Forces, 2) Formule littérale, 3) Valeur & CS, 4) Unité SI.`;
  } else if (mode === 'trap') {
    extra = `\nMODE ACTIF : CHASSE AUX PIÈGES DU NATIONAL 2ÈME BAC ${branch}. Pose un piège récurrent du National pour la section ${branch}.`;
  }

  let full = getSiDrissBasePrompt(branch) + extra;
  if (matchedDocs) {
    full += `\n\nEXTRAITS OFFICIELS EXTRAITS DES DOCUMENTS DU PROGRAMME DÉPOSÉS DANS /docs/programme/ :\n${matchedDocs}\nUtilise prioritairement ces extraits.`;
  }
  if (context) {
    full += `\n\nCONTEXTE ACTUEL :\n${context}`;
  }
  return full;
}

// -----------------------------------------------------------------------------
// Universal API Routes
// -----------------------------------------------------------------------------

// Server status: informs the frontend if server-side default key is present
app.get('/api/ai-status', (_req, res) => {
  const serverKey =
    process.env.GEMINI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.MISTRAL_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.AI_API_KEY ||
    '';

  const serverProvider =
    process.env.AI_PROVIDER ||
    (process.env.GROQ_API_KEY
      ? 'groq'
      : process.env.OPENAI_API_KEY
      ? 'openai'
      : process.env.ANTHROPIC_API_KEY
      ? 'anthropic'
      : process.env.GEMINI_API_KEY
      ? 'gemini'
      : process.env.OLLAMA_BASE_URL
      ? 'custom'
      : '');

  return res.json({
    serverConfigured: Boolean(serverKey || process.env.OLLAMA_BASE_URL),
    serverProvider: serverProvider || 'none',
    serverModel: process.env.AI_MODEL || '',
  });
});

// Key & Connection Validator (Universal for all providers)
app.post('/api/validate-key', validateKeyLimiter, async (req, res) => {
  try {
    const rawProvider = (req.headers['x-ai-provider'] || req.body?.provider || 'gemini') as string;
    const provider = rawProvider.toLowerCase() as SupportedProvider;

    const rawKey = (
      (req.headers['x-ai-key'] as string) ||
      (req.headers['x-gemini-api-key'] as string) ||
      req.body?.apiKey ||
      ''
    ).trim();
    const apiKey = sanitizeApiKey(rawKey);

    const model = (req.headers['x-ai-model'] || req.body?.model || DEFAULT_MODELS[provider]) as string;
    const baseUrl = (req.headers['x-ai-base-url'] || req.body?.baseUrl || DEFAULT_BASE_URLS[provider] || '') as string;

    // SSRF guard: local/custom endpoints only, loopback/RFC1918 hosts
    if (provider === 'custom' && baseUrl && !isAllowedLocalBaseUrl(baseUrl)) {
      return res.status(400).json({
        valid: false,
        error: 'URL locale non autorisée : seuls localhost / réseau privé (Ollama) sont acceptés.',
      });
    }

    if (provider !== 'custom' && !apiKey) {
      return res.status(400).json({ valid: false, error: `Veuillez saisir votre clé API pour ${provider}.` });
    }

    const testConfig: ResolvedAIConfig = {
      provider,
      apiKey,
      model,
      baseUrl,
      clientProvidedKey: Boolean(apiKey),
    };

    const testMessages: ClientMessage[] = [{ role: 'user', content: 'Bonjour' }];

    try {
      const result = await generateUnifiedCompletion(
        testConfig,
        testMessages,
        'Tu es un assistant de test. Réponds brièvement "OK".'
      );

      return res.json({
        valid: true,
        modelTested: result.model,
        providerTested: provider,
        message: `Fournisseur ${provider.toUpperCase()} connecté avec succès avec le modèle ${result.model} ! Tbarkellah 3lik.`,
      });
    } catch (testErr: any) {
      const errMsg = trimUpstreamError(testErr?.message || '');

      // If rate limited (429), provider recognized key as authentic!
      if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
        return res.json({
          valid: true,
          modelTested: model,
          providerTested: provider,
          message: `Clé ${provider.toUpperCase()} reconnue et authentifiée ! (Quota en attente de réinitialisation).`,
        });
      }

      console.warn(`[Validate Key] Error testing ${provider}:`, errMsg);
      return res.status(400).json({
        valid: false,
        error: `Erreur de connexion avec ${provider.toUpperCase()} : ${errMsg}`,
        canSaveAnyway: true,
      });
    }
  } catch (err: any) {
    return res.status(400).json({
      valid: false,
      error: err?.message || 'Erreur inattendue lors de la vérification.',
    });
  }
});

// Streaming Chat (Server-Sent Events)
app.post('/api/chat/stream', async (req, res) => {
  let aiConfig: ResolvedAIConfig;
  try {
    aiConfig = resolveAIConfig(req);
  } catch (keyErr: any) {
    return res.status(401).json({
      error: 'API_KEY_REQUIRED',
      message: keyErr?.message || 'Veuillez configurer une clé API pour continuer.',
    });
  }

  try {
    const { messages, context, mode, socraticEnabled = true, branch = 'PC' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Format invalide.' });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    let searchTerms = lastUser?.content || '';
    if (lastUser?.attachments && Array.isArray(lastUser.attachments)) {
      for (const att of lastUser.attachments) {
        if (att.name) searchTerms += ' ' + att.name;
        if (att.text) searchTerms += ' ' + att.text.slice(0, 200);
      }
    }
    const matchedDocs = searchLocalDocuments(searchTerms);
    const fullInstruction = getInstruction(mode, socraticEnabled, matchedDocs, branch, context);

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(': ping\n\n');

    // Abort upstream provider requests the moment the client disconnects
    const disconnectController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) disconnectController.abort();
    });

    const heartbeat = setInterval(() => {
      try {
        if (!res.writableEnded && !res.destroyed) res.write(': keepalive\n\n');
      } catch {}
    }, 10000);

    try {
      await streamUnifiedChat(aiConfig, messages, fullInstruction, res, disconnectController.signal);
    } finally {
      clearInterval(heartbeat);
    }

    if (!res.writableEnded && !res.destroyed) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err: any) {
    console.warn('Erreur API Chat Stream:', err?.message || err);
    sseWrite(res, { error: trimUpstreamError(err?.message || 'Erreur de flux') });
    if (!res.writableEnded && !res.destroyed) res.end();
  }
});

// Fallback Standard Non-Streaming Chat
app.post('/api/chat', async (req, res) => {
  let aiConfig: ResolvedAIConfig;
  try {
    aiConfig = resolveAIConfig(req);
  } catch (keyErr: any) {
    return res.status(401).json({
      error: 'API_KEY_REQUIRED',
      message: keyErr?.message || 'Clé API requise.',
    });
  }

  try {
    const { messages, context, mode, socraticEnabled = true, branch = 'PC' } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Format invalide.' });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    let searchTerms = lastUser?.content || '';
    if (lastUser?.attachments && Array.isArray(lastUser.attachments)) {
      for (const att of lastUser.attachments) {
        if (att.name) searchTerms += ' ' + att.name;
        if (att.text) searchTerms += ' ' + att.text.slice(0, 200);
      }
    }
    const matchedDocs = searchLocalDocuments(searchTerms);
    const fullInstruction = getInstruction(mode, socraticEnabled, matchedDocs, branch, context);

    const { text, model } = await generateUnifiedCompletion(aiConfig, messages, fullInstruction, false);

    const reply = text || "Désolé mon élève, peux-tu reformuler ta question, lah yerdi 3lik ?";
    return res.json({ reply, sourceDocs: Boolean(matchedDocs), modelUsed: model });
  } catch (err: any) {
    console.error('Erreur API Chat:', err);
    return res.status(500).json({
      error: 'Erreur lors de la communication avec Si Driss.',
      details: trimUpstreamError(err?.message || String(err)),
    });
  }
});

// Exam Evaluation & Grading Endpoint
app.post('/api/evaluate', async (req, res) => {
  let aiConfig: ResolvedAIConfig;
  try {
    aiConfig = resolveAIConfig(req);
  } catch (keyErr: any) {
    return res.status(401).json({
      error: 'API_KEY_REQUIRED',
      message: keyErr?.message || 'Clé API requise pour évaluer la réponse.',
    });
  }

  try {
    const { exerciseTitle, questionText, studentAnswer, branch = 'PC' } = req.body;
    const branchLabel = branch === 'SM' ? 'Sciences Mathématiques (SM)' : 'Sciences Physiques (PC)';

    const prompt = `
En tant que Si Driss, correcteur officiel de l'Examen National 2ème Bac ${branchLabel} (BIOF Maroc), évalue rigoureusement la réponse suivante d'un élève.

EXERCICE : ${exerciseTitle || `Exercice National 2ème Bac ${branch}`}
QUESTION : ${questionText || 'Résolution du problème'}
RÉPONSE RÉDIGÉE PAR L'ÉLÈVE (Filière ${branch}) :
${studentAnswer}

Fournis une évaluation structurée au format JSON suivant :
{
  "score": 18,
  "maxScore": 20,
  "gradeWord": "Très Bien",
  "appreciation": "Commentaire paternel et encourageant (ex. Tbarkellah 3lik)",
  "criteria": [
    {"name": "Démarche et justifications (Référentiel/Forces/Lois)", "status": "ok" | "warning" | "error", "feedback": "..."},
    {"name": "Expression littérale", "status": "ok" | "warning" | "error", "feedback": "..."},
    {"name": "Application numérique & Chiffres significatifs", "status": "ok" | "warning" | "error", "feedback": "..."},
    {"name": "Unités SI obligatoires", "status": "ok" | "warning" | "error", "feedback": "..."}
  ],
  "nationalTips": "Le conseil clé attendu par le barème national ${branch}",
  "correctedDraft": "La rédaction modèle idéale attendue par le barème ministériel ${branch} avec LaTeX"
}
`;

    const { text } = await generateUnifiedCompletion(
      aiConfig,
      [{ role: 'user', content: prompt }],
      getSiDrissBasePrompt(branch),
      true
    );

    let data;
    try {
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      data = JSON.parse(cleanJson);
    } catch {
      data = {
        score: 15,
        maxScore: 20,
        gradeWord: 'Bien',
        appreciation: "Bon travail d'ensemble, attention aux détails du barème !",
        criteria: [],
        nationalTips: "Toujours expliciter l'expression littérale avant l'application numérique.",
        correctedDraft: text,
      };
    }

    return res.json(data);
  } catch (err: any) {
    console.error('Erreur API Evaluation:', err);
    return res.status(500).json({ error: "Erreur lors de l'évaluation." });
  }
});

// Custom Exercise Generator Endpoint
app.post('/api/generate-exercise', async (req, res) => {
  let aiConfig: ResolvedAIConfig;
  try {
    aiConfig = resolveAIConfig(req);
  } catch (keyErr: any) {
    return res.status(401).json({
      error: 'API_KEY_REQUIRED',
      message: keyErr?.message || 'Clé API requise pour générer un sujet.',
    });
  }

  try {
    const { subject, chapter, difficulty, topicStyle, branch = 'PC' } = req.body;
    const branchLabel = branch === 'SM' ? 'Sciences Mathématiques (SM)' : 'Sciences Physiques (PC)';

    const prompt = `
Génère un exercice inédit de type Examen National Marocain pour la 2ème Année Bac ${branchLabel} (BIOF).

Matière : ${subject || 'Physique'}
Chapitre : ${chapter || (branch === 'SM' ? "Rotation d'un solide autour d'un axe fixe" : 'Ondes mécaniques progressives')}
Filière cible : 2ème Bac ${branch} (respecter strictement le Cadre de Référence officiel du Ministère pour ${branch})
Difficulté : ${difficulty || 'Standard National'}
Style : ${topicStyle || 'Problème avec données expérimentales et analyse graphique'}

L'exercice doit comporter :
- Un énoncé réaliste avec contexte expérimental adapté au niveau ${branch}.
- Données précises avec unités et constantes physiques officielles.
- 3 à 4 questions progressives et numérotées selon le standard du National.
- Une question piège classique de 2ème Bac ${branch}.

Réponds UNIQUEMENT au format JSON :
{
  "title": "Titre officiel",
  "domain": "Physique" | "Chimie",
  "chapter": "${chapter || 'Chapitre'}",
  "duration": "30 min",
  "context": "Texte d'introduction...",
  "parameters": [
    {"symbol": "lambda", "name": "Grandeur", "value": "valeur"}
  ],
  "questions": [
    {
      "number": "1",
      "text": "Question 1...",
      "points": "1.0 pt",
      "hint": "Indice socratique",
      "keyFormula": "$...$"
    }
  ],
  "commonPitfall": "Le piège fréquent à éviter en 2ème Bac ${branch}",
  "professorNote": "Conseil de Si Driss"
}
`;

    const { text } = await generateUnifiedCompletion(
      aiConfig,
      [{ role: 'user', content: prompt }],
      getSiDrissBasePrompt(branch),
      true
    );

    const cleanJson = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const exercise = JSON.parse(cleanJson);
    return res.json(exercise);
  } catch (err: any) {
    console.error('Erreur API Generate Exercise:', err);
    return res.status(500).json({ error: "Erreur lors de la génération d'exercice." });
  }
});

// PDF Text Extraction Helper
async function extractTextFromPdf(buf: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    await parser.destroy();
    return result.text || '';
  } catch (err) {
    console.warn('Erreur extraction PDF:', err);
    return '';
  }
}

// Documents Management API (/docs/programme/)
app.get('/api/documents', async (_req, res) => {
  try {
    if (!fs.existsSync(DOCS_DIR)) {
      return res.json({ directory: DOCS_DIR, files: [] });
    }

    const fileNames = fs.readdirSync(DOCS_DIR).filter((f) => !f.endsWith('.extracted.txt'));
    const files = await Promise.all(
      fileNames.map(async (name) => {
        const filePath = path.join(DOCS_DIR, name);
        const stat = fs.statSync(filePath);
        let preview = '';
        const isPdf = name.toLowerCase().endsWith('.pdf');

        if (isPdf) {
          const txtPath = path.join(DOCS_DIR, `${name}.extracted.txt`);
          if (fs.existsSync(txtPath)) {
            preview = fs.readFileSync(txtPath, 'utf-8').slice(0, 150).replace(/\n/g, ' ');
          } else {
            try {
              const buf = fs.readFileSync(filePath);
              const text = await extractTextFromPdf(buf);
              preview = text.slice(0, 150).replace(/\n/g, ' ');
              fs.writeFileSync(txtPath, text, 'utf-8');
            } catch {
              preview = 'Document PDF prêt à être indexé';
            }
          }
        } else {
          try {
            const text = fs.readFileSync(filePath, 'utf-8');
            preview = text.slice(0, 150).replace(/\n/g, ' ');
          } catch {
            preview = 'Document texte';
          }
        }

        return {
          name,
          size: stat.size,
          modified: stat.mtime,
          preview,
          isPdf,
        };
      })
    );

    return res.json({
      directory: '/docs/programme',
      files,
    });
  } catch (err: any) {
    console.error('Erreur get documents:', err);
    return res.status(500).json({ error: 'Impossible de lire les documents.' });
  }
});

app.get('/api/documents/file', async (req, res) => {
  try {
    const name = String(req.query.name || '');
    if (!name) return res.status(400).json({ error: 'Nom requis.' });

    const safeName = path.basename(name);
    const filePath = path.join(DOCS_DIR, safeName);
    const isPdf = safeName.toLowerCase().endsWith('.pdf');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier non trouvé.' });
    }

    if (isPdf) {
      const txtPath = path.join(DOCS_DIR, `${safeName}.extracted.txt`);
      if (fs.existsSync(txtPath)) {
        const content = fs.readFileSync(txtPath, 'utf-8');
        return res.json({ name: safeName, content, isPdf: true });
      } else {
        const buf = fs.readFileSync(filePath);
        const content = await extractTextFromPdf(buf);
        fs.writeFileSync(txtPath, content, 'utf-8');
        return res.json({ name: safeName, content, isPdf: true });
      }
    } else {
      const content = fs.readFileSync(filePath, 'utf-8');
      return res.json({ name: safeName, content, isPdf: false });
    }
  } catch (err: any) {
    console.error('Erreur get document file:', err);
    return res.status(500).json({ error: 'Erreur lecture document.' });
  }
});

const UPLOAD_ALLOWED_EXTENSIONS = new Set(['.pdf', '.md', '.txt', '.json', '.csv']);
const UPLOAD_MAX_BASE64_BYTES = 15 * 1024 * 1024; // ~15 MB encoded ≈ 11 MB file
const UPLOAD_MAX_TEXT_CHARS = 2_000_000;

app.post('/api/documents/upload', requireAdmin, documentMutationLimiter, async (req, res) => {
  try {
    const { filename, content, base64 } = req.body;
    if (!filename || (content === undefined && !base64)) {
      return res.status(400).json({ error: 'Nom de fichier et contenu (texte ou base64) requis.' });
    }

    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    if (!safeName || safeName === '.' || safeName === '..') {
      return res.status(400).json({ error: 'Nom de fichier invalide.' });
    }

    // Never accept pre-extracted sidecars: they would bypass PDF parsing and inject
    // arbitrary text straight into the RAG index.
    if (safeName.toLowerCase().endsWith('.extracted.txt')) {
      return res.status(400).json({ error: 'Ce nom de fichier est réservé au système d’indexation.' });
    }

    const ext = path.extname(safeName).toLowerCase();
    if (!UPLOAD_ALLOWED_EXTENSIONS.has(ext)) {
      return res.status(400).json({
        error: `Extension "${ext}" non autorisée. Formats acceptés : ${[...UPLOAD_ALLOWED_EXTENSIONS].join(', ')}.`,
      });
    }

    if (base64 && String(base64).length > UPLOAD_MAX_BASE64_BYTES) {
      return res.status(413).json({ error: 'Fichier trop volumineux (max ~11 Mo).' });
    }
    if (content !== undefined && String(content).length > UPLOAD_MAX_TEXT_CHARS) {
      return res.status(413).json({ error: 'Document texte trop volumineux (max 2 millions de caractères).' });
    }

    const filePath = path.join(DOCS_DIR, safeName);
    const isPdf = ext === '.pdf';

    if (base64) {
      const buf = Buffer.from(base64, 'base64');
      fs.writeFileSync(filePath, buf);

      if (isPdf) {
        try {
          const text = await extractTextFromPdf(buf);
          const txtPath = path.join(DOCS_DIR, `${safeName}.extracted.txt`);
          fs.writeFileSync(txtPath, text, 'utf-8');
        } catch (pdfErr) {
          console.warn('Extraction PDF échouée:', pdfErr);
        }
      }
    } else {
      fs.writeFileSync(filePath, content, 'utf-8');
    }

    return res.json({
      success: true,
      message: isPdf
        ? `Document PDF "${safeName}" téléchargé et texte extrait automatiquement pour l'indexation !`
        : `Document "${safeName}" indexé avec succès dans /docs/programme/`,
      file: { name: safeName },
    });
  } catch (err: any) {
    console.error('Erreur upload document:', err);
    return res.status(500).json({ error: 'Erreur lors de la sauvegarde du document.' });
  }
});

app.delete('/api/documents/:filename', requireAdmin, documentMutationLimiter, async (req, res) => {
  try {
    const { filename } = req.params;
    const safeName = path.basename(filename);
    const filePath = path.join(DOCS_DIR, safeName);
    const txtPath = path.join(DOCS_DIR, `${safeName}.extracted.txt`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      if (fs.existsSync(txtPath)) {
        fs.unlinkSync(txtPath);
      }
      return res.json({ success: true, message: `Fichier ${safeName} supprimé.` });
    }
    return res.status(404).json({ error: 'Fichier non trouvé.' });
  } catch (err: any) {
    console.error('Erreur suppression document:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
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
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  httpServer.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Si Driss Universal Platform running on port ${PORT}`);
    console.log(`📚 Documents repository ready: ${DOCS_DIR}`);
    console.log(`🤖 Universal AI Engine: Gemini, Groq, OpenAI, Claude, DeepSeek, Mistral, Ollama/Local`);
    console.log(`=======================================================`);
  });
}

startServer();
