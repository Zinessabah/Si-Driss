import React, { useState } from 'react';
import { Cpu, AlertTriangle, CheckCircle2, Zap, ChevronDown } from 'lucide-react';
import { useApiKey } from '../hooks/useApiKey';
import { ApiKeyModal } from './ApiKeyModal';
import { getProviderDef } from '../types/aiProviders';

interface ApiKeyStatusBadgeProps {
  compact?: boolean;
  onOpenModal?: () => void;
}

export const ApiKeyStatusBadge: React.FC<ApiKeyStatusBadgeProps> = ({ compact = false, onOpenModal }) => {
  const { hasApiKey, provider, model, serverHasKey, serverDefaultProvider } = useApiKey();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const providerDef = getProviderDef(provider);
  const activeLabel = serverHasKey && !hasApiKey ? `${serverDefaultProvider.toUpperCase()} (Serveur)` : providerDef.name;

  const handleClick = () => {
    if (onOpenModal) {
      onOpenModal();
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-sm ${
          hasApiKey || serverHasKey
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            : 'bg-[#1e1f20] text-[#c4c7c5] border-[#3c4043] hover:bg-[#282a2c] hover:text-white'
        }`}
        title={
          hasApiKey || serverHasKey
            ? `Fournisseur IA actif : ${activeLabel} (${model}). Cliquer pour basculer de fournisseur (Gemini, Groq, Ollama, OpenAI...).`
            : 'Navigation libre sur les labos, formules, pièges et documents officiels. Cliquer pour configurer une clé IA (uniquement pour le Chat et l’Audit IA).'
        }
      >
        <span
          className={`w-2 h-2 rounded-full ${
            hasApiKey || serverHasKey ? 'bg-emerald-400' : 'bg-slate-400'
          }`}
        />
        <Cpu className="w-3.5 h-3.5 shrink-0" />
        {compact ? (
          <span className="font-mono">{hasApiKey || serverHasKey ? activeLabel : 'Clé IA (Chat)'}</span>
        ) : (
          <span className="flex items-center gap-1">
            <span>{hasApiKey || serverHasKey ? activeLabel : 'Configurer IA (Chat)'}</span>
            {hasApiKey && model && (
              <span className="text-[10px] text-emerald-300/70 font-mono hidden md:inline">
                ({model.replace('gemini-', '').replace('-versatile', '')})
              </span>
            )}
          </span>
        )}
        <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
      </button>

      {!onOpenModal && (
        <ApiKeyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
};
