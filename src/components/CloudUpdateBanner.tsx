import React, { useState, useEffect } from 'react';
import { RefreshCw, ArrowUpCircle, CheckCircle2, AlertTriangle, X, Terminal } from 'lucide-react';

interface VersionCheckData {
  isCloud: boolean;
  cloudReachable: boolean;
  upToDate: boolean;
  hasUpdate: boolean;
  localCommit: string;
  localDate: string;
  cloudCommit?: string;
  cloudDate?: string;
  cloudCommitMessage?: string;
  message: string;
}

export const CloudUpdateBanner: React.FC = () => {
  const [data, setData] = useState<VersionCheckData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('sidriss_update_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [updating, setUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    // Ne jamais interroger ni afficher la bannière sur le serveur Cloud de production (ex: Render)
    if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
      return;
    }

    let isMounted = true;
    fetch('/api/version/check')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: VersionCheckData | null) => {
        if (!isMounted || !json) return;
        setData(json);
      })
      .catch(() => {
        // Mode autonome / hors-ligne
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('sidriss_update_banner_dismissed', 'true');
    } catch {}
  };

  const handleApplyUpdate = async () => {
    setUpdating(true);
    setUpdateError(null);
    try {
      const res = await fetch('/api/version/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setUpdateSuccess(true);
        setData((prev) => (prev ? { ...prev, hasUpdate: false, upToDate: true } : null));
        handleDismiss();
      } else {
        setUpdateError(result.message || 'La mise à jour a échoué. Utilisez la commande manuelle ci-dessous.');
      }
    } catch (err: any) {
      setUpdateError(err?.message || 'Erreur réseau lors de la mise à jour.');
    } finally {
      setUpdating(false);
    }
  };

  if (!data || !data.hasUpdate || isDismissed || data.isCloud) {
    return null;
  }

  // Double vérification client : pas de bannière sur onrender.com
  if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
    return null;
  }

  return (
    <>
      {/* BANNER EN HAUT DE L'APPLICATION */}
      <div className="w-full bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-slate-900/90 border-b border-amber-500/30 px-3 sm:px-4 py-2 flex items-center justify-between text-xs text-amber-200 z-20 shrink-0 shadow-xs">
        <div className="flex items-center gap-2 overflow-hidden mr-2">
          <ArrowUpCircle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
          <span className="truncate">
            <strong className="text-amber-300 font-semibold">Mise à jour disponible :</strong> Le serveur Cloud (si-driss.onrender.com) dispose d'une version plus récente ({data.cloudCommit || 'nouvelle'}).
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 active:bg-amber-500/40 text-amber-300 hover:text-white font-medium transition cursor-pointer border border-amber-500/40 text-[11px]"
          >
            Mettre à jour
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded text-amber-400/60 hover:text-amber-200 hover:bg-amber-500/10 transition cursor-pointer"
            title="Masquer le bandeau"
            aria-label="Fermer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* MODALE DÉTAILLÉE DE SYNCHRONISATION */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#1e1f20] border border-[#3c4043] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#282a2c] flex items-center justify-between bg-[#18191a]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Synchronisation avec le Cloud</h3>
                  <p className="text-[11px] text-[#8e918f]">Contrôle continu avec si-driss.onrender.com</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full text-[#8e918f] hover:text-white hover:bg-[#282a2c] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 text-xs">
              {updateSuccess ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 font-medium text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    Mise à jour effectuée avec succès !
                  </div>
                  <p className="text-[11px] text-emerald-300/80">
                    Le code local a été synchronisé avec la dernière version de GitHub. Rechargez la page pour appliquer tous les changements.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-2 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition cursor-pointer"
                  >
                    Recharger la page maintenant
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[#131314] border border-[#282a2c]">
                      <div className="text-[10px] text-[#8e918f] uppercase tracking-wider font-semibold">Votre version locale</div>
                      <div className="mt-1 font-mono text-sm text-slate-300 font-bold">{data.localCommit}</div>
                      <div className="mt-1 text-[11px] text-[#8e918f] truncate">
                        {data.localDate ? new Date(data.localDate).toLocaleDateString('fr-FR') : 'Non daté'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                      <div className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold flex items-center justify-between">
                        <span>Serveur Cloud</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      </div>
                      <div className="mt-1 font-mono text-sm text-amber-300 font-bold">{data.cloudCommit || 'Dernière'}</div>
                      <div className="mt-1 text-[11px] text-amber-300/70 truncate">
                        {data.cloudDate ? new Date(data.cloudDate).toLocaleDateString('fr-FR') : 'Récente'}
                      </div>
                    </div>
                  </div>

                  {data.cloudCommitMessage && (
                    <div className="p-3 rounded-xl bg-[#131314] border border-[#282a2c] text-[#c4c7c5]">
                      <div className="text-[10px] text-[#8e918f] uppercase tracking-wider font-semibold mb-1">Dernière modification :</div>
                      <p className="text-[11px] italic text-slate-200">« {data.cloudCommitMessage} »</p>
                    </div>
                  )}

                  {updateError && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="text-[11px]">{updateError}</div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <button
                      onClick={handleApplyUpdate}
                      disabled={updating}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:from-amber-600 active:to-amber-700 text-slate-950 font-semibold transition cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
                      {updating ? 'Mise à jour en cours…' : 'Mettre à jour le code local maintenant'}
                    </button>

                    <div className="p-2.5 rounded-lg bg-black/40 border border-[#282a2c] font-mono text-[11px] text-[#8e918f] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-[#8e918f]" />
                        <code>git pull origin main && npm install</code>
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
