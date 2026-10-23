import React from 'react';
import { Smartphone, X, Download, CheckCircle2, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, install, isIOS } = usePWAInstall();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-slate-900 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Application Android Si Driss
              </h2>
              <p className="text-xs text-slate-400">Installer directement sur ton smartphone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-300 overflow-y-auto max-h-[75vh]">
          {/* App preview badge */}
          <div className="flex items-center gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-md">
              SD
            </div>
            <div>
              <div className="font-bold text-white text-sm">Si Driss PC</div>
              <div className="text-[11px] text-emerald-400">Application PWA Android certifiée</div>
              <div className="text-[10px] text-slate-400">Version 2.0 • 2ème Bac PC BIOF</div>
            </div>
          </div>

          {/* Advantages */}
          <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80">
            <span className="font-semibold text-slate-200 block text-xs">
              Avantages de l'application Android :
            </span>
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong>Plein écran natif</strong> : Aucune barre de navigateur Chrome gênante.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong>Accès en 1 clic</strong> depuis l'écran d'accueil de ton téléphone.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong>Mode hors-ligne</strong> pour réviser tes formules et fiches même sans 4G/Wifi.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong>Sauvegarde automatique</strong> de ta clé API et de tes sessions de révision.</span>
              </li>
            </ul>
          </div>

          {/* Direct Install Button if supported by browser */}
          {isInstallable && (
            <button
              onClick={async () => {
                await install();
                onClose();
              }}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg"
            >
              <Download className="w-4 h-4" />
              <span>Installer maintenant sur Android en 1 clic</span>
            </button>
          )}

          {/* Manual Instructions for Android Chrome */}
          <div className="space-y-2.5">
            <span className="font-bold text-slate-200 block text-xs">
              {isIOS ? 'Installation sur iPhone / iPad :' : 'Comment installer manuellement sur Android :'}
            </span>
            {isIOS ? (
              <ol className="list-decimal list-inside space-y-2 text-[11px] text-slate-300 pl-1 leading-relaxed">
                <li>Appuie sur le bouton <strong>Partager</strong> (icône avec une flèche vers le haut) dans la barre de Safari.</li>
                <li>Fais défiler la liste et appuie sur <strong>« Sur l'écran d'accueil »</strong> (Add to Home Screen).</li>
                <li>Appuie sur <strong>Ajouter</strong> en haut à droite. L'icône Si Driss sera sur ton écran d'accueil.</li>
              </ol>
            ) : (
              <ol className="list-decimal list-inside space-y-2 text-[11px] text-slate-300 pl-1 leading-relaxed">
                <li>
                  Dans ton navigateur Android (Chrome, Samsung Internet, Brave), appuie sur le menu{' '}
                  <strong className="text-white">« ⋮ » (Trois points verticaux)</strong> en haut à droite.
                </li>
                <li>
                  Sélectionne{' '}
                  <strong className="text-emerald-400">« Installer l'application »</strong> ou{' '}
                  <strong className="text-emerald-400">« Ajouter à l'écran d'accueil »</strong>.
                </li>
                <li>
                  Valide en appuyant sur <strong className="text-white">« Installer »</strong>. L'application apparaîtra comme une vraie application parmi tes applications Android !
                </li>
              </ol>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
};
