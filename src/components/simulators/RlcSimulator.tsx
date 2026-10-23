import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Zap, Sparkles } from 'lucide-react';
import { MathView } from '../MathView';

export const RlcSimulator: React.FC = () => {
  const [circuitMode, setCircuitMode] = useState<'RLC' | 'RC'>('RLC');
  const [R, setR] = useState<number>(20); // Ohms
  const [L, setL] = useState<number>(0.1); // Henry
  const [C, setC] = useState<number>(5); // microFarads
  const [E, setE] = useState<number>(6); // Volts
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [showEnergy, setShowEnergy] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  // Derived values
  const C_F = C * 1e-6; // Farads
  const tau_RC = R * C_F; // seconds
  const omega0 = 1 / Math.sqrt(L * C_F); // rad/s
  const T0 = (2 * Math.PI) / omega0; // seconds
  const R_critique = 2 * Math.sqrt(L / C_F); // Ohms

  let regime = 'Pseudo-périodique';
  if (circuitMode === 'RLC') {
    if (R === 0) regime = 'Périodique non amorti (Idéal)';
    else if (R < R_critique) regime = 'Pseudo-périodique';
    else if (Math.abs(R - R_critique) < 5) regime = 'Critique';
    else regime = 'Apériodique (Forte résistance)';
  }

  // Animation and canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!canvas || !ctx) return;
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Grid lines (Oscilloscope grid)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const gridSize = 35;
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

      // Zero axis
      const zeroY = circuitMode === 'RLC' ? height / 2 : height * 0.85;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(width, zeroY);
      ctx.stroke();

      // Time scaling
      // Plot total duration: 5 * T0 (for RLC) or 5 * tau (for RC)
      const duration = circuitMode === 'RLC' ? Math.max(5 * T0, 0.005) : Math.max(5 * tau_RC, 0.001);
      const points = 400;

      // Draw Voltage Curve u_C(t)
      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#38bdf8'; // Sky blue for u_C

      for (let i = 0; i < points; i++) {
        const t = (i / points) * duration;
        let u = 0;

        if (circuitMode === 'RC') {
          // Charging capacitor
          u = E * (1 - Math.exp(-t / tau_RC));
        } else {
          // RLC series discharge
          const lambda = R / (2 * L);
          if (lambda < omega0) {
            const omega = Math.sqrt(omega0 * omega0 - lambda * lambda);
            u = E * Math.exp(-lambda * t) * Math.cos(omega * t);
          } else {
            // Aperiodic
            const r1 = -lambda + Math.sqrt(lambda * lambda - omega0 * omega0);
            const r2 = -lambda - Math.sqrt(lambda * lambda - omega0 * omega0);
            u = (E / (r1 - r2)) * (r1 * Math.exp(r2 * t) - r2 * Math.exp(r1 * t));
          }
        }

        const x = (i / points) * width;
        const scaleY = circuitMode === 'RLC' ? (height * 0.38) / E : (height * 0.7) / E;
        const y = zeroY - u * scaleY;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Draw Energy Curve if enabled
      if (showEnergy && circuitMode === 'RLC') {
        ctx.beginPath();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#f59e0b'; // Amber for Electric energy

        const maxEnergy = 0.5 * C_F * E * E;

        for (let i = 0; i < points; i++) {
          const t = (i / points) * duration;
          const lambda = R / (2 * L);
          let u = 0;
          if (lambda < omega0) {
            const omega = Math.sqrt(omega0 * omega0 - lambda * lambda);
            u = E * Math.exp(-lambda * t) * Math.cos(omega * t);
          } else {
            u = E * Math.exp(-lambda * t);
          }

          const E_e = 0.5 * C_F * u * u;
          const x = (i / points) * width;
          const y = zeroY - (E_e / maxEnergy) * (height * 0.35);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Legend in canvas corner
      ctx.font = '12px "Fira Code", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`u_C(t) [V]`, 15, 25);
      if (showEnergy && circuitMode === 'RLC') {
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(`Énergie électrique E_e(t) (Période = T/2)`, 120, 25);
      }

      if (isPlaying) {
        timeRef.current += 0.016;
      }
      if (running) {
        animFrameId.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      running = false;
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [circuitMode, R, L, C, E, isPlaying, showEnergy, T0, tau_RC, omega0, C_F]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
              <Zap className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-white">Laboratoire Virtuel : Oscillateur RC / RLC Série</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Visualisation temps réel de l'oscilloscope et des transferts d'énergie (Conforme 2ème Bac PC BIOF)
          </p>
        </div>

        {/* Mode Switch */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setCircuitMode('RLC')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              circuitMode === 'RLC' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Oscillations Libres RLC
          </button>
          <button
            onClick={() => setCircuitMode('RC')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              circuitMode === 'RC' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Échelon de tension RC
          </button>
        </div>
      </div>

      {/* Screen & Scope */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
        <canvas ref={canvasRef} width={800} height={260} className="w-full h-56 block" />
        
        {/* Floating badge for regime */}
        <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-md border border-slate-700 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-mono">
            {circuitMode === 'RLC' ? `Régime : ${regime}` : `Charge à 63% : ${(tau_RC * 1000).toFixed(2)} ms`}
          </span>
        </div>
      </div>

      {/* Sliders & Physics controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
        {/* Resistance R */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-medium">Résistance totale $R_T$ :</span>
            <span className="font-mono text-cyan-400 font-bold">{R} $\Omega$</span>
          </div>
          <input
            type="range"
            min={circuitMode === 'RLC' ? 0 : 10}
            max={circuitMode === 'RLC' ? 300 : 2000}
            step={5}
            value={R}
            onChange={(e) => setR(Number(e.target.value))}
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div className="text-[10px] text-slate-500">
            {circuitMode === 'RLC' ? `R_critique = ${R_critique.toFixed(1)} $\\Omega$` : 'Plus R est grand, plus la charge est lente'}
          </div>
        </div>

        {/* Inductance L (RLC only) */}
        {circuitMode === 'RLC' && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Inductance $L$ :</span>
              <span className="font-mono text-cyan-400 font-bold">{(L * 1000).toFixed(0)} mH</span>
            </div>
            <input
              type="range"
              min={0.01}
              max={0.5}
              step={0.01}
              value={L}
              onChange={(e) => setL(Number(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-slate-500">
              Période propre $T_0 = {(T0 * 1000).toFixed(2)}$ ms
            </div>
          </div>
        )}

        {/* Capacity C */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-medium">Capacité $C$ :</span>
            <span className="font-mono text-cyan-400 font-bold">{C} µF</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={0.5}
            value={C}
            onChange={(e) => setC(Number(e.target.value))}
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div className="text-[10px] text-slate-500">
            {circuitMode === 'RLC' ? `Énergie max = ${(0.5 * C_F * E * E * 1e3).toFixed(2)} mJ` : `$\\tau = RC = ${(tau_RC * 1000).toFixed(2)}$ ms`}
          </div>
        </div>

        {/* Voltage E */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-medium">Tension générateur $E$ :</span>
            <span className="font-mono text-cyan-400 font-bold">{E} V</span>
          </div>
          <input
            type="range"
            min={2}
            max={12}
            step={0.5}
            value={E}
            onChange={(e) => setE(Number(e.target.value))}
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div className="text-[10px] text-slate-500">Amplitude initiale</div>
        </div>
      </div>

      {/* Si Driss's live note */}
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-xs text-amber-200">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-amber-300">Remarque de Si Driss pour le National : </span>
          {circuitMode === 'RLC' ? (
            <MathView
              content="Regarde bien la courbe orange d'énergie : elle oscille à une fréquence double ! Au National, quand on te donne le graphe de $E_e(t)$ ou $E_m(t)$, la période lue graphiquement est $\mathcal{T} = T/2$ et NON $T$. Pour trouver la pseudo-période des oscillations de tension, tu dois impérativement multiplier par 2 : $T = 2 \times \mathcal{T}$ !"
              className="inline text-amber-200"
            />
          ) : (
            <MathView
              content={`À $t = \\tau = RC$, la tension $u_C$ atteint exactement $63\\%$ de $E$ (soit ${(0.63 * E).toFixed(2)} V). La méthode de la tangente à l'origine coupe l'asymptote $u_C = E$ exactement à $t = \\tau$.`}
              className="inline text-amber-200"
            />
          )}
        </div>
      </div>
    </div>
  );
};
