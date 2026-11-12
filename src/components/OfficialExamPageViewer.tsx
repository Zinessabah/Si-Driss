import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import type { OfficialSourceRef } from '../types/chat';
import { getAccessToken } from '../hooks/useApiKey';

interface OfficialExamPageViewerProps {
  source: OfficialSourceRef;
  onPreviewImage?: (preview: { url: string; name: string }) => void;
}

let workerInitialized = false;

/**
 * Affiche fidèlement la/les page(s) exacte(s) du document PDF officiel de l'Examen National
 * directement dans la bulle de réponse de Si Driss via pdfjs-dist (côté navigateur, 0 charge serveur).
 */
export const OfficialExamPageViewer: React.FC<OfficialExamPageViewerProps> = ({
  source,
  onPreviewImage,
}) => {
  const initialPage = source.pages?.[0] && source.pages[0] >= 1 ? source.pages[0] : 1;
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(Math.max(1, source.totalPages || 1));
  const [expanded, setExpanded] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const pdfUrl = `/api/documents/official/pdf?name=${encodeURIComponent(
    source.relativePath || source.name
  )}`;

  // Reset active page if source reference changes
  useEffect(() => {
    setCurrentPage(source.pages?.[0] && source.pages[0] >= 1 ? source.pages[0] : 1);
    setTotalPages(Math.max(1, source.totalPages || 1));
  }, [source.name, source.relativePath, source.totalPages, source.pages]);

  // Charge le document PDF une fois quand la carte est dépliée, et libère la mémoire au démontage
  useEffect(() => {
    if (!expanded) return;

    let cancelled = false;
    setRendering(true);
    setErrorMsg('');

    const loadAndRender = async () => {
      try {
        const [pdfjsLib, workerMod] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ]);

        if (!workerInitialized) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;
          workerInitialized = true;
        }

        if (!pdfDocRef.current || pdfDocRef.current._sourceUrl !== pdfUrl) {
          if (pdfDocRef.current) {
            try {
              await pdfDocRef.current.destroy();
            } catch {}
            pdfDocRef.current = null;
          }

          const accessToken = getAccessToken();
          const loadingTask = pdfjsLib.getDocument({
            url: pdfUrl,
            httpHeaders: accessToken ? { 'x-access-token': accessToken } : undefined,
            disableAutoFetch: true,
            disableStream: false,
          });
          const doc = await loadingTask.promise;
          if (cancelled) {
            await doc.destroy().catch(() => {});
            return;
          }
          (doc as any)._sourceUrl = pdfUrl;
          pdfDocRef.current = doc;
          setTotalPages(doc.numPages || source.totalPages || 1);
        }

        const doc = pdfDocRef.current;
        const safePage = Math.max(1, Math.min(doc.numPages || 1, currentPage));
        if (safePage !== currentPage) {
          setCurrentPage(safePage);
        }

        const page = await doc.getPage(safePage);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssScale = 1.45;
        const baseViewport = page.getViewport({ scale: cssScale });
        const outputScale = dpr;

        canvas.width = Math.floor(baseViewport.width * outputScale);
        canvas.height = Math.floor(baseViewport.height * outputScale);

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        const renderContext = {
          canvasContext: ctx,
          viewport: baseViewport,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        if (!cancelled) {
          setRendering(false);
        }
      } catch (err: any) {
        if (cancelled || err?.name === 'RenderingCancelledException') return;
        console.warn('[OfficialExamPageViewer] Erreur rendu PDF:', err);
        setErrorMsg("Impossible d'afficher l'aperçu de cette page.");
        setRendering(false);
      }
    };

    void loadAndRender();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
        renderTaskRef.current = null;
      }
    };
  }, [pdfUrl, currentPage, expanded]);

  // Libération explicite de la mémoire PDF.js à la destruction du composant
  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch {}
        pdfDocRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
    };
  }, []);

  const handleZoom = () => {
    const canvas = canvasRef.current;
    if (!canvas || !onPreviewImage) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      onPreviewImage({
        url: dataUrl,
        name: `${source.name} — Page ${currentPage}/${totalPages}`,
      });
    } catch {}
  };

  const labelParts = [
    source.branch && source.branch !== 'ALL' ? `2BAC ${source.branch}` : null,
    source.year ? String(source.year) : null,
    source.session || null,
    source.topic ? source.topic.toUpperCase() : null,
  ].filter(Boolean);

  return (
    <div className="my-2.5 rounded-2xl bg-[#18191b] border border-[#3c4043]/80 shadow-lg overflow-hidden">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-[#1e1f20] border-b border-[#282a2c]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-[#e3e3e3] truncate max-w-[210px] sm:max-w-[300px]">
                Extrait Officiel : {source.name}
              </span>
              {labelParts.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 font-medium">
                  {labelParts.join(' · ')}
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#8e918f]">
              {source.pages.length > 1
                ? `Pages de l'exercice : ${source.pages.join(', ')} sur ${totalPages}`
                : `Page ciblée : ${source.pages[0] || 1} sur ${totalPages}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {expanded && onPreviewImage && !errorMsg && (
            <button
              type="button"
              onClick={handleZoom}
              className="p-1.5 rounded-lg hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white transition flex items-center gap-1 text-[11px]"
              title="Agrandir la page officielle"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Zoom</span>
            </button>
          )}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white transition flex items-center gap-1 text-[11px]"
            title="Ouvrir le sujet PDF officiel complet"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </a>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="p-1.5 rounded-lg hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white transition"
            title={expanded ? "Masquer l'extrait PDF" : "Afficher l'extrait PDF"}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Rendered Page Body */}
      {expanded && (
        <div className="p-3 bg-[#111214] space-y-2.5">
          {/* Page Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded-lg bg-[#1e1f20] border border-[#3c4043] text-[#e3e3e3] disabled:opacity-35 hover:bg-[#282a2c] transition"
                title="Page précédente"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-[11px] font-medium text-[#c4c7c5]">
                Page {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded-lg bg-[#1e1f20] border border-[#3c4043] text-[#e3e3e3] disabled:opacity-35 hover:bg-[#282a2c] transition"
                title="Page suivante"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Page Selector (exercise pages highlighted) */}
            <div className="flex items-center flex-wrap gap-1">
              {(totalPages <= 10
                ? Array.from({ length: totalPages }, (_, i) => i + 1)
                : source.pages
              ).map((pNum) => {
                const isActive = pNum === currentPage;
                const isTarget = source.pages.includes(pNum);
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => setCurrentPage(pNum)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition border ${
                      isActive
                        ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                        : isTarget
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                        : 'bg-[#1e1f20] border-[#282a2c] text-[#8e918f] hover:text-[#e3e3e3]'
                    }`}
                    title={isTarget ? "Page de l'exercice détecté" : `Aller à la page ${pNum}`}
                  >
                    p.{pNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Canvas Container */}
          <div className="relative flex justify-center rounded-xl overflow-hidden border border-[#282a2c] bg-white/95">
            {rendering && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#111214]/70 backdrop-blur-[1px]">
                <div className="flex items-center gap-2 text-xs text-[#e3e3e3] px-3 py-1.5 rounded-full bg-[#1e1f20] border border-[#3c4043]">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  <span>Chargement de la page officielle…</span>
                </div>
              </div>
            )}

            {errorMsg ? (
              <div className="p-6 text-center bg-[#18191b] text-xs text-rose-300 w-full space-y-2">
                <p>{errorMsg}</p>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#282a2c] text-[#e3e3e3] hover:bg-[#3c4043] transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ouvrir le PDF directement
                </a>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                onClick={handleZoom}
                className="w-full h-auto max-h-[540px] object-contain cursor-zoom-in block"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

