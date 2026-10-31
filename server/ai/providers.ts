import type { Request } from 'express';
import '../config'; // charge dotenv avant les lectures de process.env ci-dessous

export type SupportedProvider =
  | 'gemini'
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'mistral'
  | 'openrouter'
  | 'custom';

export function sanitizeApiKey(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u2028\u2029]/g, '')
    .replace(/^(export\s+)?([A-Z0-9_]*API_KEY|[A-Z0-9_]*TOKEN)\s*[:=]\s*/i, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/^["'`«“‘]+|["'`»”’]+$/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export const DEFAULT_MODELS: Record<SupportedProvider, string> = {
  gemini: 'gemini-3.5-flash-lite',
  groq: 'llama-3.3-70b-versatile',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
  deepseek: 'deepseek-flash',
  mistral: 'mistral-small-latest',
  openrouter: 'google/gemini-3.8-flash',
  custom: 'llama3.3',
};

export const DEFAULT_BASE_URLS: Partial<Record<SupportedProvider, string>> = {
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
export const LEGACY_DEEPSEEK_MODELS: Record<string, string> = {
  'deepseek-chat': 'deepseek-flash',
  'deepseek-reasoner': 'deepseek-flash',
};

const DEEPSEEK_REASONING_EFFORTS = new Set(['none', 'low', 'high', 'max', 'minimal', 'medium', 'xhigh']);

// Fallback models for Gemini — stable public IDs verified against
// ai.google.dev/gemini-api/docs/models (sub-second responsive models prioritized).
export const GEMINI_FAST_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
];

// Retired or previous-generation Gemini models, silently rewritten to the fast default.
// NOTE: gemini-3.8-flash and gemini-flash-latest are CURRENT stable public IDs and
// must NOT be listed here (M6 : réconcilier blocklist et catalogue officiel).
const DEPRECATED_OR_SLOW_GEMINI_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
]);

export interface ResolvedAIConfig {
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
export function isAllowedLocalBaseUrl(rawUrl: string): boolean {
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

export function resolveAIConfig(req: Request): ResolvedAIConfig {
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
