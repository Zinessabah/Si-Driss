import React, { useState, useEffect, useRef } from 'react';
import { Compass, Sparkles, RefreshCw } from 'lucide-react';
import { MathView } from '../MathView';

export const MechanicsFallSimulator: React.FC = () => {
  const [mass, setMass] = useState<number>(20); // g
  const [fluidDensity, setFluidDensity] = useState<number>(900); // kg/m3 (huile)
  const [kFriction, setKFriction] = useState<number>(0.10); // kg/s
  const [radius, setRadius] = useState<number>(1.0); // cm
  const [frictionPower, setFrictionPower] = useState<1 | 2>(1); // v or v^2

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Physics values
  const g = 9.80;
  const m_kg = mass * 1e-3;
  const r_m = radius * 1e-2;
  const volume = (4 / 3) * Math.PI * Math.pow(r_m, 3); // m^3
  
  // A = g * (1 - (rho_f * V) / m)
  const archimedeRatio = (fluidDensity * volume) / m_kg;
  const A = Math.max(0.1, g * (1 - archimedeRatio));
  const B = kFriction / m_kg;

  // v_lim = A / B (if linear n=1) or sqrt(A / B) (if quadratic n=2)
  const v_lim = frictionPower === 1 ? A / B : Math.sqrt(A / B);
  const tau = frictionPower === 1 ? 1 / B : v_lim / A;

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

    // Axes
    const originX = 50;
    const originY = height - 35;

    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originX, 15);
    ctx.lineTo(originX, originY);
    ctx.lineTo(width - 15, originY);
    ctx.stroke();

    // Max display range
    const maxTime = 5 * tau;
    const maxV = v_lim * 1.35;

    // Draw v_lim horizontal asymptote (dotted green)
    const yVlim = originY - (v_lim / maxV) * (originY - 20);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(originX, yVlim);
    ctx.lineTo(width - 15, yVlim);
    ctx.stroke();

    // Draw tangent at origin (dotted red)
    const tangentEndX = originX + (tau / maxTime) * (width - originX - 25);
    ctx.strokeStyle = '#f87171';
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(tangentEndX, yVlim);
    ctx.stroke();
    ctx.setLineDash([]);

    // Plot velocity curve v(t)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const steps = 300;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * maxTime;
      let v = 0;
      if (frictionPower === 1) {
        v = v_lim * (1 - Math.exp(-t / tau));
      } else {
        // v(t) = v_lim * tanh(t / tau)
        v = v_lim * Math.tanh((A / v_lim) * t);
      }
      const x = originX + (t / maxTime) * (width - originX - 25);
      const y = originY - (v / maxV) * (originY - 20);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Labels
    ctx.font = '11px "Fira Code", monospace';
    ctx.fillStyle = '#34d399';
    ctx.fillText(`v_lim = ${v_lim.toFixed(2)} m/s`, width - 150, yVlim - 6);
    ctx.fillStyle = '#f87171';
    ctx.fillText(`Tangente à t=0 (pente a_0 = A)`, tangentEndX - 60, yVlim + 20);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Temps t (s)`, width - 80, originY + 25);
    ctx.fillText(`v(t)`, 15, 25);
  }, [mass, fluidDensity, kFriction, radius, frictionPower, A, B, v_lim, tau]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg">
              <Compass className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-white">Laboratoire Mécanique : Chute Verticale dans un Fluide</h3>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            <MathView content="Équation différentielle $\frac{dv}{dt} = A - B \cdot v^n$, vitesse limite et méthode d'Euler" />
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setFrictionPower(1)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              frictionPower === 1 ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Frottement linéaire ($f = kv$)
          </button>
          <button
            onClick={() => setFrictionPower(2)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              frictionPower === 2 ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Frottement quadratique ($f = kv^2$)
          </button>
        </div>
      </div>

      {/* Screen Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
        <canvas ref={canvasRef} width={800} height={260} className="w-full h-56 block" />
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Masse de la bille $m$ :</span>
            <span className="font-mono text-sky-400 font-bold">{mass} g</span>
          </div>
          <input
            type="range"
            min={5}
            max={60}
            step={1}
            value={mass}
            onChange={(e) => setMass(Number(e.target.value))}
            className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Fluide $\rho_f$ :</span>
            <span className="font-mono text-sky-400 font-bold">{fluidDensity} kg/m³</span>
          </div>
          <input
            type="range"
            min={800}
            max={1260}
            step={20}
            value={fluidDensity}
            onChange={(e) => setFluidDensity(Number(e.target.value))}
            className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div className="text-[10px] text-slate-500">
            {fluidDensity === 900 ? 'Huile végétale' : fluidDensity > 1200 ? 'Glycérol pur' : 'Liquide organique'}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Coefficient de frottement $k$ :</span>
            <span className="font-mono text-sky-400 font-bold">{kFriction.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.02}
            max={0.30}
            step={0.01}
            value={kFriction}
            onChange={(e) => setKFriction(Number(e.target.value))}
            className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Rayon de la bille $r$ :</span>
            <span className="font-mono text-sky-400 font-bold">{radius.toFixed(1)} cm</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.1}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Physics Values Calculated */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-[11px]">Accélération initiale $a_0 = A$</div>
          <div className="font-mono text-base font-bold text-sky-400 mt-1">{A.toFixed(2)} m/s²</div>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-[11px]">
            <MathView content="Vitesse limite $v_{lim}$" />
          </div>
          <div className="font-mono text-base font-bold text-emerald-400 mt-1">{v_lim.toFixed(2)} m/s</div>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-[11px]">Temps caractéristique $\tau$</div>
          <div className="font-mono text-base font-bold text-amber-400 mt-1">{(tau * 1000).toFixed(1)} ms</div>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <div className="text-slate-400 text-[11px]">Poussée d'Archimède $F_A$</div>
          <div className="font-mono text-base font-bold text-violet-400 mt-1">
            {(fluidDensity * volume * g * 1000).toFixed(2)} mN
          </div>
        </div>
      </div>
    </div>
  );
};
