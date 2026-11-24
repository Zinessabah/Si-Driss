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
    defaultModel: 'gemini-4-hydrogen',
    keyHelp: 'Clé 100% gratuite avec un simple compte Google (Gmail), sans carte bancaire.',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIzaSy...',
    requiresKey: true,
    freeTier: true,
    models: [
      { id: 'gemini-4-hydrogen', name: 'Gemini 4 Flash (Hydrogen)', tag: 'Défaut Ultra-Rapide', description: 'Modèle multimodal nouvelle génération, rapide et précis en STEM' },
      { id: 'gemini-4-carbon', name: 'Gemini 4 Carbon', tag: 'Frontier Élite', description: 'Raisonnement scientifique de pointe pour les problèmes complexes' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', tag: 'Stable & Avancé', description: 'Version stable avec vision complète pour schémas et exercices' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', tag: 'Sub-Seconde', description: 'Réponse instantanée (~0.7s) pour dialogue socratique réactif' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', tag: 'Économique', description: 'Modèle léger et sobre en quota' },
      { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', tag: 'Dernière Version', description: 'Pointe toujours vers la dernière mouture Flash stable officielle' },
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
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', tag: 'Rapide & Précis', description: 'Nouveau modèle Qwen haute performance scientifique' },
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', tag: 'Grande Capacité', description: 'Modèle open-source de pointe sur processeurs LPU Groq' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', tag: 'Polyvalent', description: 'Grand contexte et bonne logique scientifique' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    tagline: 'Modèles de référence de la gamme GPT-4o & GPT-4.5',
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
      { id: 'gpt-4.5', name: 'GPT-4.5 Flagship', tag: 'Flagship', description: 'Précision maximale, connaissance étendue et nuance' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    tagline: 'Qualité de rédaction pédagogique et rigueur conceptuelle',
    badge: 'Élite Rédactionnelle',
    badgeColor: 'purple',
    defaultModel: 'claude-3-7-sonnet-20250219',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    keyHelp: 'Clé issue de la console Anthropic (console.anthropic.com).',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyPlaceholder: 'sk-ant-api...',
    requiresKey: true,
    freeTier: false,
    models: [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', tag: 'Hybride R1', description: 'Raisonnement approfondi avec thinking mode et élégance de rédaction' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tag: 'Référence', description: 'Parfaite clarté pédagogique et rigueur des unités' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tag: 'Rapide', description: 'Réponses instantanées et synthétiques' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    tagline: 'DeepSeek V4 officiel : mode Thinking, précision STEM et prix imbattable',
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
      { id: 'deepseek-flash', name: 'DeepSeek Flash (V4.1)', tag: 'Recommandé', description: 'Rapide, multimodal et précis — avec mode Thinking activé' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', tag: 'Raisonnement Élite', description: 'Démonstrations complètes pas-à-pas pour les problèmes difficiles' },
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', tag: 'V4 Flash', description: 'Alternative officielle optimisée pour la vitesse' },
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
      { id: 'mistral-small-latest', name: 'Mistral Small (4)', tag: 'Recommandé', description: 'Rapide, concis et respectueux des nuances en français' },
      { id: 'mistral-large-latest', name: 'Mistral Large (4)', tag: 'Haut de gamme', description: 'Très grande puissance pour les synthèses et cours' },
      { id: 'codestral-latest', name: 'Codestral', tag: 'Logique & Calculs', description: 'Modèle orienté logique formelle' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    tagline: 'Accès universel à +100 modèles IA avec une seule clé API',
    badge: 'Hub Multi-Modèles',
    badgeColor: 'indigo',
    defaultModel: 'google/gemini-4-carbon',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    keyHelp: 'Une seule clé sur openrouter.ai permet de tester tous les modèles existants.',
    keyUrl: 'https://openrouter.ai/keys',
    keyPlaceholder: 'sk-or-v1-...',
    requiresKey: true,
    freeTier: false,
    models: [
      { id: 'google/gemini-4-carbon', name: 'Gemini 4 Carbon', tag: 'Frontier', description: 'Via OpenRouter' },
      { id: 'google/gemini-4-hydrogen', name: 'Gemini 4 Hydrogen', tag: 'Rapide', description: 'Via OpenRouter' },
      { id: 'google/gemini-3.8-flash', name: 'Gemini 3.8 Flash', tag: 'Stable', description: 'Via OpenRouter' },
      { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', tag: 'Thinking', description: 'Via OpenRouter' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', tag: 'Open-Source', description: 'Via OpenRouter' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', tag: 'Raisonnement', description: 'Via OpenRouter' },
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
      { id: 'gemma2:2b', name: 'Gemma 2 2B (Google)', tag: 'Ultra-Léger Mobile/PC', description: 'Idéal pour téléphone ou PC avec petite RAM (~2 Go)' },
      { id: 'mistral', name: 'Mistral 7B', tag: 'Léger', description: 'Tourne facilement sur PC portable standard' },
    ],
  },
];

export function getProviderDef(id: AIProviderId): ProviderDefinition {
  return AI_PROVIDERS.find((p) => p.id === id) || AI_PROVIDERS[0];
}
