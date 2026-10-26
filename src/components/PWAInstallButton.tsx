import React, { useState } from 'react';
import { Smartphone, Download, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { AndroidInstallModal } from './AndroidInstallModal';

interface PWAInstallButtonProps {
  variant?: 'nav' | 'banner' | 'pill';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'nav' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setIsModalOpen(true);
      }
    } else {
      setIsModalOpen(true);
    }
  };

  // If already running standalone inside PWA wrapper
  if (isInstalled && variant === 'nav') {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
        <Smartphone className="w-3.5 h-3.5" />
        <span>Application installée</span>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <>
        <div className="bg-[#1e1f20] border border-[#3c4043] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#4285f4] via-[#9b72cb] to-[#f59e0b] flex items-center justify-center text-white shrink-0 shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white flex items-center gap-2">
                <span>Disponible en application mobile (iPhone & Android)</span>
              </div>
              <p className="text-[#8e918f] text-[11px] mt-0.5">
                Installe Si Driss sur ton écran d'accueil pour réviser tes cours en plein écran rapide.
              </p>
            </div>
          </div>

          <button
            onClick={handleClick}
            className="px-3.5 py-2 rounded-xl bg-[#282a2c] hover:bg-[#3c4043] text-white font-semibold text-xs flex items-center justify-center gap-2 transition shrink-0 border border-[#3c4043]"
          >
            <Download className="w-3.5 h-3.5 text-[#8ab4f8]" />
            <span>{isIOS ? 'Installer sur iPhone' : "Installer l'App"}</span>
          </button>
        </div>

        <AndroidInstallModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1e1f20] hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white border border-[#282a2c] text-xs font-medium transition"
        title={isIOS ? 'Installer Si Driss sur ton iPhone / iPad' : "Installer Si Driss sur ton smartphone ou PC"}
      >
        <Smartphone className="w-3.5 h-3.5 text-[#8ab4f8]" />
        <span className="hidden sm:inline">
          {isIOS ? 'App iPhone' : 'Installer App'}
        </span>
        <span className="sm:hidden">App</span>
      </button>

      <AndroidInstallModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
