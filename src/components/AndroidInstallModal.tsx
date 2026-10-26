import React, { useState } from 'react';
import {
  Smartphone,
  X,
  Download,
  CheckCircle2,
  Share,
  PlusSquare,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Apple,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, install, isIOS } = usePWAInstall();
  const [activePlatform, setActivePlatform] = useState<'ios' | 'android'>(() => (isIOS ? 'ios' : 'android'));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#1e1f20] border border-[#3c4043] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-[#e3e3e3]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#282a2c] flex items-center justify-between bg-[#17181c]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#4285f4] via-[#9b72cb] to-[#f59e0b] flex items-center justify-center text-white shadow-md">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Installer Si Driss
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Gratuit
                </span>
              </h2>
              <p className="text-xs text-[#8e918f]">Sur iPhone, iPad et Android</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#282a2c] hover:bg-[#3c4043] flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Platform Tabs (iPhone / iPad vs Android) */}
        <div className="grid grid-cols-2 p-1.5 m-3 bg-[#131314] rounded-2xl border border-[#282a2c]">
          <button
            type="button"
            onClick={() => setActivePlatform('ios')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
              activePlatform === 'ios'
                ? 'bg-[#282a2c] text-white shadow-sm border border-[#3c4043]'
                : 'text-[#8e918f] hover:text-[#e3e3e3]'
            }`}
          >
            <span>iPhone / iPad (iOS)</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePlatform('android')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
              activePlatform === 'android'
                ? 'bg-[#282a2c] text-white shadow-sm border border-[#3c4043]'
                : 'text-[#8e918f] hover:text-[#e3e3e3]'
            }`}
          >
            <span>Android / PC</span>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-5 space-y-4 text-xs text-[#c4c7c5] overflow-y-auto max-h-[70vh] no-scrollbar">
          {/* App preview badge */}
          <div className="flex items-center gap-3 p-3 bg-[#131314] border border-[#282a2c] rounded-2xl">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center text-slate-950 font-black text-lg shadow-md shrink-0">
              SD
            </div>
            <div className="flex-1 truncate">
              <div className="font-bold text-white text-sm">Si Driss - Physique-Chimie</div>
              <div className="text-[11px] text-emerald-400">Application PWA certifiée (iOS & Android)</div>
              <div className="text-[10px] text-[#8e918f]">Plein écran sans barre de navigateur • Mode hors-ligne</div>
            </div>
          </div>

          {/* IPHONE / IPAD INSTRUCTIONS */}
          {activePlatform === 'ios' && (
            <div className="space-y-3 animate-in fade-in">
              <div className="p-3 bg-[#17181c] border border-amber-500/20 rounded-2xl text-[11px] text-amber-200/90 leading-relaxed">
                ℹ️ <strong>Sur iPhone</strong>, Apple utilise le navigateur <strong>Safari</strong> pour ajouter une application sur l'écran d'accueil.
              </div>

              <div className="space-y-2.5">
                <span className="font-bold text-white block text-xs">
                  Étapes simples (en 3 clics) :
                </span>

                <div className="space-y-2 text-xs">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3 p-3 bg-[#131314] rounded-2xl border border-[#282a2c]">
                    <div className="w-7 h-7 rounded-xl bg-[#282a2c] flex items-center justify-center text-[#8ab4f8] font-bold text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <div className="font-semibold text-white">Ouvre ce lien dans Safari</div>
                      <div className="text-[11px] text-[#8e918f]">
                        Si tu es dans une autre appli, copie l'URL et colle-la dans Safari.
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3 p-3 bg-[#131314] rounded-2xl border border-[#282a2c]">
                    <div className="w-7 h-7 rounded-xl bg-[#282a2c] flex items-center justify-center text-[#8ab4f8] font-bold text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span>Touche le bouton Partager</span>
                        <Share className="w-3.5 h-3.5 text-[#8ab4f8]" />
                      </div>
                      <div className="text-[11px] text-[#8e918f]">
                        C'est l'icône carrée avec une flèche vers le haut au bas de l'écran.
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3 p-3 bg-[#131314] rounded-2xl border border-[#282a2c]">
                    <div className="w-7 h-7 rounded-xl bg-[#282a2c] flex items-center justify-center text-[#8ab4f8] font-bold text-xs shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span>Choisis « Sur l'écran d'accueil »</span>
                        <PlusSquare className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="text-[11px] text-[#8e918f]">
                        Fais défiler la liste, appuie dessus, puis clique sur <strong>Ajouter</strong> en haut à droite.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[11px] text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>
                  L'icône <strong>Si Driss</strong> apparaîtra immédiatement sur ton écran d'iPhone, exactement comme une appli de l'App Store !
                </span>
              </div>
            </div>
          )}

          {/* ANDROID INSTRUCTIONS */}
          {activePlatform === 'android' && (
            <div className="space-y-3 animate-in fade-in">
              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    await install();
                    onClose();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  <span>Installer maintenant en 1 clic</span>
                </button>
              )}

              <div className="space-y-2">
                <span className="font-bold text-white block text-xs">
                  Comment installer sur Android (Chrome / Brave / Samsung) :
                </span>
                <ol className="list-decimal list-inside space-y-2 text-[11px] text-[#c4c7c5] pl-1 leading-relaxed">
                  <li>
                    Dans ton navigateur, appuie sur le menu{' '}
                    <strong className="text-white">« ⋮ » (Trois points verticaux)</strong> en haut à droite.
                  </li>
                  <li>
                    Sélectionne{' '}
                    <strong className="text-emerald-400">« Installer l'application »</strong> ou{' '}
                    <strong className="text-emerald-400">« Ajouter à l'écran d'accueil »</strong>.
                  </li>
                  <li>
                    Valide en appuyant sur <strong className="text-white">« Installer »</strong>. L'application apparaîtra parmi tes applications avec son icône dédiée.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* Avantages de l'application installée */}
          <div className="p-3 bg-[#131314] rounded-2xl border border-[#282a2c] space-y-1.5 text-[11px]">
            <div className="font-semibold text-white">Pourquoi l'installer sur ton téléphone ?</div>
            <div className="space-y-1 text-[#8e918f]">
              <div>• <strong>Plein écran natif</strong> : aucune barre d'adresse ni onglet.</div>
              <div>• <strong>Accès direct</strong> en 1 touche pour poser une question avant ton contrôle.</div>
              <div>• <strong>Clé API et discussions conservées</strong> sur ton appareil.</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#17181c] border-t border-[#282a2c] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#282a2c] hover:bg-[#3c4043] text-white text-xs font-semibold transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
