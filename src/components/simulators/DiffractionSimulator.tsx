import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Info,
  HelpCircle,
  Sliders,
  Maximize2,
  Layers,
  Sun,
  Waves,
} from 'lucide-react';
import { MathView } from '../MathView';

export const DiffractionSimulator: React.FC = () => {
  // Mode: Mécanique (Cuve à ondes) vs Lumineuse (Laser)
  const [diffractionType, setDiffractionType] = useState<'water' | 'laser'>('water');

  // Simulation controls
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);

  // --- PARAMÈTRES ONDE MÉCANIQUE (CUVE À ONDES) ---
  const [waterWavelength, setWaterWavelength] = useState<number>(20); // mm (λ)
  const [slitWidthWater, setSlitWidthWater] = useState<number>(18); // mm (a)
  const [waveFrequency, setWaveFrequency] = useState<number>(10); // Hz

  // --- PARAMÈTRES ONDE LUMINEUSE (LASER) ---
  const [laserColor, setLaserColor] = useState<'red' | 'green' | 'blue'>('red');
  const [slitWidthLaser, setSlitWidthLaser] = useState<number>(60); // µm (a)
  const [distanceScreen, setDistanceScreen] = useState<number>(1.5); // m (D)

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const simTimeRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);

  // Valeurs physiques laser
  const laserWavelengthNm = laserColor === 'red' ? 650 : laserColor === 'green' ? 532 : 450;
  const laserHexColor = laserColor === 'red' ? '#ef4444' : laserColor === 'green' ? '#22c55e' : '#3b82f6';
  const laserWavelengthM = laserWavelengthNm * 1e-9;
  const slitWidthLaserM = slitWidthLaser * 1e-6;

  // Écart angulaire theta = lambda / a (en rad)
  const thetaRad = laserWavelengthM / slitWidthLaserM;
  const thetaMrad = thetaRad * 1000;

  // Largeur de la tache centrale L = 2 * lambda * D / a (en mètres et cm)
  const centralWidthM = (2 * laserWavelengthM * distanceScreen) / slitWidthLaserM;
  const centralWidthCm = centralWidthM * 100;

  // Condition de diffraction cuve à ondes
  const ratioWater = slitWidthWater / waterWavelength;
  const isDiffractionObserved = ratioWater <= 1.5;

  // Animation Canvas
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

      if (isPlaying) {
        simTimeRef.current += Math.min(dtReal, 0.05) * simSpeed;
      }

      const t = simTimeRef.current;
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = '#0f1117';
      ctx.fillRect(0, 0, width, height);

      if (diffractionType === 'water') {
        // =====================================================================
        // 1. CUVE À ONDES (Ondes planes incidentes et diffraction circulaire)
        // =====================================================================
        const barrierX = width * 0.42;
        const slitSizePx = (slitWidthWater / 20) * 45; // pixel width of slit
        const lambdaPx = (waterWavelength / 20) * 35; // pixel wavelength
        const halfSlit = slitSizePx / 2;
        const centerY = height / 2;

        // Grille de fond
        ctx.strokeStyle = '#1e2433';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 30) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }

        // A. Onde incidente (planes rectilignes se propageant vers la droite)
        const waveSpeedPx = lambdaPx * (waveFrequency * 0.15);
        const waveOffset = (t * waveSpeedPx) % lambdaPx;

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;

        for (let x = barrierX - waveOffset; x >= 30; x -= lambdaPx) {
          ctx.beginPath();
          ctx.moveTo(x, 25);
          ctx.lineTo(x, height - 25);
          ctx.stroke();

          // Ligne de creux intermédiaire
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x - lambdaPx / 2, 25);
          ctx.lineTo(x - lambdaPx / 2, height - 25);
          ctx.stroke();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
        }

        // Flèche de propagation incidente
        ctx.fillStyle = '#38bdf8';
        ctx.font = '10px monospace';
        ctx.fillText('Onde plane incidente (célérité v, λ, N)', 40, 20);

        // B. Obstacles (Barrières haute et basse)
        ctx.fillStyle = '#64748b';
        // Barrière du haut
        ctx.fillRect(barrierX - 4, 20, 8, centerY - halfSlit - 20);
        // Barrière du bas
        ctx.fillRect(barrierX - 4, centerY + halfSlit, 8, height - centerY - halfSlit - 20);

        // Marquage de l'ouverture 'a'
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(barrierX + 10, centerY - halfSlit);
        ctx.lineTo(barrierX + 10, centerY + halfSlit);
        ctx.stroke();
        // Flèches d'extrémité
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(barrierX + 10, centerY - halfSlit, 2.5, 0, Math.PI * 2);
        ctx.arc(barrierX + 10, centerY + halfSlit, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(`a = ${slitWidthWater} mm`, barrierX + 16, centerY + 4);

        // C. Onde après l'obstacle : DIFFRACTION
        // Si a <= lambda : diffraction circulaire forte
        // Si a > lambda : onde diaphragmé (planes au centre, léger arrondi aux bords)
        const diffractionFactor = Math.min(1.0, Math.max(0.0, 1.6 - ratioWater));

        ctx.save();
        ctx.beginPath();
        ctx.rect(barrierX + 4, 0, width - barrierX - 4, height);
        ctx.clip();

        // Propagation des crêtes après l'obstacle
        const maxRadius = width - barrierX;
        for (let r = waveOffset; r < maxRadius; r += lambdaPx) {
          if (r <= 0) continue;

          ctx.strokeStyle = isDiffractionObserved ? '#34d399' : '#38bdf8';
          ctx.lineWidth = 2.5;

          if (diffractionFactor > 0.4) {
            // Onde circulaire diffractée centrée sur la fente
            // Plus diffractionFactor est fort, plus l'angle d'ouverture est large
            const maxAngle = (Math.PI / 2) * Math.min(1.0, diffractionFactor * 1.2);
            ctx.beginPath();
            ctx.arc(barrierX, centerY, r, -maxAngle, maxAngle);
            ctx.stroke();

            // Lignes de creux
            if (r - lambdaPx / 2 > 0) {
              ctx.strokeStyle = 'rgba(52, 211, 153, 0.25)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.arc(barrierX, centerY, r - lambdaPx / 2, -maxAngle, maxAngle);
              ctx.stroke();
            }
          } else {
            // Pas de diffraction : onde plane transmise dans la largeur de la fente
            ctx.beginPath();
            const beamTop = centerY - halfSlit - r * 0.08;
            const beamBottom = centerY + halfSlit + r * 0.08;
            ctx.moveTo(barrierX + r, Math.max(25, beamTop));
            ctx.lineTo(barrierX + r, Math.min(height - 25, beamBottom));
            ctx.stroke();
          }
        }
        ctx.restore();

        // Label d'état
        ctx.fillStyle = isDiffractionObserved ? '#34d399' : '#94a3b8';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(
          isDiffractionObserved
            ? '✓ Onde diffractée circulaire (a ≤ λ)'
            : '✗ Onde plane diaphragmé sans diffraction (a > λ)',
          barrierX + 25,
          25
        );
      } else {
        // =====================================================================
        // 2. DIFFRACTION LUMINEUSE LASER (VARIATION RÉELLE ET PROPORTIONNELLE)
        // =====================================================================
        // Distance physique D : fait glisser l'écran horizontalement sur le banc optique
        // distanceScreen varie de 0.5 m à 3.0 m (delta = 2.5 m)
        const slitX = 140;
        const centerY = height / 2;
        const laserSourceX = 25;

        // Position horizontale de l'écran en fonction de D (glissière optique)
        // D = 0.5 m -> screenX = 400 px, D = 3.0 m -> screenX = 620 px
        const screenX = Math.round(slitX + 260 + ((distanceScreen - 0.5) / 2.5) * 220);
        const D_distPx = screenX - slitX;

        // Vitesse visuelle de la lumière et longueur d'onde visuelle
        const cVis = 90; // px/s
        const lambdaVisPx = laserColor === 'red' ? 24 : laserColor === 'green' ? 19 : 15;

        // =====================================================================
        // CALCUL PHYSIQUE EXACT DE LA DEMI-LARGEUR DE LA TACHE CENTRALE (EN PIXELS)
        // L_cm = (2 * lambda * D / a) * 100
        // Demi-largeur centrale = L_cm / 2
        // Facteur d'échelle d'affichage : 1 cm -> 14 pixels
        // =====================================================================
        const pxPerCm = 14.0;
        const halfCentralWidthCm = centralWidthCm / 2;
        // Demi-hauteur de la tache centrale sur l'écran (pixels)
        const Y_centralPx = Math.max(9, Math.min(108, halfCentralWidthCm * pxPerCm));

        // 1. Banc optique & Source Laser
        ctx.fillStyle = '#1e2433';
        ctx.fillRect(laserSourceX - 15, centerY - 25, 45, 50);
        ctx.strokeStyle = '#384252';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(laserSourceX - 15, centerY - 25, 45, 50);

        // Diode émettrice / Témoin laser
        ctx.fillStyle = laserHexColor;
        ctx.shadowColor = laserHexColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(laserSourceX + 22, centerY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px monospace';
        ctx.fillText('LASER', laserSourceX - 10, centerY - 12);
        ctx.fillText(`${laserWavelengthNm}nm`, laserSourceX - 12, centerY + 18);

        // 2. Faisceau et onde incidente (collimatée)
        const incidentLen = slitX - (laserSourceX + 30);
        const incidentPhaseOffset = (t * cVis) % lambdaVisPx;

        ctx.fillStyle = `${laserHexColor}15`;
        ctx.fillRect(laserSourceX + 30, centerY - 7, incidentLen, 14);

        // Fronts d'onde plans incidents se déplaçant vers la fente
        ctx.strokeStyle = `${laserHexColor}80`;
        ctx.lineWidth = 1.5;
        for (let x = laserSourceX + 30 + incidentPhaseOffset; x < slitX; x += lambdaVisPx) {
          ctx.beginPath();
          ctx.moveTo(x, centerY - 7);
          ctx.lineTo(x, centerY + 7);
          ctx.stroke();
        }

        // Champ électrique oscillant
        ctx.strokeStyle = laserHexColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = laserHexColor;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let x = laserSourceX + 30; x <= slitX; x += 2) {
          const oscY = centerY + Math.sin(((x - t * cVis) / lambdaVisPx) * 2 * Math.PI) * 6;
          if (x === laserSourceX + 30) ctx.moveTo(x, oscY);
          else ctx.lineTo(x, oscY);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = laserHexColor;
        ctx.font = '10px monospace';
        ctx.fillText('Onde incidente', laserSourceX + 35, centerY - 13);

        // 3. Fente micrométrique réglable a (visualisation physique de l'ouverture)
        // a varie de 20 µm à 150 µm : l'écartement des plaques varie de 4 px à 26 px
        const slitGapVisualPx = Math.max(4, Math.min(26, (slitWidthLaser / 150) * 24));
        const halfGap = slitGapVisualPx / 2;

        ctx.fillStyle = '#64748b';
        // Plaque supérieure
        ctx.fillRect(slitX - 4, 15, 8, centerY - halfGap - 15);
        // Plaque inférieure
        ctx.fillRect(slitX - 4, centerY + halfGap, 8, height - centerY - halfGap - 25);

        // Marquage de la fente a
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(slitX + 10, centerY - halfGap);
        ctx.lineTo(slitX + 10, centerY + halfGap);
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(slitX + 10, centerY - halfGap, 2, 0, Math.PI * 2);
        ctx.arc(slitX + 10, centerY + halfGap, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '10px monospace';
        ctx.fillText(`a = ${slitWidthLaser} µm`, slitX - 48, 14);

        // 4. DIFFRACTION DE LA LUMIÈRE : CÔNE DIFFRACTÉ & FRONTS D'ONDES CIRCULAIRES
        // Cône de diffusion lumineuse s'élargissant exactement vers la tache centrale
        const coneGrad = ctx.createRadialGradient(slitX, centerY, 5, slitX, centerY, D_distPx);
        coneGrad.addColorStop(0, `${laserHexColor}45`);
        coneGrad.addColorStop(0.5, `${laserHexColor}18`);
        coneGrad.addColorStop(1, `${laserHexColor}05`);
        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(slitX, centerY);
        ctx.lineTo(screenX, centerY - Y_centralPx);
        ctx.lineTo(screenX, centerY + Y_centralPx);
        ctx.closePath();
        ctx.fill();

        // Propagation des fronts d'onde circulaires diffractés (Huygens-Fresnel)
        const diffWaveOffset = (t * cVis) % lambdaVisPx;
        ctx.save();
        ctx.beginPath();
        ctx.rect(slitX, 0, screenX - slitX, height);
        ctx.clip();

        const maxConeAngle = Math.atan2(Y_centralPx * 1.5, D_distPx);
        for (let r = diffWaveOffset; r < D_distPx; r += lambdaVisPx) {
          if (r <= 5) continue;
          const numArcSegments = 24;
          const arcStep = (maxConeAngle * 2) / numArcSegments;

          for (let step = 0; step < numArcSegments; step++) {
            const a1 = -maxConeAngle + step * arcStep;
            const a2 = a1 + arcStep;
            const midA = (a1 + a2) / 2;

            // Paramètre u de diffraction
            const angleCentral = Math.atan2(Y_centralPx, D_distPx);
            const normU = (midA / angleCentral) * Math.PI;
            let intensity = 1.0;
            if (Math.abs(normU) > 0.05) {
              const s = Math.sin(normU) / normU;
              intensity = s * s;
            }

            const alphaHex = Math.floor(Math.min(1.0, intensity * 0.9) * 255).toString(16).padStart(2, '0');
            ctx.strokeStyle = `${laserHexColor}${alphaHex}`;
            ctx.lineWidth = intensity > 0.3 ? 2 : 1;
            ctx.beginPath();
            ctx.arc(slitX, centerY, r, a1, a2);
            ctx.stroke();
          }
        }
        ctx.restore();

        // Rayons limites de l'écart angulaire theta (reliant la fente au bord de la tache centrale)
        ctx.strokeStyle = `${laserHexColor}dd`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(slitX, centerY);
        ctx.lineTo(screenX, centerY - Y_centralPx);
        ctx.moveTo(slitX, centerY);
        ctx.lineTo(screenX, centerY + Y_centralPx);
        ctx.stroke();
        ctx.setLineDash([]);

        // Rayon central de référence
        ctx.strokeStyle = `${laserHexColor}55`;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(slitX, centerY);
        ctx.lineTo(screenX, centerY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arc angulaire 2θ
        const arcThetaRad = Math.atan2(Y_centralPx, D_distPx);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(slitX, centerY, 55, -arcThetaRad, arcThetaRad);
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.font = '10px monospace';
        ctx.fillText('2θ', slitX + 60, centerY + 3);

        // Rail optique au bas du canevas
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(slitX - 20, height - 22);
        ctx.lineTo(width - 20, height - 22);
        ctx.stroke();

        // Support coulissant de l'écran sur le rail
        ctx.fillStyle = '#475569';
        ctx.fillRect(screenX + 5, height - 26, 30, 8);

        // Cote de distance D
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(slitX, height - 12);
        ctx.lineTo(screenX, height - 12);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.fillText(`Distance D = ${distanceScreen.toFixed(1)} m`, (slitX + screenX) / 2 - 45, height - 2);

        // 5. ÉCRAN DE PROJECTION & FIGURE DE DIFFRACTION RÉELLE
        ctx.fillStyle = '#1e2433';
        ctx.fillRect(screenX, 15, 42, height - 42);
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(screenX, 15, 42, height - 42);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.fillText('Écran', screenX + 5, 28);

        // Rendu précis des franges lumineuses sur l'écran
        // u = ((py - centerY) / Y_centralPx) * PI
        // À py = centerY +/- Y_centralPx => u = +/- PI => I = 0 (première extinction)
        const patternStartY = 32;
        const patternEndY = height - 32;
        for (let py = patternStartY; py <= patternEndY; py += 1.5) {
          const dy = (py - centerY) / Y_centralPx;
          const u = dy * Math.PI;

          let intensity = 1.0;
          if (Math.abs(u) > 0.001) {
            const s = Math.sin(u) / u;
            intensity = s * s;
          }

          // Modulation subtile de cohérence vivante
          const livePhase = 0.92 + 0.08 * Math.sin(t * 8 - dy * 2);
          const finalIntensity = Math.min(1.0, intensity * livePhase);

          const alphaHex = Math.floor(finalIntensity * 255).toString(16).padStart(2, '0');
          ctx.strokeStyle = `${laserHexColor}${alphaHex}`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(screenX + 3, py);
          ctx.lineTo(screenX + 39, py);
          ctx.stroke();
        }

        // TACHE CENTRALE L : BRACKET DE MESURE DIRECTE
        const bracketX = screenX + 50;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bracketX, centerY - Y_centralPx);
        ctx.lineTo(bracketX, centerY + Y_centralPx);
        ctx.stroke();

        // Flèches d'extrémité du bracket L
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(bracketX, centerY - Y_centralPx, 2.5, 0, Math.PI * 2);
        ctx.arc(bracketX, centerY + Y_centralPx, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Lignes de rappel pointillées vers l'écran
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(screenX + 42, centerY - Y_centralPx);
        ctx.lineTo(bracketX, centerY - Y_centralPx);
        ctx.moveTo(screenX + 42, centerY + Y_centralPx);
        ctx.lineTo(bracketX, centerY + Y_centralPx);
        ctx.stroke();
        ctx.setLineDash([]);

        // Libellé de la largeur L
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`L = ${centralWidthCm.toFixed(2)} cm`, bracketX + 8, centerY - Y_centralPx / 2);
        ctx.font = '9px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`(2θ · D)`, bracketX + 8, centerY - Y_centralPx / 2 + 13);
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      isSubscribed = false;
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [
    diffractionType,
    isPlaying,
    simSpeed,
    waterWavelength,
    slitWidthWater,
    waveFrequency,
    laserColor,
    slitWidthLaser,
    distanceScreen,
    ratioWater,
    isDiffractionObserved,
    thetaRad,
    slitWidthLaserM,
    centralWidthCm,
  ]);

  const handleReset = () => {
    setWaterWavelength(20);
    setSlitWidthWater(18);
    setWaveFrequency(10);
    setLaserColor('red');
    setSlitWidthLaser(60);
    setDistanceScreen(1.5);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#17181c] border border-[#282a2c] rounded-3xl">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-teal-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
            <Maximize2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Simulateur de Diffraction des Ondes</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                2BAC BIOF
              </span>
            </h3>
            <p className="text-xs text-[#8e918f]">
              Ondes mécaniques à la surface de l'eau & Diffraction laser par une fente
            </p>
          </div>
        </div>

        {/* Tab switch : Cuve à eau vs Laser */}
        <div className="flex items-center gap-1.5 p-1 bg-[#131314] rounded-2xl border border-[#282a2c]">
          <button
            onClick={() => setDiffractionType('water')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              diffractionType === 'water'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-[#8e918f] hover:text-white'
            }`}
          >
            <Waves className="w-3.5 h-3.5" />
            <span>Cuve à ondes (Eau)</span>
          </button>

          <button
            onClick={() => setDiffractionType('laser')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              diffractionType === 'laser'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-[#8e918f] hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Diffraction Laser (Lumière)</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Canvas Stage */}
      <div className="p-4 bg-[#17181c] border border-[#282a2c] rounded-3xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#282a2c]/60">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-xl bg-[#282a2c] hover:bg-[#3c4043] text-white transition flex items-center gap-1.5 text-xs font-semibold"
            >
              {isPlaying ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
              <span>{isPlaying ? 'Pause' : 'Animer'}</span>
            </button>

            <button
              onClick={handleReset}
              className="p-2 rounded-xl bg-[#1e1f20] hover:bg-[#282a2c] text-[#8e918f] hover:text-white transition text-xs flex items-center gap-1"
              title="Réinitialiser les paramètres"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Valeurs standard</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#8e918f]">Vitesse :</span>
            {[0.5, 1.0, 1.5].map((speed) => (
              <button
                key={speed}
                onClick={() => setSimSpeed(speed)}
                className={`px-2 py-0.5 rounded-lg font-mono text-[11px] ${
                  simSpeed === speed ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-[#1e1f20] text-[#8e918f]'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Canvas Display */}
        <div className="relative rounded-2xl overflow-hidden border border-[#282a2c]">
          <canvas
            ref={canvasRef}
            width={850}
            height={260}
            className="w-full h-auto block bg-[#0f1117]"
          />
        </div>
      </div>

      {/* 3. Live Physics Calculations & Formula Cards */}
      {diffractionType === 'water' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
            <div className="text-[11px] text-[#8e918f]">Condition de diffraction</div>
            <div className={`text-base font-bold font-mono ${isDiffractionObserved ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isDiffractionObserved ? 'a ≤ λ (Diffraction nette)' : 'a > λ (Pas de diffraction)'}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">Rapport a/λ = {ratioWater.toFixed(2)}</div>
          </div>

          <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
            <div className="text-[11px] text-[#8e918f] flex items-center gap-1">
              <span>Longueur d'onde</span> <MathView content="$\lambda$" className="inline" />
            </div>
            <div className="text-base font-bold text-white font-mono">{waterWavelength} mm</div>
            <div className="text-[10px] text-sky-400">Conservée après la fente</div>
          </div>

          <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
            <div className="text-[11px] text-[#8e918f]">Célérité & Fréquence</div>
            <div className="text-base font-bold text-white font-mono">Inchangées</div>
            <div className="text-[10px] text-emerald-400 font-mono">
              <MathView content={`$v_{\\text{avant}} = v_{\\text{après}}$ et $N = ${waveFrequency}\\text{ Hz}$`} />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
            <div className="text-[11px] text-[#8e918f] flex items-center gap-1">
              <span>Écart angulaire</span> <MathView content="$\theta$" className="inline" />
            </div>
            <div className="text-base font-bold text-amber-400 font-mono">{thetaMrad.toFixed(2)} mrad</div>
            <div className="text-[10px] text-slate-400 font-mono">
              <MathView content={`$\\theta = \\frac{\\lambda}{a} = ${thetaMrad.toFixed(2)}\\text{ mrad}$`} />
            </div>
          </div>

          <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
            <div className="text-[11px] text-[#8e918f] flex items-center gap-1">
              <span>Largeur tache centrale</span> <MathView content="$L$" className="inline" />
            </div>
            <div className="text-base font-bold text-sky-400 font-mono">{centralWidthCm.toFixed(2)} cm</div>
            <div className="text-[10px] text-slate-400 font-mono">
              <MathView content="$L = \frac{2\lambda D}{a}$" />
            </div>
          </div>

          <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
            <div className="text-[11px] text-[#8e918f]">Laser sélectionné</div>
            <div className="text-base font-bold font-mono" style={{ color: laserHexColor }}>
              <MathView content={`$\\lambda = ${laserWavelengthNm}\\text{ nm}$`} />
            </div>
            <div className="text-[10px] text-slate-400">Couleur {laserColor.toUpperCase()}</div>
          </div>
        </div>
      )}

      {/* 4. Controls (Sliders) */}
      <div className="p-4 bg-[#17181c] border border-[#282a2c] rounded-3xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#282a2c]/60">
          <span className="text-xs font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#8ab4f8]" />
            Réglages interactifs
          </span>
          <span className="text-[11px] text-[#8e918f]">
            Faites varier la largeur d'ouverture ou la longueur d'onde pour observer l'étalement
          </span>
        </div>

        {diffractionType === 'water' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Slider: Largeur de la fente a */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[#8e918f] flex items-center gap-1">
                  <span>Largeur de fente</span> <MathView content="$a$" className="inline" /> :
                </span>
                <span className="font-mono font-bold text-amber-400">{slitWidthWater} mm</span>
              </div>
              <input
                type="range"
                min={8}
                max={50}
                step={2}
                value={slitWidthWater}
                onChange={(e) => setSlitWidthWater(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-[#8e918f] block">
                {ratioWater <= 1 ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    ✓ <MathView content="$a \le \lambda$" className="inline" /> : diffraction circulaire nette
                  </span>
                ) : (
                  <span>
                    <MathView content="$a > \lambda$" className="inline" /> : diaphragme (peu de diffraction)
                  </span>
                )}
              </span>
            </div>

            {/* Slider: Longueur d'onde lambda */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[#8e918f] flex items-center gap-1">
                  <span>Longueur d'onde</span> <MathView content="$\lambda$" className="inline" /> :
                </span>
                <span className="font-mono font-bold text-sky-400">{waterWavelength} mm</span>
              </div>
              <input
                type="range"
                min={10}
                max={40}
                step={2}
                value={waterWavelength}
                onChange={(e) => setWaterWavelength(parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
              <span className="text-[10px] text-[#8e918f] block">Distance entre deux crêtes successives</span>
            </div>

            {/* Slider: Fréquence N */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[#8e918f] flex items-center gap-1">
                  <span>Fréquence vibreur</span> <MathView content="$N$" className="inline" /> :
                </span>
                <span className="font-mono font-bold text-purple-400">{waveFrequency} Hz</span>
              </div>
              <input
                type="range"
                min={5}
                max={25}
                step={1}
                value={waveFrequency}
                onChange={(e) => setWaveFrequency(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <span className="text-[10px] text-[#8e918f] block">Fréquence de la source</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Choix laser */}
            <div className="space-y-1.5">
              <span className="text-[#8e918f] block">Couleur du laser :</span>
              <div className="grid grid-cols-3 gap-2">
                {(['red', 'green', 'blue'] as const).map((color) => (
                  <button
                    key={color}
                    onClick={() => setLaserColor(color)}
                    className={`py-1.5 rounded-xl font-bold text-xs capitalize transition border ${
                      laserColor === color
                        ? color === 'red'
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                          : color === 'green'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                          : 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                        : 'bg-[#131314] text-[#8e918f] border-[#282a2c]'
                    }`}
                  >
                    {color === 'red' ? 'Rouge' : color === 'green' ? 'Vert' : 'Bleu'}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-[#8e918f] block">
                <MathView content="$\lambda_{\text{rouge}} > \lambda_{\text{vert}} > \lambda_{\text{bleu}}$" className="inline" /> (le rouge s'étale plus !)
              </span>
            </div>

            {/* Slider: Largeur de fente a */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[#8e918f] flex items-center gap-1">
                  <span>Largeur fente</span> <MathView content="$a$" className="inline" /> :
                </span>
                <span className="font-mono font-bold text-amber-400">{slitWidthLaser} µm</span>
              </div>
              <input
                type="range"
                min={20}
                max={150}
                step={5}
                value={slitWidthLaser}
                onChange={(e) => setSlitWidthLaser(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-[#8e918f] block">
                Plus la fente est étroite, plus la tache s'élargit !
              </span>
            </div>

            {/* Slider: Distance fente-écran D */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[#8e918f] flex items-center gap-1">
                  <span>Distance écran</span> <MathView content="$D$" className="inline" /> :
                </span>
                <span className="font-mono font-bold text-sky-400">{distanceScreen.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={3.0}
                step={0.1}
                value={distanceScreen}
                onChange={(e) => setDistanceScreen(parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
              <span className="text-[10px] text-[#8e918f] flex items-center gap-1">
                <MathView content="$L$" className="inline" /> est proportionnelle à la distance <MathView content="$D$" className="inline" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Règles d'or du Bac & Pièges classiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-2">
          <div className="font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Règle d'or du National : Ce qui change et ne change PAS</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-[#c4c7c5]">
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>
                <strong>
                  <MathView content="$\lambda$" className="inline" />, <MathView content="$v$" className="inline" /> et <MathView content="$N$" className="inline" /> sont strictement conservées
                </strong>{' '}
                après le passage de l'ouverture (car le milieu reste le même).
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Seule la géométrie de l'onde change</strong> : l'onde plane devient circulaire.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-400 font-bold">📌</span>
              <span>La diffraction prouve la <strong>nature ondulatoire</strong> de la lumière.</span>
            </li>
          </ul>
        </div>

        <div className="p-4 bg-[#17181c] border border-amber-500/30 rounded-2xl space-y-2">
          <div className="font-bold text-amber-300 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>Questions typiques du Baccalauréat BIOF</span>
          </div>
          <div className="text-[11px] text-[#c4c7c5] leading-relaxed flex items-center gap-1 flex-wrap">
            <em>« Comment évolue la largeur</em>
            <MathView content="$L$" className="inline" />
            <em>de la tache centrale si on diminue la largeur de la fente</em>
            <MathView content="$a$" className="inline" />
            <em>? »</em>
          </div>
          <div className="p-2.5 bg-[#131314] rounded-xl border border-[#282a2c] text-[11px] text-sky-300 font-mono">
            <MathView content="$$L = \frac{2\lambda D}{a} \implies a \searrow \implies L \nearrow$$" />
          </div>
          <p className="text-[10px] text-[#8e918f] flex items-center gap-1 flex-wrap">
            <span>La largeur</span>
            <MathView content="$L$" className="inline text-sky-300" />
            <span>de la tache centrale est inversement proportionnelle à</span>
            <MathView content="$a$" className="inline text-amber-300" />.
          </p>
        </div>
      </div>
    </div>
  );
};
