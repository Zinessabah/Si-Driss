import React, { useState, useEffect, useRef } from 'react';
import { FlaskConical, CheckCircle2, XCircle, Info } from 'lucide-react';

interface Indicator {
  name: string;
  pKa: number;
  minPh: number;
  maxPh: number;
  acidColor: string;
  baseColor: string;
}

const INDICATORS: Indicator[] = [
  { name: 'Hélianthine (Méthylorange)', pKa: 3.7, minPh: 3.1, maxPh: 4.4, acidColor: '#ef4444', baseColor: '#f59e0b' },
  { name: 'Rouge de Méthyle', pKa: 5.1, minPh: 4.2, maxPh: 6.2, acidColor: '#f43f5e', baseColor: '#eab308' },
  { name: 'Bleu de Bromothymol (BBT)', pKa: 7.0, minPh: 6.0, maxPh: 7.6, acidColor: '#eab308', baseColor: '#3b82f6' },
  { name: 'Phénolphtaléine', pKa: 9.1, minPh: 8.2, maxPh: 10.0, acidColor: 'transparent', baseColor: '#ec4899' },
];

export const TitrationSimulator: React.FC = () => {
  const [Va, setVa] = useState<number>(20.0); // mL
  const [Ca, setCa] = useState<number>(0.075); // mol/L
  const [Cb, setCb] = useState<number>(0.100); // mol/L
  const [pKa, setPKa] = useState<number>(4.8); // Ethanoic acid
  const [selectedIndicator, setSelectedIndicator] = useState<string>('Phénolphtaléine');
  const [showTangents, setShowTangents] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // VbE = (Ca * Va) / Cb
  const VbE = (Ca * Va) / Cb; // in mL
  // pH at equivalence: weak acid + strong base => basic salt => pH_E = 7 + 0.5*(pKa + log(C_sel))
  const C_sel = (Ca * Va) / (Va + VbE);
  const pHe = Math.min(13, 7 + 0.5 * (pKa + Math.log10(C_sel)));

  // Half-equivalence: Vb = VbE / 2 => pH = pKa
  const VbHalf = VbE / 2;

  // Selected indicator check
  const ind = INDICATORS.find((i) => i.name === selectedIndicator);
  const isIndicatorValid = ind ? pHe >= ind.minPh && pHe <= ind.maxPh : false;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 35) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const originX = 50;
    const originY = height - 35;
    const maxVb = 30; // mL
    const maxPh = 14;

    // Draw pH Axis
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originX, 15);
    ctx.lineTo(originX, originY);
    ctx.lineTo(width - 15, originY);
    ctx.stroke();

    // pH markers on Y axis (0, 7, 14)
    ctx.font = '10px "Fira Code", monospace';
    ctx.fillStyle = '#94a3b8';
    [2, 4, 7, 10, 14].forEach((p) => {
      const y = originY - (p / maxPh) * (originY - 20);
      ctx.fillText(`${p}`, originX - 22, y + 3);
      ctx.beginPath();
      ctx.moveTo(originX - 4, y);
      ctx.lineTo(originX, y);
      ctx.stroke();
    });

    // Indicator virage zone overlay if selected
    if (ind) {
      const yTop = originY - (ind.maxPh / maxPh) * (originY - 20);
      const yBottom = originY - (ind.minPh / maxPh) * (originY - 20);
      ctx.fillStyle = isIndicatorValid ? 'rgba(52, 211, 153, 0.12)' : 'rgba(244, 63, 94, 0.12)';
      ctx.fillRect(originX, yTop, width - originX - 15, yBottom - yTop);

      ctx.fillStyle = isIndicatorValid ? '#34d399' : '#f43f5e';
      ctx.fillText(`Zone de virage [${ind.minPh} - ${ind.maxPh}]`, width - 170, yTop + 14);
    }

    // Function to calculate theoretical pH as function of Vb
    const calcPh = (v: number) => {
      if (v <= 0.05) {
        // Initial weak acid: pH = 0.5*(pKa - log Ca)
        return 0.5 * (pKa - Math.log10(Ca));
      } else if (v < VbE * 0.99) {
        // Buffer zone: Henderson-Hasselbalch
        // [A-] = Cb*v / (Va+v), [AH] = (Ca*Va - Cb*v)/(Va+v)
        const ratio = (Cb * v) / (Ca * Va - Cb * v);
        return pKa + Math.log10(Math.max(0.001, ratio));
      } else if (Math.abs(v - VbE) <= 0.15) {
        return pHe;
      } else {
        // Excess strong base
        const excess = (Cb * (v - VbE)) / (Va + v);
        const pOH = -Math.log10(Math.max(1e-7, excess));
        return 14 - pOH;
      }
    };

    // Plot pH = f(Vb)
    ctx.strokeStyle = '#a855f7'; // Purple curve
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const steps = 400;
    for (let i = 0; i <= steps; i++) {
      const v = (i / steps) * maxVb;
      const ph = Math.min(13.8, Math.max(1.5, calcPh(v)));
      const x = originX + (v / maxVb) * (width - originX - 25);
      const y = originY - (ph / maxPh) * (originY - 20);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Equivalence Point E(VbE, pHe)
    const xE = originX + (VbE / maxVb) * (width - originX - 25);
    const yE = originY - (pHe / maxPh) * (originY - 20);

    // Tangents Method lines if enabled
    if (showTangents) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;

      // Drop lines for E
      ctx.beginPath();
      ctx.moveTo(xE, originY);
      ctx.lineTo(xE, yE);
      ctx.lineTo(originX, yE);
      ctx.stroke();

      // Half equivalence lines
      const xHalf = originX + (VbHalf / maxVb) * (width - originX - 25);
      const yHalf = originY - (pKa / maxPh) * (originY - 20);
      ctx.strokeStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(xHalf, originY);
      ctx.lineTo(xHalf, yHalf);
      ctx.lineTo(originX, yHalf);
      ctx.stroke();
      ctx.setLineDash([]);

      // Point Half-Eq dot
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(xHalf, yHalf, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(`Demi-Éq (pH = pKa = ${pKa})`, xHalf + 8, yHalf - 4);
    }

    // Point E dot
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(xE, yE, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '11px "Fira Code", monospace';
    ctx.fillText(`E (V_bE=${VbE.toFixed(1)} mL, pH_E=${pHe.toFixed(2)})`, xE + 8, yE + 4);

    // Axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Volume V_b versé (mL)`, width - 150, originY + 25);
    ctx.fillText(`pH`, originX - 35, 20);
  }, [Va, Ca, Cb, pKa, VbE, pHe, VbHalf, ind, isIndicatorValid, showTangents]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg">
              <FlaskConical className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-white">Laboratoire Chimie : Titrage Acido-Basique & Indicateurs</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Suivi pH-métrique, méthode des tangentes parallèles, demi-équivalence et critère du virage coloré
          </p>
        </div>

        <button
          onClick={() => setShowTangents(!showTangents)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
            showTangents
              ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          {showTangents ? 'Masquer repères d\'équivalence' : 'Afficher repères d\'équivalence'}
        </button>
      </div>

      {/* Screen Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
        <canvas ref={canvasRef} width={800} height={270} className="w-full h-64 block" />
      </div>

      {/* Indicator Selection and Official Test */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-300">
            Choisir un indicateur coloré pour le titrage :
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            Critère officiel : la zone de virage doit encadrer $pH_E = {pHe.toFixed(2)}$
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {INDICATORS.map((indicator) => {
            const isSelected = selectedIndicator === indicator.name;
            const valid = pHe >= indicator.minPh && pHe <= indicator.maxPh;
            return (
              <button
                key={indicator.name}
                onClick={() => setSelectedIndicator(indicator.name)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? valid
                      ? 'bg-emerald-950/60 border-emerald-500/50 shadow-md ring-1 ring-emerald-500'
                      : 'bg-rose-950/60 border-rose-500/50 shadow-md ring-1 ring-rose-500'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-slate-200 truncate">{indicator.name}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  [{indicator.minPh} - {indicator.maxPh}]
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                  {valid ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Convenable
                    </span>
                  ) : (
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Inadapté
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Concentration acide $C_A$ :</span>
            <span className="font-mono text-purple-400 font-bold">{Ca.toFixed(3)} mol/L</span>
          </div>
          <input
            type="range"
            min={0.02}
            max={0.15}
            step={0.005}
            value={Ca}
            onChange={(e) => setCa(Number(e.target.value))}
            className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Concentration base $C_B$ :</span>
            <span className="font-mono text-purple-400 font-bold">{Cb.toFixed(3)} mol/L</span>
          </div>
          <input
            type="range"
            min={0.05}
            max={0.20}
            step={0.01}
            value={Cb}
            onChange={(e) => setCb(Number(e.target.value))}
            className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">$pK_A$ de l'acide faible :</span>
            <span className="font-mono text-purple-400 font-bold">{pKa.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={3.0}
            max={6.5}
            step={0.1}
            value={pKa}
            onChange={(e) => setPKa(Number(e.target.value))}
            className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
