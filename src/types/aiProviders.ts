export type AIProviderId =
  | 'gemini'
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'mistral'
  | 'nvidia'
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
    defaultModel: 'gemini-3.8-flash',
    keyHelp: 'Clé 100% gratuite avec un simple compte Google (Gmail), sans carte bancaire.',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIzaSy...',
    requiresKey: true,
    freeTier: true,
    models: [
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', tag: 'Défaut Gratuit', description: 'Multimodal gratuit, vision schémas + raisonnement STEM' },
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', tag: 'Gratuit & Rapide', description: 'Modèle Flash gratuit performant pour exercices et cours' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', tag: 'Ultra-Rapide Gratuit', description: 'Réponse quasi instantanée et quota très généreux' },
      { id: 'gemini-4-hydrogen', name: 'Gemini 4 Hydrogen', tag: 'Nouvelle Génération', description: 'Disponible gratuitement sur les projets Google AI Studio éligibles' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: 'Gratuit Stable', description: 'Repli gratuit éprouvé avec vision PDF et schémas' },
      { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', tag: 'Dernière Version', description: 'Alias officiel pointant vers le dernier Flash stable' },
    ],
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    tagline: 'Vitesse de génération fulgurante (~300 tokens/s) avec LPU',
    badge: 'Ultra-Rapide & Gratuit',
    badgeColor: 'amber',
    defaultModel: 'openai/gpt-oss-120b',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    keyHelp: 'Quota gratuit très généreux sur console.groq.com sans carte bancaire.',
    keyUrl: 'https://console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
    requiresKey: true,
    freeTier: true,
    models: [
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', tag: 'Défaut Gratuit', description: 'Modèle de production principal sur LPU Groq, fort en sciences' },
      { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', tag: 'Ultra-Rapide', description: 'Successeur officiel rapide de Llama 3.1 8B sur Groq' },
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', tag: 'Maths & Sciences', description: 'Contexte 131K et mode raisonnement pour démonstrations' },
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
      { id: 'mistral-small-latest', name: 'Mistral Small 4', tag: 'Défaut Gratuit', description: 'Rapide, hybride raisonnement et excellent en français' },
      { id: 'mistral-medium-latest', name: 'Mistral Medium 3.5', tag: 'Équilibré', description: 'Bon compromis précision scientifique et vitesse' },
      { id: 'mistral-large-latest', name: 'Mistral Large 4', tag: 'Haut de gamme', description: 'Très grande puissance pour les synthèses et cours' },
      { id: 'codestral-latest', name: 'Codestral', tag: 'Logique & Calculs', description: 'Modèle orienté logique formelle' },
    ],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    tagline: 'Endpoints gratuits (build.nvidia.com) pour Llama, DeepSeek et Qwen sur GPU NVIDIA',
    badge: 'Endpoints Gratuits NIM',
    badgeColor: 'emerald',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    keyHelp: 'Clé gratuite sans carte bancaire (~40 req/min) sur build.nvidia.com (préfixe nvapi-...). Cliquez sur « Actualiser » si un endpoint change.',
    keyUrl: 'https://build.nvidia.com/',
    keyPlaceholder: 'nvapi-...',
    requiresKey: true,
    freeTier: true,
    models: [
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', tag: 'Défaut Gratuit', description: 'Très solide en français et en Physique-Chimie 2BAC' },
      { id: 'meta/llama-4-maverick', name: 'Llama 4 Maverick', tag: 'Nouvelle Génération', description: 'Modèle récent haute performance sur NIM' },
      { id: 'deepseek-ai/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', tag: 'Rapide & STEM', description: 'Inférence rapide optimisée TensorRT-LLM' },
      { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1', tag: 'Raisonnement', description: 'Démonstrations pas-à-pas pour problèmes exigeants' },
      { id: 'deepseek-ai/deepseek-v3.2', name: 'DeepSeek V3.2', tag: 'Polyvalent', description: 'Haute précision scientifique et calcul littéral' },
      { id: 'qwen/qwen3-235b-a22b', name: 'Qwen 3 235B A22B', tag: 'Maths & Sciences', description: 'Grand modèle MoE excellent sur les calculs formels' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    tagline: 'Routeur universel avec modèles gratuits (:free) sans carte bancaire',
    badge: 'Modèles Gratuits :free',
    badgeColor: 'indigo',
    defaultModel: 'openrouter/free',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    keyHelp: 'Clé gratuite sur openrouter.ai/keys. Le routeur « openrouter/free » sélectionne automatiquement un modèle gratuit actif.',
    keyUrl: 'https://openrouter.ai/keys',
    keyPlaceholder: 'sk-or-v1-...',
    requiresKey: true,
    freeTier: true,
    models: [
      { id: 'openrouter/free', name: 'Free Models Router (Auto)', tag: 'Recommandé 100% Gratuit', description: 'Choisit automatiquement un modèle gratuit disponible sans erreur 404' },
      { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B (:free)', tag: 'Gratuit Google', description: 'Modèle ouvert Google Gemma 4 gratuit' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (:free)', tag: 'Gratuit Meta', description: 'Version gratuite communautaire de Llama 3.3 70B' },
      { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B (:free)', tag: 'Ultra-Léger Gratuit', description: 'Réponse rapide pour questions simples' },
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
