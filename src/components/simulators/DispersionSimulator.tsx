import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Info,
  HelpCircle,
  Sliders,
  Triangle,
  Waves,
  Palette,
  CheckCircle2,
} from 'lucide-react';
import { MathView } from '../MathView';

export const DispersionSimulator: React.FC = () => {
  // Mode : Prisme (Lumière) vs Cuve à ondes (Mécanique)
  const [dispersionMode, setDispersionMode] = useState<'prism' | 'water'>('prism');

  // Animation controls
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);

  // --- PARAMÈTRES PRISME OPTIQUE ---
  const [lightType, setLightType] = useState<'white' | 'mono'>('white');
  const [monoWavelengthNm, setMonoWavelengthNm] = useState<number>(550); // 400 nm to 750 nm
  const [incidenceAngleDeg, setIncidenceAngleDeg] = useState<number>(45); // angle i en degrés
  const prismAngleDeg = 60; // angle au sommet A = 60°

  // --- PARAMÈTRES CUVE À ONDES (MILIEU DISPERSIF) ---
  const [isDispersiveMedium, setIsDispersiveMedium] = useState<boolean>(true);
  const [freq1, setFreq1] = useState<number>(10); // Hz
  const [freq2, setFreq2] = useState<number>(30); // Hz

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const simTimeRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);

  // Constantes de Cauchy pour le verre flint standard : n(lambda) = A + B / lambda^2
  // lambda en µm
  const cauchyA = 1.50;
  const cauchyB = 0.008; // µm²

  const getRefractiveIndex = (wavelengthNm: number) => {
    const lambdaUm = wavelengthNm * 1e-3;
    return cauchyA + cauchyB / (lambdaUm * lambdaUm);
  };

  // Calcul optique pour une longueur d'onde donnée
  const computePrismRay = (wavelengthNm: number, angleIDeg: number) => {
    const n = getRefractiveIndex(wavelengthNm);
    const iRad = (angleIDeg * Math.PI) / 180;
    const aRad = (prismAngleDeg * Math.PI) / 180;

    // 1ère face : sin(i) = n * sin(r)
    const sinR = Math.sin(iRad) / n;
    if (Math.abs(sinR) > 1) return null; // Réflexion totale
    const rRad = Math.asin(sinR);

    // 2ème face : r' = A - r
    const rPrimeRad = aRad - rRad;

    // sin(i') = n * sin(r')
    const sinIPrime = n * Math.sin(rPrimeRad);
    if (Math.abs(sinIPrime) > 1) return null; // Réflexion totale sur 2ème face
    const iPrimeRad = Math.asin(sinIPrime);

    // Déviation totale : D = i + i' - A
    const deviationRad = iRad + iPrimeRad - aRad;
    const deviationDeg = (deviationRad * 180) / Math.PI;

    return {
      n,
      deviationDeg,
      speedKmS: Math.round(300_000 / n), // v = c / n
      rDeg: (rRad * 180) / Math.PI,
      iPrimeDeg: (iPrimeRad * 180) / Math.PI,
    };
  };

  // Données spectrales du prisme
  const spectralColors = [
    { name: 'Rouge', lambda: 700, hex: '#ef4444' },
    { name: 'Orange', lambda: 620, hex: '#f97316' },
    { name: 'Jaune', lambda: 580, hex: '#eab308' },
    { name: 'Vert', lambda: 530, hex: '#22c55e' },
    { name: 'Bleu', lambda: 480, hex: '#06b6d4' },
    { name: 'Indigo', lambda: 440, hex: '#6366f1' },
    { name: 'Violet', lambda: 400, hex: '#a855f7' },
  ];

  // Calculs comparatifs Rouge vs Violet
  const redRay = computePrismRay(700, incidenceAngleDeg);
  const violetRay = computePrismRay(400, incidenceAngleDeg);

  // Célérité des ondes mécaniques (eau)
  // En eau dispersif : v proportionnel à 1/sqrt(N) ou formule théorique eau profonde v = g / (2*pi*N)
  const v1 = isDispersiveMedium ? 3.0 / Math.sqrt(freq1 / 10) : 3.5;
  const v2 = isDispersiveMedium ? 3.0 / Math.sqrt(freq2 / 10) : 3.5;

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

      if (dispersionMode === 'prism') {
        // =====================================================================
        // 1. DISPERSION PAR UN PRISME EN VERRE (ANIMATION DYNAMIQUE DES ONDES)
        // =====================================================================
        const prismApexX = width * 0.44;
        const prismApexY = 40;
        const prismSide = 170;
        const prismHeight = prismSide * Math.sin(Math.PI / 3);
        const prismLeftBaseX = prismApexX - prismSide / 2;
        const prismRightBaseX = prismApexX + prismSide / 2;
        const prismBaseY = prismApexY + prismHeight;

        // Tracé du prisme en verre (triangle équilatéral A = 60°)
        const prismGrad = ctx.createLinearGradient(prismApexX, prismApexY, prismApexX, prismBaseY);
        prismGrad.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
        prismGrad.addColorStop(1, 'rgba(30, 41, 59, 0.4)');
        ctx.fillStyle = prismGrad;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(prismApexX, prismApexY);
        ctx.lineTo(prismLeftBaseX, prismBaseY);
        ctx.lineTo(prismRightBaseX, prismBaseY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Label du prisme
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.fillText('Prisme en verre (A = 60°)', prismApexX - 55, prismApexY - 12);
        ctx.fillText('n(λ) = A + B/λ²', prismApexX - 35, prismBaseY + 16);

        // Point d'impact sur la face 1 (gauche)
        const hitFraction = 0.55;
        const hitX = prismApexX - (prismSide / 2) * (1 - hitFraction);
        const hitY = prismApexY + prismHeight * hitFraction;

        // Faisceau incident depuis la gauche
        const incAngleRad = (incidenceAngleDeg * Math.PI) / 180;
        const sourceDist = 180;
        const sourceX = hitX - Math.cos(incAngleRad - 0.5) * sourceDist;
        const sourceY = hitY + Math.sin(incAngleRad - 0.5) * sourceDist;

        // Vitesse de la lumière dans l'air (visuelle)
        const cAir = 110; // px/s
        const L1 = Math.hypot(hitX - sourceX, hitY - sourceY);
        const T1 = L1 / cAir;

        // Boîte source de lumière
        ctx.fillStyle = '#1e2433';
        ctx.fillRect(sourceX - 25, sourceY - 15, 30, 30);
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(sourceX - 25, sourceY - 15, 30, 30);
        ctx.fillStyle = lightType === 'white' ? '#ffffff' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(sourceX - 10, sourceY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Tracé du faisceau incident
        if (lightType === 'white') {
          // Faisceau blanc incident avec lueur
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(sourceX, sourceY);
          ctx.lineTo(hitX, hitY);
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sourceX, sourceY);
          ctx.lineTo(hitX, hitY);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText('Lumière Blanche', sourceX - 10, sourceY - 20);
        } else {
          // Faisceau monochromatique
          const monoHex = spectralColors.reduce((prev, curr) =>
            Math.abs(curr.lambda - monoWavelengthNm) < Math.abs(prev.lambda - monoWavelengthNm) ? curr : prev
          ).hex;

          ctx.strokeStyle = `${monoHex}40`;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(sourceX, sourceY);
          ctx.lineTo(hitX, hitY);
          ctx.stroke();

          ctx.strokeStyle = monoHex;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(sourceX, sourceY);
          ctx.lineTo(hitX, hitY);
          ctx.stroke();

          ctx.fillStyle = monoHex;
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(`Laser λ = ${monoWavelengthNm} nm`, sourceX - 10, sourceY - 20);
        }

        // Écran blanc de projection à droite
        const screenX = width - 60;
        ctx.fillStyle = '#1e2433';
        ctx.fillRect(screenX, 20, 20, height - 40);
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(screenX, 20, 20, height - 40);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.fillText('Écran', screenX - 5, height - 8);

        // Rayons à calculer
        const raysToRender = lightType === 'white'
          ? spectralColors
          : [{ name: 'Mono', lambda: monoWavelengthNm, hex: spectralColors.reduce((p, c) => Math.abs(c.lambda - monoWavelengthNm) < Math.abs(p.lambda - monoWavelengthNm) ? c : p).hex }];

        // Tracé des lignes fixes des rayons
        raysToRender.forEach((rayInfo) => {
          const res = computePrismRay(rayInfo.lambda, incidenceAngleDeg);
          if (!res) return;

          const hit2X = prismApexX + (prismSide / 2) * (1 - hitFraction * 0.95);
          const hit2Y = hitY - 10 + (rayInfo.lambda - 550) * 0.08;

          // Rayon dans le prisme
          ctx.strokeStyle = `${rayInfo.hex}99`;
          ctx.lineWidth = lightType === 'white' ? 1.5 : 2.5;
          ctx.beginPath();
          ctx.moveTo(hitX, hitY);
          ctx.lineTo(hit2X, hit2Y);
          ctx.stroke();

          // Rayon émergent vers l'écran
          const devAngleRad = (res.deviationDeg * Math.PI) / 180;
          const screenY = hit2Y + Math.tan(devAngleRad * 0.45) * (screenX - hit2X);

          ctx.strokeStyle = `${rayInfo.hex}cc`;
          ctx.lineWidth = lightType === 'white' ? 1.5 : 2.5;
          ctx.beginPath();
          ctx.moveTo(hit2X, hit2Y);
          ctx.lineTo(screenX, screenY);
          ctx.stroke();

          // Tache spectrale sur l'écran
          ctx.fillStyle = rayInfo.hex;
          ctx.shadowColor = rayInfo.hex;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(screenX + 10, screenY, lightType === 'white' ? 3.5 : 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        });

        // =====================================================================
        // ANIMATION DES PAQUETS D'ONDES / PHOTONS (PROPAGATION CONTINUE)
        // =====================================================================
        // On génère 4 paquets d'ondes successifs en boucle
        const cyclePeriod = 2.4; // secondes par cycle
        const numPulses = 4;

        for (let p = 0; p < numPulses; p++) {
          const pulsePhase = (t + (p * cyclePeriod) / numPulses) % cyclePeriod;

          raysToRender.forEach((rayInfo) => {
            const res = computePrismRay(rayInfo.lambda, incidenceAngleDeg);
            if (!res) return;

            const hit2X = prismApexX + (prismSide / 2) * (1 - hitFraction * 0.95);
            const hit2Y = hitY - 10 + (rayInfo.lambda - 550) * 0.08;
            const devAngleRad = (res.deviationDeg * Math.PI) / 180;
            const screenY = hit2Y + Math.tan(devAngleRad * 0.45) * (screenX - hit2X);

            const L2 = Math.hypot(hit2X - hitX, hit2Y - hitY);
            const L3 = Math.hypot(screenX - hit2X, screenY - hit2Y);

            // Célérité dans le verre : v(lambda) = cAir / n(lambda)
            // Accentuation visuelle : le rouge va plus vite que le violet
            const speedScale = 0.50 + 0.22 * ((rayInfo.lambda - 400) / 300);
            const vGlass = cAir * speedScale;
            const T2 = L2 / vGlass;
            const T3 = L3 / cAir;

            let curX = sourceX;
            let curY = sourceY;
            let packetColor = lightType === 'white' ? '#ffffff' : rayInfo.hex;
            let packetSize = 3.5;

            if (pulsePhase < T1) {
              // Étape 1 : Avant le prisme (dans l'air)
              const u = pulsePhase / T1;
              curX = sourceX + (hitX - sourceX) * u;
              curY = sourceY + (hitY - sourceY) * u;
              packetColor = lightType === 'white' ? '#ffffff' : rayInfo.hex;
              packetSize = 3.5;
            } else if (pulsePhase < T1 + T2) {
              // Étape 2 : DANS LE PRISME (Milieu dispersif : v dépend de lambda !)
              // Le paquet rouge avance plus vite que le violet !
              const u = (pulsePhase - T1) / T2;
              curX = hitX + (hit2X - hitX) * u;
              curY = hitY + (hit2Y - hitY) * u;
              packetColor = rayInfo.hex; // Séparation des couleurs dans le prisme
              packetSize = 3.0;
            } else if (pulsePhase < T1 + T2 + T3) {
              // Étape 3 : Après le prisme (vers l'écran)
              const u = (pulsePhase - T1 - T2) / T3;
              curX = hit2X + (screenX - hit2X) * u;
              curY = hit2Y + (screenY - hit2Y) * u;
              packetColor = rayInfo.hex;
              packetSize = 3.0;
            } else {
              return; // Paquet arrivé sur l'écran
            }

            // Dessin du paquet d'ondes / photon en déplacement
            ctx.fillStyle = packetColor;
            ctx.shadowColor = packetColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(curX, curY, packetSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          });
        }

        // Annotations comparatives Rouge vs Violet
        if (lightType === 'white') {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 10px monospace';
          ctx.fillText('Rouge (λ grand ⟹ n petit ⟹ v plus grand ⟹ D faible)', screenX - 320, 65);

          ctx.fillStyle = '#a855f7';
          ctx.fillText('Violet (λ petit ⟹ n grand ⟹ v plus faible ⟹ D maximal)', screenX - 320, height - 35);
        }
      } else {
        // =====================================================================
        // 2. MILIEU DISPERSIF EN ONDES MÉCANIQUES (SURFACE DE L'EAU)
        // =====================================================================
        const originX = 50;
        const trackLength = width - 100;
        const yTrack1 = height * 0.35;
        const yTrack2 = height * 0.72;

        // Track 1 : Onde basse fréquence N1
        ctx.fillStyle = '#1e2433';
        ctx.fillRect(originX, yTrack1 - 40, trackLength, 75);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(originX, yTrack1 - 40, trackLength, 75);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`Onde 1 : Fréquence N₁ = ${freq1} Hz | Célérité v₁ = ${v1.toFixed(2)} m/s`, originX + 10, yTrack1 - 25);

        // Track 2 : Onde haute fréquence N2
        ctx.fillStyle = '#1e2433';
        ctx.fillRect(originX, yTrack2 - 40, trackLength, 75);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(originX, yTrack2 - 40, trackLength, 75);

        ctx.fillStyle = '#a855f7';
        ctx.fillText(`Onde 2 : Fréquence N₂ = ${freq2} Hz | Célérité v₂ = ${v2.toFixed(2)} m/s`, originX + 10, yTrack2 - 25);

        // Animation des fronts d'onde
        const lambda1Px = (v1 / freq1) * 350;
        const lambda2Px = (v2 / freq2) * 350;

        const posFront1 = ((t * v1 * 60) % trackLength);
        const posFront2 = ((t * v2 * 60) % trackLength);

        // Sinusoïde 1
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let x = 0; x < trackLength; x += 2) {
          const y = yTrack1 + 10 + Math.sin((x - t * v1 * 60) / (lambda1Px / (2 * Math.PI))) * 15;
          if (x === 0) ctx.moveTo(originX + x, y);
          else ctx.lineTo(originX + x, y);
        }
        ctx.stroke();

        // Sinusoïde 2
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let x = 0; x < trackLength; x += 2) {
          const y = yTrack2 + 10 + Math.sin((x - t * v2 * 60) / (lambda2Px / (2 * Math.PI))) * 15;
          if (x === 0) ctx.moveTo(originX + x, y);
          else ctx.lineTo(originX + x, y);
        }
        ctx.stroke();

        // Repères de front d'onde
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(originX + posFront1, yTrack1 - 35);
        ctx.lineTo(originX + posFront1, yTrack1 + 30);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(originX + posFront2, yTrack2 - 35);
        ctx.lineTo(originX + posFront2, yTrack2 + 30);
        ctx.stroke();
        ctx.setLineDash([]);

        // Indicateur d'état
        ctx.fillStyle = isDispersiveMedium ? '#f59e0b' : '#34d399';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(
          isDispersiveMedium
            ? '⚡ Milieu Dispersif : v₁ ≠ v₂ (les deux ondes se décalent !)'
            : '✓ Milieu Non-Dispersif : v₁ = v₂ = 3.5 m/s (même célérité quelle que soit la fréquence)',
          originX + 10,
          20
        );
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      isSubscribed = false;
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [
    dispersionMode,
    isPlaying,
    simSpeed,
    lightType,
    monoWavelengthNm,
    incidenceAngleDeg,
    isDispersiveMedium,
    freq1,
    freq2,
    v1,
    v2,
  ]);

  const handleReset = () => {
    setLightType('white');
    setMonoWavelengthNm(550);
    setIncidenceAngleDeg(45);
    setIsDispersiveMedium(true);
    setFreq1(10);
    setFreq2(30);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#17181c] border border-[#282a2c] rounded-3xl">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Simulateur du Phénomène de Dispersion</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                2BAC BIOF
              </span>
            </h3>
            <p className="text-xs text-[#8e918f]">
              Décomposition de la lumière par un prisme & Milieu mécanique dispersif
            </p>
          </div>
        </div>

        {/* Tab switch : Prisme vs Cuve à ondes */}
        <div className="flex items-center gap-1.5 p-1 bg-[#131314] rounded-2xl border border-[#282a2c]">
          <button
            onClick={() => setDispersionMode('prism')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              dispersionMode === 'prism'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-[#8e918f] hover:text-white'
            }`}
          >
            <Triangle className="w-3.5 h-3.5" />
            <span>Prisme Optique (Lumière)</span>
          </button>

          <button
            onClick={() => setDispersionMode('water')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              dispersionMode === 'water'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-[#8e918f] hover:text-white'
            }`}
          >
            <Waves className="w-3.5 h-3.5" />
            <span>Cuve à ondes (Mécanique)</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Canvas */}
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
                  simSpeed === speed ? 'bg-purple-500 text-white font-bold' : 'bg-[#1e1f20] text-[#8e918f]'
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

      {/* 3. Real-time Physics Cards */}
      {dispersionMode === 'prism' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
            <div className="text-[11px] text-[#8e918f]">Déviation Rouge vs Violet</div>
            <div className="text-base font-bold text-amber-300 font-mono">
              D_violet &gt; D_rouge
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              D_R = {redRay?.deviationDeg.toFixed(1)}° vs D_V = {violetRay?.deviationDeg.toFixed(1)}°
            </div>
          </div>

          <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
            <div className="text-[11px] text-[#8e918f]">Indice de réfraction n(λ)</div>
            <div className="text-base font-bold text-white font-mono">
              n_V ({violetRay?.n.toFixed(3)}) &gt; n_R ({redRay?.n.toFixed(3)})
            </div>
            <div className="text-[10px] text-purple-400 font-mono">Formule de Cauchy : n = A + B/λ²</div>
          </div>

          <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
            <div className="text-[11px] text-[#8e918f]">Vitesse de la lumière dans le prisme</div>
            <div className="text-base font-bold text-sky-400 font-mono">
              v_R &gt; v_V
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              v = c / n (le rouge va plus vite dans le verre)
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
            <div className="text-[11px] text-[#8e918f]">Nature du milieu</div>
            <div className={`text-base font-bold font-mono ${isDispersiveMedium ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isDispersiveMedium ? 'Milieu Dispersif (Eau)' : 'Milieu Non-Dispersif'}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {isDispersiveMedium ? 'v dépend de la fréquence N' : 'v = cte = 3.5 m/s'}
            </div>
          </div>

          <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
            <div className="text-[11px] text-[#8e918f]">Célérité onde 1 (N₁ = {freq1} Hz)</div>
            <div className="text-base font-bold text-sky-400 font-mono">{v1.toFixed(2)} m/s</div>
            <div className="text-[10px] text-slate-400 font-mono">λ₁ = {(v1 / freq1).toFixed(3)} m</div>
          </div>

          <div className="p-3.5 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-1">
            <div className="text-[11px] text-[#8e918f]">Célérité onde 2 (N₂ = {freq2} Hz)</div>
            <div className="text-base font-bold text-purple-400 font-mono">{v2.toFixed(2)} m/s</div>
            <div className="text-[10px] text-slate-400 font-mono">λ₂ = {(v2 / freq2).toFixed(3)} m</div>
          </div>
        </div>
      )}

      {/* 4. Controls */}
      <div className="p-4 bg-[#17181c] border border-[#282a2c] rounded-3xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#282a2c]/60">
          <span className="text-xs font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#8ab4f8]" />
            Réglages physiques
          </span>
          <span className="text-[11px] text-[#8e918f]">
            Ajustez l'angle d'incidence ou la nature du milieu
          </span>
        </div>

        {dispersionMode === 'prism' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Type de lumière : Blanche vs Monochromatique */}
            <div className="space-y-1.5">
              <span className="text-[#8e918f] block">Nature du faisceau :</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setLightType('white')}
                  className={`py-2 rounded-xl font-bold text-xs transition border ${
                    lightType === 'white'
                      ? 'bg-white/20 text-white border-white/50'
                      : 'bg-[#131314] text-[#8e918f] border-[#282a2c]'
                  }`}
                >
                  Lumière Blanche
                </button>
                <button
                  onClick={() => setLightType('mono')}
                  className={`py-2 rounded-xl font-bold text-xs transition border ${
                    lightType === 'mono'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                      : 'bg-[#131314] text-[#8e918f] border-[#282a2c]'
                  }`}
                >
                  Monochromatique
                </button>
              </div>
              <span className="text-[10px] text-[#8e918f] block">
                {lightType === 'white' ? 'Polychromatique (décomposition)' : '1 seule radiation (pas de décomposition)'}
              </span>
            </div>

            {/* Slider : Angle d'incidence i */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#8e918f]">Angle d'incidence (i) :</span>
                <span className="font-mono font-bold text-amber-400">{incidenceAngleDeg}°</span>
              </div>
              <input
                type="range"
                min={30}
                max={60}
                step={1}
                value={incidenceAngleDeg}
                onChange={(e) => setIncidenceAngleDeg(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-[10px] text-[#8e918f] block">Modifie l'angle d'entrée sur la face 1</span>
            </div>

            {/* Slider si monochromatique */}
            {lightType === 'mono' && (
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#8e918f]">Longueur d'onde (λ) :</span>
                  <span className="font-mono font-bold text-purple-400">{monoWavelengthNm} nm</span>
                </div>
                <input
                  type="range"
                  min={400}
                  max={700}
                  step={10}
                  value={monoWavelengthNm}
                  onChange={(e) => setMonoWavelengthNm(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <span className="text-[10px] text-[#8e918f] block">Indice n = {getRefractiveIndex(monoWavelengthNm).toFixed(3)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Choix Milieu dispersif vs non-dispersif */}
            <div className="space-y-1.5">
              <span className="text-[#8e918f] block">Comportement du milieu :</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsDispersiveMedium(true)}
                  className={`py-2 rounded-xl font-bold text-xs transition border ${
                    isDispersiveMedium
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-[#131314] text-[#8e918f] border-[#282a2c]'
                  }`}
                >
                  Dispersif (Eau)
                </button>
                <button
                  onClick={() => setIsDispersiveMedium(false)}
                  className={`py-2 rounded-xl font-bold text-xs transition border ${
                    !isDispersiveMedium
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-[#131314] text-[#8e918f] border-[#282a2c]'
                  }`}
                >
                  Non-Dispersif (Corde)
                </button>
              </div>
              <span className="text-[10px] text-[#8e918f] block">
                {isDispersiveMedium ? 'v dépend de N (v1 ≠ v2)' : 'v = constante pour tout N'}
              </span>
            </div>

            {/* Slider: Fréquence N1 */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#8e918f]">Fréquence N₁ :</span>
                <span className="font-mono font-bold text-sky-400">{freq1} Hz</span>
              </div>
              <input
                type="range"
                min={5}
                max={25}
                step={1}
                value={freq1}
                onChange={(e) => setFreq1(parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
              <span className="text-[10px] text-[#8e918f] block">Célérité résultante : v₁ = {v1.toFixed(2)} m/s</span>
            </div>

            {/* Slider: Fréquence N2 */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#8e918f]">Fréquence N₂ :</span>
                <span className="font-mono font-bold text-purple-400">{freq2} Hz</span>
              </div>
              <input
                type="range"
                min={20}
                max={50}
                step={2}
                value={freq2}
                onChange={(e) => setFreq2(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <span className="text-[10px] text-[#8e918f] block">Célérité résultante : v₂ = {v2.toFixed(2)} m/s</span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Règles d'or du Baccalauréat */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 bg-[#17181c] border border-[#282a2c] rounded-2xl space-y-2">
          <div className="font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Définition officielle 2BAC BIOF</span>
          </div>
          <div className="p-2.5 bg-[#131314] rounded-xl border border-[#282a2c] text-xs text-sky-300 font-medium leading-relaxed">
            « Un milieu de propagation est dit <strong>dispersif</strong> si la célérité $v$ de l'onde dans ce milieu <strong>dépend de sa fréquence $N$</strong> ($v = f(N)$). »
          </div>
          <p className="text-[11px] text-[#8e918f]">
            Exemples du cours : la surface de l'eau est un milieu dispersif. L'air pour les ondes sonores est non dispersif. Le verre pour la lumière est un milieu dispersif.
          </p>
        </div>

        <div className="p-4 bg-[#17181c] border border-amber-500/30 rounded-2xl space-y-2">
          <div className="font-bold text-amber-300 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>Démonstration type National : Pourquoi le violet est plus dévié ?</span>
          </div>
          <div className="space-y-1.5 text-[11px] text-[#c4c7c5]">
            <MathView content="$$1.\quad \lambda_{\text{violet}} < \lambda_{\text{rouge}}$$" />
            <MathView content="$$2.\quad n = A + \frac{B}{\lambda^2} \implies n_{\text{violet}} > n_{\text{rouge}}$$" />
            <MathView content="$$3.\quad \text{L'indice } n \text{ étant plus élevé} \implies D_{\text{violet}} > D_{\text{rouge}}$$" />
          </div>
        </div>
      </div>
    </div>
  );
};
