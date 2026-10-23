import React, { useState } from 'react';
import {
  MessageSquare,
  ShieldCheck,
  Zap,
  BookOpen,
  Key,
  FolderOpen,
} from 'lucide-react';
import { useApiKey } from '../hooks/useApiKey';
import { ApiKeyModal } from './ApiKeyModal';

interface AndroidBottomNavProps {
  activeTab: 'chat' | 'audit' | 'simulators' | 'formulas' | 'pitfalls' | 'documents';
  onSelectTab: (tab: 'chat' | 'audit' | 'simulators' | 'formulas' | 'pitfalls' | 'documents') => void;
}

export const AndroidBottomNav: React.FC<AndroidBottomNavProps> = ({ activeTab, onSelectTab }) => {
  const { hasApiKey } = useApiKey();
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  const handleTabClick = (tab: 'chat' | 'audit' | 'simulators' | 'formulas' | 'pitfalls' | 'documents') => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
    onSelectTab(tab);
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-14">
          {/* 1. Chat */}
          <button
            onClick={() => handleTabClick('chat')}
            className={`flex flex-col items-center justify-center gap-1 transition ${
              activeTab === 'chat' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="text-[10px] tracking-tight">Si Driss</span>
          </button>

          {/* 2. Audit */}
          <button
            onClick={() => handleTabClick('audit')}
            className={`flex flex-col items-center justify-center gap-1 transition ${
              activeTab === 'audit' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] tracking-tight">Audit</span>
          </button>

          {/* 3. Simulators */}
          <button
            onClick={() => handleTabClick('simulators')}
            className={`flex flex-col items-center justify-center gap-1 transition ${
              activeTab === 'simulators' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span className="text-[10px] tracking-tight">Labs</span>
          </button>

          {/* 4. Formulas */}
          <button
            onClick={() => handleTabClick('formulas')}
            className={`flex flex-col items-center justify-center gap-1 transition ${
              activeTab === 'formulas' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="text-[10px] tracking-tight">Formules</span>
          </button>

          {/* 5. Key Settings */}
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="flex flex-col items-center justify-center gap-1 relative text-slate-400 hover:text-slate-200 transition"
          >
            <div className="relative">
              <Key className="w-4 h-4" />
              <span
                className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                  hasApiKey ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
            </div>
            <span className="text-[10px] tracking-tight">{hasApiKey ? 'Ma Clé' : 'Clé API'}</span>
          </button>
        </div>
      </nav>

      <ApiKeyModal isOpen={isKeyModalOpen} onClose={() => setIsKeyModalOpen(false)} />
    </>
  );
};
