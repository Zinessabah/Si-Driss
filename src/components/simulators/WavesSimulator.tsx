import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Waves,
  Ruler,
  HelpCircle,
  Eye,
  Sliders,
  ChevronRight,
  Info,
} from 'lucide-react';
import { MathView } from '../MathView';

export const WavesSimulator: React.FC = () => {
  // Wave configuration
  const [waveNature, setWaveNature] = useState<'transverse' | 'longitudinal'>('transverse');
  const [waveMode, setWaveMode] = useState<'periodic' | 'pulse'>('periodic');

  // Physical parameters
  const [velocity, setVelocity] = useState<number>(4.0); // m/s (célérité)
  const [frequency, setFrequency] = useState<number>(2.0); // Hz (fréquence N)
  const [amplitude, setAmplitude] = useState<number>(3.0); // cm
  const [pointM1Pos, setPointM1Pos] = useState<number>(1.0); // meters (position of M1)
  const [pointM2Pos, setPointM2Pos] = useState<number>(2.0); // meters (position of M2)
  const [pulseDuration, setPulseDuration] = useState<number>(0.2); // seconds (for pulse mode)

  // Simulation controls
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(0.5); // 0.25x, 0.5x, 1x
  const [showRuler, setShowRuler] = useState<boolean>(true);
  const [showVectors, setShowVectors] = useState<boolean>(true);
  const [activeGraph, setActiveGraph] = useState<'space' | 'time'>('space');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const simTimeRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);

  // Derived physics values
  const period = 1 / frequency; // T en secondes
  const wavelength = velocity / frequency; // lambda en mètres (v = lambda / T)
  const delayTau1 = pointM1Pos / velocity; // tau1 = SM1 / v
  const delayTau2 = pointM2Pos / velocity; // tau2 = SM2 / v

  // Phase comparison between S and M1
  const kRatio = pointM1Pos / wavelength;
  const isCloseToInteger = Math.abs(kRatio - Math.round(kRatio)) < 0.05;
  const isCloseToHalf = Math.abs(kRatio - (Math.floor(kRatio) + 0.5)) < 0.05;

  let phaseRelation = 'Déphasage quelconque';
  if (isCloseToInteger) {
    phaseRelation = 'En phase (d = k · λ)';
  } else if (isCloseToHalf) {
    phaseRelation = 'En opposition de phase (d = (2k+1) · λ/2)';
  }

  // Animation and canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isSubscribed = true;

    const render = (now: number) => {
      if (!isSubscribed) return;

      if (!lastTimestampRef.current) {
        lastTimestampRef.current = now;
      }
      const dtReal = (now - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = now;

      // Advance physics simulation time if playing
      if (isPlaying) {
        simTimeRef.current += Math.min(dtReal, 0.05) * simSpeed;
      }

      const t = simTimeRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // Clear dark background
      ctx.fillStyle = '#0f1117';
      ctx.fillRect(0, 0, width, height);

      // Coordinate mapping: 0 to 3.0 meters along X
      const maxDistanceMeters = 3.0;
      const originX = 60;
      const usableWidth = width - originX - 40;
      const scaleX = usableWidth / maxDistanceMeters; // px per meter
      const baselineY = height / 2;

      // 1. Draw Background Grid & Coordinate Axes
      ctx.strokeStyle = '#1e2433';
      ctx.lineWidth = 1;
      const gridPx = scaleX * 0.25; // every 0.25 meter
      for (let x = originX; x <= originX + usableWidth; x += gridPx) {
        ctx.beginPath();
        ctx.moveTo(x, 25);
        ctx.lineTo(x, height - 35);
        ctx.stroke();
      }

      // Horizontal axis
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(originX - 20, baselineY);
      ctx.lineTo(originX + usableWidth + 20, baselineY);
      ctx.stroke();

      // Axis labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      for (let m = 0; m <= maxDistanceMeters; m += 0.5) {
        const xPos = originX + m * scaleX;
        ctx.beginPath();
        ctx.moveTo(xPos, baselineY - 4);
        ctx.lineTo(xPos, baselineY + 4);
        ctx.stroke();
        ctx.fillText(`${m.toFixed(1)}m`, xPos, baselineY + 16);
      }

      // Helper function to calculate wave elongation y(x, t) in meters
      const getElongation = (x: number, currTime: number): number => {
        const arrivalTime = x / velocity; // retard temporel tau = x / v

        if (currTime < arrivalTime) {
          return 0; // Wave has not reached point x yet
        }

        const delayedTime = currTime - arrivalTime; // t - tau

        if (waveMode === 'pulse') {
          // Single pulse wave
          if (delayedTime >= 0 && delayedTime <= pulseDuration) {
            // Smooth half-sine or Gaussian pulse
            const phi = (delayedTime / pulseDuration) * Math.PI;
            return (amplitude * 0.01) * Math.sin(phi);
          }
          return 0;
        } else {
          // Continuous sinusoidal wave y_S(t) = Y_m * sin(2*pi*N*t)
          return (amplitude * 0.01) * Math.sin(2 * Math.PI * frequency * delayedTime);
        }
      };

      // 2. Render Wave Based on Nature (Transverse vs Longitudinal)
      if (waveNature === 'transverse') {
        // TRANSVERSE WAVE (Vibrating rope / water surface)
        const numSegments = 300;
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#38bdf8'; // Sky blue for rope

        // Amplitude pixel scale: 1 cm -> 8 px
        const ampScalePx = 10;

        for (let i = 0; i <= numSegments; i++) {
          const xDist = (i / numSegments) * maxDistanceMeters;
          const xPx = originX + xDist * scaleX;
          const yMeters = getElongation(xDist, t);
          const yPx = baselineY - (yMeters * 100) * ampScalePx;

          if (i === 0) {
            ctx.moveTo(xPx, yPx);
          } else {
            ctx.lineTo(xPx, yPx);
          }
        }
        ctx.stroke();

        // Draw discreet particles along the rope to show vertical-only movement
        const particleSpacing = 0.1; // every 10 cm
        const numParticles = Math.floor(maxDistanceMeters / particleSpacing);
        for (let i = 0; i <= numParticles; i++) {
          const xDist = i * particleSpacing;
          const xPx = originX + xDist * scaleX;
          const yMeters = getElongation(xDist, t);
          const yPx = baselineY - (yMeters * 100) * ampScalePx;

          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.arc(xPx, yPx, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // LONGITUDINAL WAVE (Spring coils / sound pressure layers in air)
        const numCoils = 90;
        const coilSpacingRest = maxDistanceMeters / numCoils;
        const ampScaleLongitudinalPx = 8; // Pixel displacement

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#a855f7'; // Purple for coils

        const coilPoints: { x: number; y: number }[] = [];

        for (let i = 0; i <= numCoils; i++) {
          const xRest = i * coilSpacingRest;
          const displacementMeters = getElongation(xRest, t);
          // Longitudinal displacement is PARALLEL to propagation axis (X axis)!
          const xDisplaced = originX + (xRest * scaleX) + (displacementMeters * 100 * ampScaleLongitudinalPx);

          // Draw vertical spring coil loop
          const coilHeight = 35;
          const isUpper = i % 2 === 0;
          const yPos = baselineY + (isUpper ? -coilHeight / 2 : coilHeight / 2);

          coilPoints.push({ x: xDisplaced, y: yPos });

          // Density marker: draw vertical line for air tranche/spring turn
          ctx.strokeStyle = '#c084fc';
          ctx.beginPath();
          ctx.moveTo(xDisplaced, baselineY - coilHeight / 2);
          ctx.lineTo(xDisplaced, baselineY + coilHeight / 2);
          ctx.stroke();
        }

        // Connect coils with zigzag wire
        ctx.beginPath();
        ctx.strokeStyle = '#7e22ce';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < coilPoints.length; i++) {
          if (i === 0) ctx.moveTo(coilPoints[i].x, coilPoints[i].y);
          else ctx.lineTo(coilPoints[i].x, coilPoints[i].y);
        }
        ctx.stroke();

        // Zone compression / dilatation labels
        ctx.fillStyle = '#e9d5ff';
        ctx.font = '9px monospace';
        ctx.fillText('Compressions (haute densité) & Dilatations (faible densité)', originX + usableWidth / 2, baselineY - 30);
      }

      // 3. Highlight Characteristic Points: Source S, M1, and M2
      const ampScale = 10;

      // Source S at x = 0
      const yS = getElongation(0, t);
      const sPxY = waveNature === 'transverse' ? baselineY - (yS * 100) * ampScale : baselineY;
      const sPxX = waveNature === 'transverse' ? originX : originX + (yS * 100) * 8;

      ctx.fillStyle = '#eab308'; // Amber/Yellow for Source S
      ctx.beginPath();
      ctx.arc(sPxX, sPxY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('S (Source)', sPxX, sPxY - 12);

      // Point M1
      const yM1 = getElongation(pointM1Pos, t);
      const m1PxX = waveNature === 'transverse' ? originX + pointM1Pos * scaleX : originX + pointM1Pos * scaleX + (yM1 * 100) * 8;
      const m1PxY = waveNature === 'transverse' ? baselineY - (yM1 * 100) * ampScale : baselineY;

      ctx.fillStyle = '#ef4444'; // Red for M1
      ctx.beginPath();
      ctx.arc(m1PxX, m1PxY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`M₁ (${pointM1Pos.toFixed(2)}m)`, m1PxX, m1PxY - 12);

      // Point M2
      if (pointM2Pos > 0 && pointM2Pos <= maxDistanceMeters) {
        const yM2 = getElongation(pointM2Pos, t);
        const m2PxX = waveNature === 'transverse' ? originX + pointM2Pos * scaleX : originX + pointM2Pos * scaleX + (yM2 * 100) * 8;
        const m2PxY = waveNature === 'transverse' ? baselineY - (yM2 * 100) * ampScale : baselineY;

        ctx.fillStyle = '#10b981'; // Emerald for M2
        ctx.beginPath();
        ctx.arc(m2PxX, m2PxY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#6ee7b7';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`M₂ (${pointM2Pos.toFixed(2)}m)`, m2PxX, m2PxY - 12);
      }

      // 4. Direction Vectors (Propagation vs Perturbation)
      if (showVectors) {
        // Propagation vector v (Horizontal, Cyan)
        ctx.strokeStyle = '#06b6d4';
        ctx.fillStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
        const vStartX = originX + 20;
        const vStartY = 35;
        const vLen = 60;
        ctx.beginPath();
        ctx.moveTo(vStartX, vStartY);
        ctx.lineTo(vStartX + vLen, vStartY);
        ctx.stroke();
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(vStartX + vLen, vStartY);
        ctx.lineTo(vStartX + vLen - 8, vStartY - 4);
        ctx.lineTo(vStartX + vLen - 8, vStartY + 4);
        ctx.fill();
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('Propagation v⃗', vStartX + vLen / 2, vStartY - 8);

        // Perturbation vector D (Perpendicular for transverse, Parallel for longitudinal)
        ctx.strokeStyle = '#f59e0b';
        ctx.fillStyle = '#f59e0b';
        ctx.lineWidth = 2.5;

        if (waveNature === 'transverse') {
          // Vertical perturbation (Transverse: D perpendicular to v)
          const dStartX = originX + 130;
          const dCenterY = 35;
          ctx.beginPath();
          ctx.moveTo(dStartX, dCenterY - 18);
          ctx.lineTo(dStartX, dCenterY + 18);
          ctx.stroke();
          // Dual Arrowhead (Up and Down)
          ctx.beginPath();
          ctx.moveTo(dStartX, dCenterY - 18);
          ctx.lineTo(dStartX - 4, dCenterY - 11);
          ctx.lineTo(dStartX + 4, dCenterY - 11);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(dStartX, dCenterY + 18);
          ctx.lineTo(dStartX - 4, dCenterY + 11);
          ctx.lineTo(dStartX + 4, dCenterY + 11);
          ctx.fill();
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText('Perturbation ↕ (⊥ à v⃗)', dStartX + 60, dCenterY + 4);
        } else {
          // Horizontal perturbation (Longitudinal: D parallel to v)
          const dStartX = originX + 130;
          const dCenterY = 35;
          ctx.beginPath();
          ctx.moveTo(dStartX - 25, dCenterY);
          ctx.lineTo(dStartX + 25, dCenterY);
          ctx.stroke();
          // Dual Arrowhead (Left and Right)
          ctx.beginPath();
          ctx.moveTo(dStartX - 25, dCenterY);
          ctx.lineTo(dStartX - 18, dCenterY - 4);
          ctx.lineTo(dStartX - 18, dCenterY + 4);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(dStartX + 25, dCenterY);
          ctx.lineTo(dStartX + 18, dCenterY - 4);
          ctx.lineTo(dStartX + 18, dCenterY + 4);
          ctx.fill();
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText('Perturbation ↔ (∥ à v⃗)', dStartX + 75, dCenterY + 4);
        }
      }

      // 5. Wavelength lambda dimension indicator (in periodic mode)
      if (waveMode === 'periodic' && showRuler && wavelength <= maxDistanceMeters) {
        const lambdaStartM = 0.2;
        const lambdaEndM = lambdaStartM + wavelength;
        const lPxStart = originX + lambdaStartM * scaleX;
        const lPxEnd = originX + lambdaEndM * scaleX;
        const rulerY = height - 20;

        ctx.strokeStyle = '#38bdf8';
        ctx.fillStyle = '#38bdf8';
        ctx.lineWidth = 1.5;

        // Bounding brackets
        ctx.beginPath();
        ctx.moveTo(lPxStart, rulerY - 6);
        ctx.lineTo(lPxStart, rulerY + 6);
        ctx.moveTo(lPxStart, rulerY);
        ctx.lineTo(lPxEnd, rulerY);
        ctx.moveTo(lPxEnd, rulerY - 6);
        ctx.lineTo(lPxEnd, rulerY + 6);
        ctx.stroke();

        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Longueur d'onde λ = ${wavelength.toFixed(2)} m`, (lPxStart + lPxEnd) / 2, rulerY - 6);
      }

      // Wave front indicator (Front d'onde à x_F = v · t)
      const waveFrontX = velocity * t;
      if (waveFrontX <= maxDistanceMeters) {
        const fPx = originX + waveFrontX * scaleX;
        ctx.strokeStyle = '#f43f5e';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(fPx, 30);
        ctx.lineTo(fPx, height - 30);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Front d'onde (${waveFrontX.toFixed(2)}m)`, fPx, height - 16);
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      isSubscribed = false;
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [waveNature, waveMode, velocity, frequency, amplitude, pointM1Pos, pointM2Pos, pulseDuration, isPlaying, simSpeed, showRuler, showVectors, wavelength]);

  const handleReset = () => {
    simTimeRef.current = 0;
    lastTimestampRef.current = 0;
  };

  const handleStep = () => {
    simTimeRef.current += 0.05;
  };

  const handleTriggerPulse = () => {
    simTimeRef.current = 0;
    setIsPlaying(true);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200 text-[#e3e3e3]">
      {/* 1. Header with Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#17181c] border border-[#282a2c] rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md">
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Laboratoire des Ondes Mécaniques Progressives
            </h3>
            <p className="text-xs text-[#8e918f]">
              Chapitre 1 officiel • 2ème Bac PC & SM (BIOF)
            </p>
          </div>
        </div>

        {/* Transverse vs Longitudinal Pill Switcher */}
        <div className="flex items-center p-1 bg-[#131314] rounded-xl border border-[#282a2c]">
          <button
            type="button"
            onClick={() => setWaveNature('transverse')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              waveNature === 'transverse'
                ? 'bg-[#282a2c] text-white shadow-xs border border-[#3c4043]'
                : 'text-[#8e918f] hover:text-[#e3e3e3]'
            }`}
          >
            Onde Transversale (Corde)
          </button>
          <button
            type="button"
            onClick={() => setWaveNature('longitudinal')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              waveNature === 'longitudinal'
                ? 'bg-[#282a2c] text-white shadow-xs border border-[#3c4043]'
                : 'text-[#8e918f] hover:text-[#e3e3e3]'
            }`}
          >
            Onde Longitudinale (Ressort / Son)
          </button>
        </div>
      </div>

      {/* 2. Official Cadre de Référence Definition Banner */}
      <div
        className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 transition-colors ${
          waveNature === 'transverse'
            ? 'bg-sky-950/20 border-sky-500/30 text-sky-200'
            : 'bg-purple-950/20 border-purple-500/30 text-purple-200'
        }`}
      >
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-white">
            {waveNature === 'transverse'
              ? 'Définition officielle : Onde mécanique transversale'
              : 'Définition officielle : Onde mécanique longitudinale'}
          </div>
          <p className="text-[11px] leading-relaxed opacity-90">
            {waveNature === 'transverse' ? (
              <>
                Une onde est dite <strong>transversale</strong> lorsque la direction de la perturbation est{' '}
                <strong className="underline decoration-sky-400">perpendiculaire (⊥)</strong> à la direction de propagation de l'onde.
                <em> Exemples types : Onde le long d'une corde, onde à la surface de l'eau.</em>
              </>
            ) : (
              <>
                Une onde est dite <strong>longitudinale</strong> lorsque la direction de la perturbation est{' '}
                <strong className="underline decoration-purple-400">parallèle (∥)</strong> à la direction de propagation de l'onde (succession de compressions et de dilatations).
                <em> Exemples types : Onde le long d'un ressort à spires, onde sonore dans l'air.</em>
              </>
            )}
          </p>
        </div>
      </div>

      {/* 3. Main Interactive Canvas Stage */}
      <div className="bg-[#17181c] border border-[#282a2c] rounded-3xl p-4 shadow-xl space-y-3">
        {/* Top Control Bar of Canvas */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-[#282a2c]/60">
          <div className="flex items-center gap-2">
            {/* Play/Pause Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#282a2c] hover:bg-[#323538] text-white text-xs font-semibold transition border border-[#3c4043]"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isPlaying ? 'Pause' : 'Reprendre'}</span>
            </button>

            {/* Step Button */}
            <button
              onClick={handleStep}
              className="px-2.5 py-1.5 rounded-xl bg-[#202124] hover:bg-[#282a2c] text-xs text-[#c4c7c5] hover:text-white transition border border-[#282a2c]"
              title="Avancer pas à pas de 0.05 s"
            >
              +0.05 s
            </button>

            {/* Reset Button */}
            <button
              onClick={handleReset}
              className="p-1.5 rounded-xl bg-[#202124] hover:bg-[#282a2c] text-[#8e918f] hover:text-white transition border border-[#282a2c]"
              title="Remettre le chronomètre à t = 0"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Trigger pulse if in pulse mode */}
            {waveMode === 'pulse' && (
              <button
                onClick={handleTriggerPulse}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold text-xs flex items-center gap-1 transition shadow-sm"
              >
                <span>Émettre un ébranlement</span>
              </button>
            )}
          </div>

          {/* Speed & Mode toggles */}
          <div className="flex items-center gap-2 text-xs">
            {/* Wave mode: Periodic vs Single pulse */}
            <div className="flex items-center p-1 bg-[#131314] rounded-lg border border-[#282a2c] text-[11px]">
              <button
                type="button"
                onClick={() => setWaveMode('periodic')}
                className={`px-2.5 py-1 rounded-md transition ${
                  waveMode === 'periodic' ? 'bg-[#282a2c] text-white font-medium' : 'text-[#8e918f]'
                }`}
              >
                Sinusoïdale périodique
              </button>
              <button
                type="button"
                onClick={() => setWaveMode('pulse')}
                className={`px-2.5 py-1 rounded-md transition ${
                  waveMode === 'pulse' ? 'bg-[#282a2c] text-white font-medium' : 'text-[#8e918f]'
                }`}
              >
                Impulsion unique (Ébranlement)
              </button>
            </div>

            {/* Speed Selector */}
            <div className="flex items-center gap-1 text-[11px] text-[#8e918f]">
              <span>Vitesse :</span>
              {[0.25, 0.5, 1.0].map((s) => (
                <button
                  key={s}
                  onClick={() => setSimSpeed(s)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition ${
                    simSpeed === s ? 'bg-[#3c4043] text-white font-bold' : 'hover:bg-[#202124] text-[#8e918f]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* HTML5 Canvas */}
        <div className="relative rounded-2xl overflow-hidden border border-[#282a2c]">
          <canvas
            ref={canvasRef}
            width={850}
            height={260}
            className="w-full h-auto block bg-[#0f1117]"
          />
        </div>

        {/* Toggleable visual helpers */}
        <div className="flex flex-wrap items-center justify-between text-xs text-[#8e918f] pt-1 px-1">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition">
              <input
                type="checkbox"
                checked={showVectors}
                onChange={(e) => setShowVectors(e.target.checked)}
                className="rounded accent-sky-500 cursor-pointer"
              />
              <span>Vecteurs de propagation v⃗ et perturbation</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition">
              <input
                type="checkbox"
                checked={showRuler}
                onChange={(e) => setShowRuler(e.target.checked)}
                className="rounded accent-sky-500 cursor-pointer"
              />
              <span>Règle et mesure de λ</span>
            </label>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span>Points :</span>
            <span className="text-yellow-400 font-semibold">● Source S (x = 0m)</span>
            <span className="text-rose-400 font-semibold">● M₁ ({pointM1Pos.toFixed(2)}m)</span>
            <span className="text-emerald-400 font-semibold">● M₂ ({pointM2Pos.toFixed(2)}m)</span>
          </div>
        </div>
      </div>

      {/* 4. Real-time Calculations & Pedagogical Analysis Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Célérité */}
        <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
          <div className="text-[11px] text-[#8e918f]">Célérité de l'onde (v)</div>
          <div className="text-lg font-bold text-white font-mono">{velocity.toFixed(1)} m/s</div>
          <div className="text-[10px] text-sky-400 font-mono">v = d / Δt = λ / T</div>
        </div>

        {/* Card 2: Longueur d'onde */}
        <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
          <div className="text-[11px] text-[#8e918f]">Longueur d'onde (λ)</div>
          <div className="text-lg font-bold text-white font-mono">{wavelength.toFixed(2)} m</div>
          <div className="text-[10px] text-amber-400 font-mono">Périodicité spatiale</div>
        </div>

        {/* Card 3: Période temporelle */}
        <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
          <div className="text-[11px] text-[#8e918f]">Période temporelle (T)</div>
          <div className="text-lg font-bold text-white font-mono">{period.toFixed(3)} s</div>
          <div className="text-[10px] text-purple-400 font-mono">Fréquence N = {frequency.toFixed(1)} Hz</div>
        </div>

        {/* Card 4: Retard temporel tau */}
        <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
          <div className="text-[11px] text-[#8e918f]">Retard en M₁ (τ)</div>
          <div className="text-lg font-bold text-rose-300 font-mono">{delayTau1.toFixed(3)} s</div>
          <div className="text-[10px] text-rose-400 font-mono">τ = SM₁ / v</div>
        </div>
      </div>

      {/* 5. Parameter Controls (Sliders) */}
      <div className="p-4 bg-[#17181c] border border-[#282a2c] rounded-3xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#282a2c]/60">
          <span className="text-xs font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#8ab4f8]" />
            Réglages des paramètres physiques
          </span>
          <span className="text-[11px] text-[#8e918f]">
            Modifiez pour observer l'effet direct sur λ, T et τ
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Slider 1: Célérité */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#8e918f]">Célérité (v) :</span>
              <span className="font-mono font-bold text-white">{velocity.toFixed(1)} m/s</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={8.0}
              step={0.2}
              value={velocity}
              onChange={(e) => setVelocity(parseFloat(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
            <span className="text-[10px] text-[#8e918f] block">Dépend uniquement du milieu de propagation</span>
          </div>

          {/* Slider 2: Fréquence */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#8e918f]">Fréquence (N) :</span>
              <span className="font-mono font-bold text-white">{frequency.toFixed(1)} Hz</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={5.0}
              step={0.1}
              value={frequency}
              onChange={(e) => setFrequency(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <span className="text-[10px] text-[#8e918f] block">Imposée par la source vibrante</span>
          </div>

          {/* Slider 3: Amplitude */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#8e918f]">Amplitude (Y_m) :</span>
              <span className="font-mono font-bold text-white">{amplitude.toFixed(1)} cm</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={4.0}
              step={0.5}
              value={amplitude}
              onChange={(e) => setAmplitude(parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <span className="text-[10px] text-[#8e918f] block">Élongation maximale de la source</span>
          </div>

          {/* Slider 4: Position M1 */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[#8e918f]">Position de M₁ :</span>
              <span className="font-mono font-bold text-rose-300">{pointM1Pos.toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min={0.2}
              max={2.5}
              step={0.05}
              value={pointM1Pos}
              onChange={(e) => setPointM1Pos(parseFloat(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <span className="text-[10px] text-[#8e918f] block">{phaseRelation}</span>
          </div>
        </div>
      </div>

      {/* 6. Comparison Table & Phase Study */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Left: Relation d'élongation officielle */}
        <div className="p-4 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-2.5">
          <div className="font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Relation fondamentale de l'Examen National</span>
          </div>
          <div className="p-3 bg-[#131314] rounded-xl border border-[#282a2c] font-mono text-center text-xs text-sky-300">
            <MathView content="$$y_M(t) = y_S(t - \tau) \quad \text{pour } t \ge \tau$$" />
          </div>
          <p className="text-[11px] text-[#8e918f] leading-relaxed">
            Le mouvement du point <strong>M</strong> est identique à celui de la source <strong>S</strong>, mais avec un retard temporel{' '}
            <span className="text-white font-mono inline-block align-middle"><MathView content="$\tau = \frac{SM}{v}$" /></span>.
            Avant l'instant $t = \tau$, le point reste immobile ($y_M(t) = 0$).
          </p>
        </div>

        {/* Right: État de phase entre S et M1 */}
        <div className="p-4 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-2.5">
          <div className="font-bold text-white flex items-center gap-1.5">
            <Info className="w-4 h-4 text-sky-400" />
            <span>État vibratoire entre S et M₁ (Question fréquente)</span>
          </div>
          <div className="p-3 bg-[#131314] rounded-xl border border-[#282a2c] space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-[#8e918f]">Distance $SM_1$ / $\lambda$ :</span>
              <span className="font-mono font-bold text-white">{(pointM1Pos / wavelength).toFixed(2)} · λ</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8e918f]">État de vibration :</span>
              <span className={`font-bold ${isCloseToInteger ? 'text-emerald-400' : isCloseToHalf ? 'text-rose-400' : 'text-amber-300'}`}>
                {phaseRelation}
              </span>
            </div>
          </div>
          <div className="text-[11px] text-[#8e918f] leading-relaxed space-y-1">
            <div>
              <MathView content="• Si $d = k \cdot \lambda$ : S et M vibrent **en phase** (atteignent leurs maxima en même temps)." />
            </div>
            <div>
              <MathView content="• Si $d = (2k+1) \cdot \frac{\lambda}{2}$ : S et M vibrent **en opposition de phase** ($y_M(t) = -y_S(t)$)." />
            </div>
          </div>
        </div>
      </div>

      {/* 7. Pièges classiques repérés par les correcteurs du Bac */}
      <div className="p-4 bg-[#17181c] border border-amber-500/30 rounded-2xl space-y-2 text-xs">
        <div className="font-bold text-amber-300 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-400" />
          <span>Le piège du National : Premier mouvement du point M</span>
        </div>
        <p className="text-[11px] text-[#c4c7c5] leading-relaxed">
          Lorsqu'on demande dans le sujet du Bac : <em>« Déterminer le sens du premier mouvement du point M »</em>, la réponse est toujours :{' '}
          <strong>le point M reproduit exactement le premier mouvement effectué par la source S</strong> (si S a commencé par monter vers le haut à $t = 0$, le premier mouvement de M sera de monter vers le haut à $t = \tau$).
        </p>
      </div>
    </div>
  );
};
