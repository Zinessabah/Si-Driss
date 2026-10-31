import React, { useState } from 'react';
import { FileText, FileDown, Loader2, Check } from 'lucide-react';

interface ExportResponseButtonsProps {
  content: string;
  title?: string;
  branch?: string;
  compact?: boolean;
}

export const ExportResponseButtons: React.FC<ExportResponseButtonsProps> = ({
  content,
  title,
  branch,
  compact = false,
}) => {
  const [exportingType, setExportingType] = useState<'pdf' | 'docx' | null>(null);
  const [successType, setSuccessType] = useState<'pdf' | 'docx' | null>(null);
  // (M16) Progression du rendu PDF page par page, affichée sur le bouton
  const [pdfProgress, setPdfProgress] = useState<string | null>(null);

  const handleExportPdf = async () => {
    if (!content.trim() || exportingType) return;
    setExportingType('pdf');
    setPdfProgress(null);
    try {
      // (H10) jspdf + html2canvas ne sont chargés qu'au moment du clic
      const { exportToPdf } = await import('../utils/documentExporter');
      await exportToPdf({
        title,
        content,
        branch,
        onProgress: (done, total) => setPdfProgress(`${done}/${total}`),
      });
      setSuccessType('pdf');
      setTimeout(() => setSuccessType(null), 2000);
    } catch (err) {
      console.error('Erreur export PDF:', err);
    } finally {
      setExportingType(null);
      setPdfProgress(null);
    }
  };

  const handleExportDocx = async () => {
    if (!content.trim() || exportingType) return;
    setExportingType('docx');
    try {
      // (H10) docx n'est chargé qu'au moment du clic
      const { exportToDocx } = await import('../utils/documentExporter');
      await exportToDocx({
        title,
        content,
        branch,
      });
      setSuccessType('docx');
      setTimeout(() => setSuccessType(null), 2000);
    } catch (err) {
      console.error('Erreur export DOCX:', err);
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      {/* Bouton PDF */}
      <button
        type="button"
        onClick={handleExportPdf}
        disabled={exportingType !== null}
        className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 text-[11px] font-medium border ${
          successType === 'pdf'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : 'bg-[#1e1f20] hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white border-[#3c4043] shadow-xs'
        } disabled:opacity-50`}
        title="Générer et télécharger cette réponse en PDF officiel"
        aria-live="polite"
      >
        {exportingType === 'pdf' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
        ) : successType === 'pdf' ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <FileDown className="w-3.5 h-3.5 text-rose-400" />
        )}
        <span>{pdfProgress ? `PDF ${pdfProgress}` : 'PDF'}</span>
      </button>

      {/* Bouton Word / DOCX */}
      <button
        type="button"
        onClick={handleExportDocx}
        disabled={exportingType !== null}
        className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 text-[11px] font-medium border ${
          successType === 'docx'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : 'bg-[#1e1f20] hover:bg-[#282a2c] text-[#c4c7c5] hover:text-white border-[#3c4043] shadow-xs'
        } disabled:opacity-50`}
        title="Générer et télécharger cette réponse en document Word (.docx)"
      >
        {exportingType === 'docx' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
        ) : successType === 'docx' ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-sky-400" />
        )}
        <span>{compact ? 'Docx' : 'Word (.docx)'}</span>
      </button>
    </div>
  );
};
