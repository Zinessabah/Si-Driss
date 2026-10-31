export type AIProviderId =
  | 'gemini'
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'mistral'
  | 'openrouter'
  | 'custom';

export interface AIProviderConfig {
  provider: AIProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  tag?: string;
  description?: string;
}

export interface ProviderDefinition {
  id: AIProviderId;
  name: string;
  tagline: string;
  badge: string;
  badgeColor: string;
  defaultModel: string;
  defaultBaseUrl?: string;
  models: ModelOption[];
  keyHelp: string;
  keyUrl: string;
  keyPlaceholder: string;
  requiresKey: boolean;
  freeTier: boolean;
}

export const AI_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    tagline: 'Moteur officiel Google AI Studio avec vision et raisonnement',
    badge: 'Recommandé & Gratuit',
    badgeColor: 'emerald',
    defaultModel: 'gemini-3.5-flash-lite',
    keyHelp: 'Clé 100% gratuite avec un simple compte Google (Gmail), sans carte bancaire.',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIzaSy...',
    requiresKey: true,
    freeTier: true,
    models: [
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', tag: 'Défaut Ultra-Rapide', description: 'Réponse instantanée (~0.7s) et haute précision STEM' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', tag: 'Rapide & Stable', description: 'Modèle compact pour dialogue socratique réactif' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', tag: 'Raisonnement', description: 'Idéal pour les démonstrations détaillées' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', tag: 'Avancé', description: 'Modèle complet Google Gemini' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    tagline: 'Vitesse de génération fulgurante (~300 tokens/s) avec LPU',
    badge: 'Ultra-Rapide & Gratuit',
    badgeColor: 'amber',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    keyHelp: 'Quota gratuit très généreux sur console.groq.com sans carte bancaire.',
    keyUrl: 'https://console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
    requiresKey: true,
    freeTier: true,
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', tag: 'Recommandé', description: 'Excellente maîtrise du français et des sciences' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B', tag: 'Raisonnement', description: 'Chaîne de pensée pas-à-pas pour les démonstrations' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', tag: 'Polyvalent', description: 'Grand contexte et bonne logique scientifique' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B', tag: 'Léger', description: 'Modèle compact ultra réactif' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'Modèles de référence de la gamme GPT-4o',
    badge: 'Standard de l\'industrie',
    badgeColor: 'sky',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyHelp: 'Nécessite des crédits OpenAI sur platform.openai.com.',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-proj-...',
    requiresKey: true,
    freeTier: false,
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Économique & Précis', description: 'Rapport coût/qualité exceptionnel' },
      { id: 'gpt-4o', name: 'GPT-4o', tag: 'Phare', description: 'Haute fidélité pour les énoncés complexes et les graphes' },
      { id: 'o3-mini', name: 'o3-mini', tag: 'STEM Raisonnement', description: 'Spécialisé en mathématiques, physique et logique pure' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    tagline: 'Qualité de rédaction pédagogique et rigueur conceptuelle',
    badge: 'Élite Rédactionnelle',
    badgeColor: 'purple',
    defaultModel: 'claude-3-5-haiku-20241022',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    keyHelp: 'Clé issue de la console Anthropic (console.anthropic.com).',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-api...',
    requiresKey: true,
    freeTier: false,
    models: [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', tag: 'Hybride R1', description: 'Raisonnement approfondi et élégance de rédaction' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tag: 'Référence', description: 'Parfaite clarté pédagogique et rigueur des unités' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tag: 'Rapide', description: 'Réponses instantanées et synthétiques' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    tagline: 'DeepSeek V4 officiel : mode Thinking activé par défaut, prix imbattable',
    badge: 'Performant & Économique',
    badgeColor: 'blue',
    defaultModel: 'deepseek-flash',
    defaultBaseUrl: 'https://api.deepseek.com',
    keyHelp: 'Clé issue de platform.deepseek.com.',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyPlaceholder: 'sk-...',
    requiresKey: true,
    freeTier: false,
    models: [
      { id: 'deepseek-flash', name: 'DeepSeek Flash (V4.1)', tag: 'Recommandé', description: 'Rapide et précis — mode Thinking activé par défaut (effort high)' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', tag: 'Raisonnement max', description: 'Démonstrations complètes pas-à-pas pour les problèmes difficiles' },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    tagline: 'Champion européen de l\'IA, excellence en langue française',
    badge: 'Modèles Français',
    badgeColor: 'amber',
    defaultModel: 'mistral-small-latest',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    keyHelp: 'Clé générée sur console.mistral.ai (crédits gratuits à l\'inscription).',
    keyUrl: 'https://console.mistral.ai/api-keys/',
    keyPlaceholder: '...',
    requiresKey: true,
    freeTier: true,
    models: [
      { id: 'mistral-small-latest', name: 'Mistral Small', tag: 'Recommandé', description: 'Rapide, concis et respectueux des nuances en français' },
      { id: 'mistral-large-latest', name: 'Mistral Large', tag: 'Haut de gamme', description: 'Très grande puissance pour les synthèses et cours' },
      { id: 'codestral-latest', name: 'Codestral', tag: 'Logique & Calculs', description: 'Modèle orienté logique formelle' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    tagline: 'Accès universel à +100 modèles IA avec une seule clé API',
    badge: 'Hub Multi-Modèles',
    badgeColor: 'indigo',
    defaultModel: 'google/gemini-3.8-flash',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    keyHelp: 'Une seule clé sur openrouter.ai permet de tester tous les modèles existants.',
    keyUrl: 'https://openrouter.ai/keys',
    keyPlaceholder: 'sk-or-v1-...',
    requiresKey: true,
    freeTier: false,
    models: [
      { id: 'google/gemini-3.8-flash', name: 'Gemini 3.8 Flash', tag: 'Rapide', description: 'Via OpenRouter' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', tag: 'Open-Source', description: 'Via OpenRouter' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', tag: 'Raisonnement', description: 'Via OpenRouter' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', tag: 'Rédaction', description: 'Via OpenRouter' },
    ],
  },
  {
    id: 'custom',
    name: 'Ollama / Local LLM / Custom',
    tagline: '100% Hors-ligne, confidentiel, gratuit et sans aucune clé API requise',
    badge: '100% Local & Hors-ligne',
    badgeColor: 'emerald',
    defaultModel: 'llama3.3',
    defaultBaseUrl: 'http://localhost:11434/v1',
    keyHelp: 'Fonctionne avec Ollama, LM Studio, vLLM ou n\'importe quelle API compatible OpenAI.',
    keyUrl: 'https://ollama.ai',
    keyPlaceholder: 'Optionnelle (laisser vide pour Ollama local)',
    requiresKey: false,
    freeTier: true,
    models: [
      { id: 'llama3.3', name: 'Llama 3.3', tag: 'Recommandé', description: 'Exécuté localement via `ollama run llama3.3`' },
      { id: 'qwen2.5:14b', name: 'Qwen 2.5 14B', tag: 'Excellent en maths', description: 'Très fort en physique et calculs formels' },
      { id: 'deepseek-r1:14b', name: 'DeepSeek R1 14B Distill', tag: 'Raisonnement local', description: 'Pensée socratique en local' },
      { id: 'mistral', name: 'Mistral 7B', tag: 'Léger', description: 'Tourne facilement sur PC portable standard' },
    ],
  },
];

export function getProviderDef(id: AIProviderId): ProviderDefinition {
  return AI_PROVIDERS.find((p) => p.id === id) || AI_PROVIDERS[0];
}
