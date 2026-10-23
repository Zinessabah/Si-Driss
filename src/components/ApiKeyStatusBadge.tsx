import React, { useState } from 'react';
import { Key, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApiKey } from '../hooks/useApiKey';
import { ApiKeyModal } from './ApiKeyModal';

interface ApiKeyStatusBadgeProps {
  compact?: boolean;
}

export const ApiKeyStatusBadge: React.FC<ApiKeyStatusBadgeProps> = ({ compact = false }) => {
  const { hasApiKey } = useApiKey();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-sm ${
          hasApiKey
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
            : 'bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25 animate-pulse'
        }`}
        title={hasApiKey ? 'Clé API active. Cliquer pour gérer.' : 'Clé API requise. Cliquer pour configurer gratuitement.'}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            hasApiKey ? 'bg-emerald-400' : 'bg-amber-400'
          }`}
        />
        <Key className="w-3.5 h-3.5" />
        {compact ? (
          <span>{hasApiKey ? 'Clé active' : 'Clé requise'}</span>
        ) : (
          <span>{hasApiKey ? 'Clé API Active' : 'Configurer ma clé API'}</span>
        )}
      </button>

      <ApiKeyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
