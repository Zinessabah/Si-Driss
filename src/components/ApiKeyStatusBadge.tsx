import React, { useState } from 'react';
import { Cpu, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';
import { useApiKey } from '../hooks/useApiKey';
import { ApiKeyModal } from './ApiKeyModal';
import { getProviderDef } from '../types/aiProviders';

interface ApiKeyStatusBadgeProps {
  compact?: boolean;
}

export const ApiKeyStatusBadge: React.FC<ApiKeyStatusBadgeProps> = ({ compact = false }) => {
  const { hasApiKey, provider, model, serverHasKey, serverDefaultProvider } = useApiKey();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const providerDef = getProviderDef(provider);
  const activeLabel = serverHasKey && !hasApiKey ? `${serverDefaultProvider.toUpperCase()} (Serveur)` : providerDef.name;

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-sm ${
          hasApiKey || serverHasKey
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            : 'bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25 animate-pulse'
        }`}
        title={
          hasApiKey || serverHasKey
            ? `Moteur IA actif : ${activeLabel} (${model}). Cliquer pour changer de fournisseur.`
            : 'Aucune clé configurée. Cliquer pour choisir votre IA (Gemini, Groq, OpenAI, Ollama...).'
        }
      >
        <span
          className={`w-2 h-2 rounded-full ${
            hasApiKey || serverHasKey ? 'bg-emerald-400' : 'bg-amber-400'
          }`}
        />
        <Cpu className="w-3.5 h-3.5 shrink-0" />
        {compact ? (
          <span className="font-mono">{hasApiKey || serverHasKey ? activeLabel : 'IA requise'}</span>
        ) : (
          <span className="flex items-center gap-1">
            <span>{hasApiKey || serverHasKey ? activeLabel : 'Choisir Moteur IA'}</span>
            {hasApiKey && model && (
              <span className="text-[10px] text-emerald-300/70 font-mono hidden md:inline">
                ({model.replace('gemini-', '').replace('-versatile', '')})
              </span>
            )}
          </span>
        )}
      </button>

      <ApiKeyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
