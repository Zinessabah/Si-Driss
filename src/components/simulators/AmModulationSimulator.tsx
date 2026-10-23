import React, { useState, useEffect, useRef } from 'react';
import { Radio, AlertTriangle, CheckCircle, Sliders } from 'lucide-react';
import { MathView } from '../MathView';

export const AmModulationSimulator: React.FC = () => {
  const [Sm, setSm] = useState<number>(2.0); // Signal amplitude (V)
  const [U0, setU0] = useState<number>(3.5); // Offset voltage (V)
  const [fs, setFs] = useState<number>(200); // Signal frequency (Hz)
  const [Fp, setFp] = useState<number>(2500); // Carrier frequency (Hz)
  const [viewMode, setViewMode] = useState<'temporal' | 'xy'>('temporal');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Modulation rate m = Sm / U0
  const m = Sm / U0;
  const isGoodModulation = m < 1.0 && Fp >= 10 * fs;

  // Trapezoid dimensions
  const Umax = U0 + Sm;
  const Umin = Math.max(0, U0 - Sm);

  // Envelope detection condition: Tp << RC < Ts
  const Tp = 1 / Fp; // s
  const Ts = 1 / fs; // s

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 32;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (viewMode === 'temporal') {
      // Draw Zero Axis
      const zeroY = height / 2;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(width, zeroY);
      ctx.stroke();

      const points = 600;
      // Show 2 periods of the audio signal: 2 * Ts
      const totalDuration = 2.5 * Ts;

      // Draw Upper and Lower Envelopes (dotted line)
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#f59e0b'; // Amber for upper envelope
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < points; i++) {
        const t = (i / points) * totalDuration;
        const envelope = U0 + Sm * Math.cos(2 * Math.PI * fs * t);
        const x = (i / points) * width;
        const y = zeroY - (envelope / 8) * (height * 0.42);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Lower envelope
      ctx.beginPath();
      for (let i = 0; i < points; i++) {
        const t = (i / points) * totalDuration;
        const envelope = -(U0 + Sm * Math.cos(2 * Math.PI * fs * t));
        const x = (i / points) * width;
        const y = zeroY - (envelope / 8) * (height * 0.42);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Draw Modulated Signal HF
      ctx.strokeStyle = '#38bdf8'; // Sky blue
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i < points; i++) {
        const t = (i / points) * totalDuration;
        const s = (U0 + Sm * Math.cos(2 * Math.PI * fs * t)) * Math.cos(2 * Math.PI * Fp * t);
        const x = (i / points) * width;
        const y = zeroY - (s / 8) * (height * 0.42);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Canvas Label
      ctx.font = '12px "Fira Code", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`u(t) Modulée HF`, 15, 25);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`Enveloppe s(t) + U_0`, 160, 25);
    } else {
      // XY Mode (Trapezoidal Figure)
      const centerX = width / 2;
      const centerY = height / 2;

      // Axes
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, height);
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Draw Trapezoid
      ctx.strokeStyle = m <= 1.0 ? '#34d399' : '#f87171'; // Green if good, Red if overmodulated
      ctx.lineWidth = 2.5;

      const scale = 25;
      const xLeft = centerX - Sm * scale;
      const xRight = centerX + Sm * scale;
      const ySmall = (Umin / 2) * scale;
      const yBig = (Umax / 2) * scale;

      ctx.beginPath();
      if (m < 1.0) {
        // True trapezoid
        ctx.moveTo(xLeft, centerY - ySmall);
        ctx.lineTo(xRight, centerY - yBig);
        ctx.lineTo(xRight, centerY + yBig);
        ctx.lineTo(xLeft, centerY + ySmall);
        ctx.closePath();
      } else {
        // Overmodulated crossed figure (butterfly/hourglass)
        const xZero = centerX - (U0 / (Sm / 1)) * scale;
        ctx.moveTo(xLeft, centerY + ySmall);
        ctx.lineTo(xZero, centerY);
        ctx.lineTo(xRight, centerY - yBig);
        ctx.lineTo(xRight, centerY + yBig);
        ctx.lineTo(xZero, centerY);
        ctx.lineTo(xLeft, centerY - ySmall);
        ctx.closePath();
      }
      ctx.stroke();

      ctx.font = '12px "Fira Code", monospace';
      ctx.fillStyle = m <= 1.0 ? '#34d399' : '#f87171';
      ctx.fillText(
        m <= 1.0
          ? `Mode XY : Trapèze régulier (m = ${m.toFixed(2)} < 1)`
          : `Mode XY : Nœud papillon croisé (Surmodulation ! m = ${m.toFixed(2)} > 1)`,
        20,
        25
      );
    }
  }, [Sm, U0, fs, Fp, viewMode, m, Ts, Umax, Umin]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Radio className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-white">Laboratoire Modulation AM (Spécifique 2ème Bac PC)</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Étude du taux de modulation $m$, condition de bonne modulation et méthode du trapèze en mode XY
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode('temporal')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              viewMode === 'temporal' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Oscillogramme Temporel $u(t)$
          </button>
          <button
            onClick={() => setViewMode('xy')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              viewMode === 'xy' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Figure Trapézoïdale (Mode XY)
          </button>
        </div>
      </div>

      {/* Screen Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
        <canvas ref={canvasRef} width={800} height={260} className="w-full h-56 block" />

        {/* Floating status */}
        <div
          className={`absolute top-3 right-3 text-xs px-3 py-1.5 rounded-lg border flex items-center gap-2 font-mono ${
            isGoodModulation
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
          }`}
        >
          {isGoodModulation ? (
            <>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Bonne modulation : $m = {m.toFixed(2)}$ (&lt; 1)</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Surmodulation ($m = {m.toFixed(2)} \ge 1$)</span>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
        {/* Signal Amplitude Sm */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Amplitude signal $S_m$ :</span>
            <span className="font-mono text-emerald-400 font-bold">{Sm.toFixed(1)} V</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={5.0}
            step={0.1}
            value={Sm}
            onChange={(e) => setSm(Number(e.target.value))}
            className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Offset Voltage U0 */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Tension décalage $U_0$ :</span>
            <span className="font-mono text-emerald-400 font-bold">{U0.toFixed(1)} V</span>
          </div>
          <input
            type="range"
            min={1.0}
            max={6.0}
            step={0.1}
            value={U0}
            onChange={(e) => setU0(Number(e.target.value))}
            className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Signal Frequency fs */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Fréquence info $f_s$ (BF) :</span>
            <span className="font-mono text-emerald-400 font-bold">{fs} Hz</span>
          </div>
          <input
            type="range"
            min={50}
            max={500}
            step={25}
            value={fs}
            onChange={(e) => setFs(Number(e.target.value))}
            className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Carrier Frequency Fp */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Fréquence porteuse $F_p$ (HF) :</span>
            <span className="font-mono text-emerald-400 font-bold">{Fp} Hz</span>
          </div>
          <input
            type="range"
            min={1000}
            max={5000}
            step={250}
            value={Fp}
            onChange={(e) => setFp(Number(e.target.value))}
            className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Official Exam Criteria Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
          <div className="font-semibold text-slate-200">1. Condition de non-surmodulation :</div>
          <div className="text-slate-400 space-y-1">
            <MathView content="$$m = \frac{S_m}{U_0} = \frac{U_{max} - U_{min}}{U_{max} + U_{min}} < 1 \iff U_0 > S_m$$" />
            <div>
              Actuellement : <span className="font-mono text-emerald-400 font-bold">m = {m.toFixed(2)}</span>
              {m >= 1 ? " (ALERTE : Inversion de l'enveloppe !)" : " (Condition validée)"}
            </div>
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
          <div className="font-semibold text-slate-200">2. Condition sur le détecteur d'enveloppe :</div>
          <div className="text-slate-400 font-mono space-y-1">
            <MathView content="$T_p \ll \tau = RC < T_s$ soit :" />
            <div>
              {(Tp * 1000).toFixed(3)} ms &lt;&lt; RC &lt; {(Ts * 1000).toFixed(2)} ms
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
