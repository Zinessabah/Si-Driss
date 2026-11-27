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
    tagline: 'Endpoints gratuits vérifiés (build.nvidia.com) : Nemotron 3.5, Mistral Large 4, Kimi, Gemma 3',
    badge: 'Endpoints Gratuits NIM',
    badgeColor: 'emerald',
    defaultModel: 'nvidia/nemotron-3.5-super-vl-120b-a12b',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    keyHelp: 'Clé gratuite sans carte bancaire (~40 req/min) sur build.nvidia.com (préfixe nvapi-...). Cliquez sur « Actualiser (API) » pour synchroniser le catalogue NVIDIA.',
    keyUrl: 'https://build.nvidia.com/',
    keyPlaceholder: 'nvapi-...',
    requiresKey: true,
    freeTier: true,
    models: [
      { id: 'nvidia/nemotron-3.5-super-vl-120b-a12b', name: 'Nemotron 3.5 Super 120B', tag: 'Défaut Actif NIM', description: 'Modèle phare NVIDIA 120B rapide et performant en Physique-Chimie' },
      { id: 'nvidia/nemotron-3.5-lightning-30b-a3b', name: 'Nemotron 3.5 Lightning 30B', tag: 'Ultra-Rapide', description: 'Latence minimale pour révisions et dialogues socratiques' },
      { id: 'nvidia/nemotron-3-ultra-550b-a55b', name: 'Nemotron 3 Ultra 550B', tag: 'Raisonnement Élite', description: 'Grand modèle MoE pour démonstrations exigeantes' },
      { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', name: 'Nemotron 3 Nano Reasoning', tag: 'Raisonnement STEM', description: 'Mode raisonnement scientifique compact 30B' },
      { id: 'mistralai/mistral-large-4-1t-a52b', name: 'Mistral Large 4 (NIM)', tag: 'Français & Sciences', description: 'Excellence en rédaction française BIOF et calcul littéral' },
      { id: 'moonshotai/kimi-k3.1-pro', name: 'Kimi K3.1 Pro', tag: 'Thinking & Vision', description: 'Grand contexte (1M) avec mode réflexion' },
      { id: 'z-ai/glm-5.3-flash', name: 'GLM 5.3 Flash', tag: 'Rapide', description: 'Modèle polyvalent rapide hébergé sur NIM' },
      { id: 'google/gemma-3-12b-it', name: 'Gemma 3 12B Instruct', tag: 'Léger', description: 'Modèle ouvert Google léger et stable' },
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
      { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B (:free)', tag: 'Gratuit Google', description: 'Modèle ouvert Google Gemma 4 31B gratuit' },
      { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B (:free)', tag: 'Gratuit Google', description: 'Variante MoE rapide de Gemma 4 gratuite' },
      { id: 'nvidia/nemotron-3.5-super-vl:free', name: 'Nemotron 3.5 Super (:free)', tag: 'Gratuit NVIDIA', description: 'Modèle NVIDIA Nemotron 3.5 gratuit via OpenRouter' },
      { id: 'nvidia/nemotron-3.5-lightning:free', name: 'Nemotron 3.5 Lightning (:free)', tag: 'Ultra-Rapide', description: 'Réponses rapides gratuites via OpenRouter' },
      { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra 550B (:free)', tag: 'Raisonnement Élite', description: 'Grand modèle raisonnement gratuit via OpenRouter' },
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
