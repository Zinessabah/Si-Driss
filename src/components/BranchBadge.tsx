import React, { useState } from 'react';
import { ChevronDown, FlaskConical, Compass } from 'lucide-react';
import { useBranch } from '../hooks/useBranch';
import { BranchSelectorModal } from './BranchSelectorModal';

interface BranchBadgeProps {
  compact?: boolean;
}

export const BranchBadge: React.FC<BranchBadgeProps> = ({ compact = false }) => {
  const { branch, isSM } = useBranch();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all border shadow-sm ${
          isSM
            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25'
            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
        }`}
        title={`Filière active : ${isSM ? '2ème Bac Sciences Mathématiques' : '2ème Bac Sciences Physiques'}. Cliquer pour changer.`}
      >
        {isSM ? (
          <Compass className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        ) : (
          <FlaskConical className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        )}
        <span>{isSM ? '2ème Bac SM' : '2ème Bac PC'}</span>
        <span className="text-[10px] opacity-75 font-normal ml-0.5">BIOF</span>
        <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      <BranchSelectorModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        canClose={true}
      />
    </>
  );
};
