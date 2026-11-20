import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Sparkles,
  Info,
  HelpCircle,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowRight,
  TrendingUp,
  Clock,
  Layers,
  Gauge,
  BookOpen,
} from 'lucide-react';
import { MathView } from '../MathView';

interface DataPoint {
  t: number;
  uC: number;
  i: number;
  mode: 'charge' | 'discharge';
}

export const RcExaoSimulator: React.FC = () => {
  // --- Paramètres du circuit RC ---
  const [E, setE] = useState<number>(6.0); // Volts (comme dans la vidéo PASCO)
  const [R, setR] = useState<number>(500); // Ohms
  const [C_uF, setC_uF] = useState<number>(1200); // microFarads

  // --- Modes de fonctionnement & Contrôles ---
  const [switchPosition, setSwitchPosition] = useState<1 | 2>(1); // 1 = Charge, 2 = Décharge
  const [isAutoCycle, setIsAutoCycle] = useState<boolean>(true); // Mode cyclique comme dans la vidéo
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1.0); // 0.5x, 1x, 2x

  // --- Options graphiques d'analyse Bac ---
  const [showTangent, setShowTangent] = useState<boolean>(true);
  const [showTauLine, setShowTauLine] = useState<boolean>(true);
  const [showAsymptote, setShowAsymptote] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // --- Onglet actif ---
  const [activeTab, setActiveTab] = useState<'lab' | 'equations' | 'course'>('lab');

  // --- Hover / Curseur de mesure sur le graphe ---
  const [hoverData, setHoverData] = useState<{ t: number; uC: number; i: number } | null>(null);

  // Refs Canvas et animation
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // État physique dynamique
  const simTimeRef = useRef<number>(0);
  const currentModeRef = useRef<'charge' | 'discharge'>('charge');
  const uC_startRef = useRef<number>(0);
  const t_switchRef = useRef<number>(0);
  const current_uCRef = useRef<number>(0);
  const current_iRef = useRef<number>(0);
  const historyRef = useRef<DataPoint[]>([]);

  // Constantes physiques dérivées
  const C_F = C_uF * 1e-6; // Farads
  const tau = R * C_F; // Constante de temps en secondes (ex: 500 * 1200e-6 = 0.6s)
  const I0_max = E / R; // Courant initial maximal en Ampères (ex: 6 / 500 = 0.012 A = 12 mA)
  const halfCycleDuration = 5 * tau; // Durée d'une demi-période en mode auto (5 * tau permet d'atteindre 99.3%)

  // Valeurs instantanées exposées pour l'UI React
  const [instantValues, setInstantValues] = useState<{
    t: number;
    uC: number;
    i: number;
    q: number;
    energy: number;
  }>({
    t: 0,
    uC: 0,
    i: I0_max,
    q: 0,
    energy: 0,
  });

  // Basculer l'interrupteur K
  const toggleSwitch = useCallback((newPos: 1 | 2) => {
    setSwitchPosition(newPos);
    currentModeRef.current = newPos === 1 ? 'charge' : 'discharge';
    uC_startRef.current = current_uCRef.current;
    t_switchRef.current = simTimeRef.current;
  }, []);

  // Réinitialiser la simulation
  const handleReset = useCallback(() => {
    simTimeRef.current = 0;
    currentModeRef.current = switchPosition === 1 ? 'charge' : 'discharge';
    uC_startRef.current = switchPosition === 1 ? 0 : E;
    t_switchRef.current = 0;
    current_uCRef.current = uC_startRef.current;
    current_iRef.current = switchPosition === 1 ? E / R : -E / R;
    historyRef.current = [{
      t: 0,
      uC: current_uCRef.current,
      i: current_iRef.current,
      mode: currentModeRef.current,
    }];
    setInstantValues({
      t: 0,
      uC: current_uCRef.current,
      i: current_iRef.current,
      q: C_F * current_uCRef.current,
      energy: 0.5 * C_F * Math.pow(current_uCRef.current, 2) * 1000,
    });
  }, [switchPosition, E, R, C_F]);

  // Initialisation au montage ou changement de composants critiques
  useEffect(() => {
    handleReset();
  }, [E, R, C_uF, handleReset]);

  // Boucle d'animation principale
  useEffect(() => {
    let active = true;

    const tick = (timestamp: number) => {
      if (!active) return;

      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const realDt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05); // cap à 50ms pour stabilité
      lastTimeRef.current = timestamp;

      if (isPlaying) {
        const simDt = realDt * simSpeed;
        simTimeRef.current += simDt;
        const t = simTimeRef.current;

        // Gestion du cycle automatique (comme dans la vidéo ExAO)
        if (isAutoCycle) {
          const cyclePeriod = 2 * halfCycleDuration;
          const phase = t % cyclePeriod;
          const shouldBeCharge = phase < halfCycleDuration;
          const targetPos: 1 | 2 = shouldBeCharge ? 1 : 2;

          if (targetPos !== switchPosition) {
            setSwitchPosition(targetPos);
            currentModeRef.current = shouldBeCharge ? 'charge' : 'discharge';
            uC_startRef.current = current_uCRef.current;
            t_switchRef.current = t;
          }
        }

        // Calcul analytique exact de uC(t) et i(t) depuis le dernier basculement
        const dtSinceSwitch = Math.max(0, t - t_switchRef.current);
        const expFactor = Math.exp(-dtSinceSwitch / tau);

        let uC = 0;
        let i = 0;

        if (currentModeRef.current === 'charge') {
          // Charge : u_C tend vers E
          uC = E + (uC_startRef.current - E) * expFactor;
          i = ((E - uC_startRef.current) / R) * expFactor;
        } else {
          // Décharge : u_C tend vers 0
          uC = uC_startRef.current * expFactor;
          i = -(uC_startRef.current / R) * expFactor;
        }

        current_uCRef.current = uC;
        current_iRef.current = i;

        // Ajouter au buffer d'historique (fréquence ~ 60fps)
        const lastPt = historyRef.current[historyRef.current.length - 1];
        if (!lastPt || t - lastPt.t >= 0.015) {
          historyRef.current.push({
            t,
            uC,
            i,
            mode: currentModeRef.current,
          });

          // Garder un historique jusqu'à 60 secondes max pour éviter fuite mémoire
          if (historyRef.current.length > 3500) {
            historyRef.current.shift();
          }
        }

        // Mettre à jour l'état affiché à l'écran
        setInstantValues({
          t,
          uC,
          i,
          q: C_F * uC,
          energy: 0.5 * C_F * Math.pow(uC, 2) * 1000, // en mJ
        });
      }

      // Rendu graphique sur le Canvas
      renderExaoCanvas();

      animFrameId.current = requestAnimationFrame(tick);
    };

    animFrameId.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [isPlaying, simSpeed, isAutoCycle, switchPosition, tau, E, R, C_F, halfCycleDuration]);

  // Rendu Canvas ExAO style PASCO Capstone
  const renderExaoCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Gestion de la résolution Retina
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const width = displayWidth;
    const height = displayHeight;

    // Arrière-plan sombre de l'oscilloscope ExAO
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, width, height);

    // Séparation des deux graphes :
    // Haut : I = f(t) (46% de la hauteur)
    // Bas : Uc = f(t) (46% de la hauteur)
    // Marge et gouttière
    const paddingLeft = 58;
    const paddingRight = 24;
    const plotWidth = width - paddingLeft - paddingRight;

    const graphTopHeight = height * 0.44;
    const graphGap = 28;
    const graphBottomY = graphTopHeight + graphGap;
    const graphBottomHeight = height - graphBottomY - 32;

    // Détermination de la fenêtre temporelle [tMin, tMax]
    // La vidéo montre une acquisition sur ~ 24s.
    const currentTime = simTimeRef.current;
    const windowSpan = Math.max(16, Math.ceil(currentTime / 6) * 6);
    const tMin = 0;
    const tMax = Math.max(windowSpan, 12);

    const timeToX = (t: number) => paddingLeft + ((t - tMin) / (tMax - tMin)) * plotWidth;

    // Échelles verticales
    // Graph 1: Courant I(t) de -I_max à +I_max
    const maxI_scale = Math.max(I0_max * 1.25, 0.015); // au moins 15 mA comme dans la vidéo
    const zeroY_I = graphTopHeight / 2;
    const currentToY = (iVal: number) => zeroY_I - (iVal / maxI_scale) * (graphTopHeight * 0.44);

    // Graph 2: Tension Uc(t) de 0 à E + marge
    const maxUc_scale = E * 1.15;
    const zeroY_Uc = graphBottomY + graphBottomHeight;
    const uCToY = (uVal: number) => zeroY_Uc - (uVal / maxUc_scale) * graphBottomHeight;

    // --- GRILLES ET AXES ---
    if (showGrid) {
      ctx.strokeStyle = '#1a2333';
      ctx.lineWidth = 1;

      // Lignes de temps verticales
      const timeStep = tMax <= 15 ? 2 : tMax <= 30 ? 4 : 5;
      for (let t = tMin; t <= tMax; t += timeStep) {
        const x = timeToX(t);
        ctx.beginPath();
        ctx.moveTo(x, 14);
        ctx.lineTo(x, graphTopHeight);
        ctx.moveTo(x, graphBottomY);
        ctx.lineTo(x, zeroY_Uc);
        ctx.stroke();

        // Label de temps en bas
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${t}s`, x, zeroY_Uc + 18);
      }

      // Lignes horizontales pour I(t)
      const iSteps = [-maxI_scale * 0.8, -maxI_scale * 0.4, 0, maxI_scale * 0.4, maxI_scale * 0.8];
      iSteps.forEach((iVal) => {
        const y = currentToY(iVal);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(paddingLeft + plotWidth, y);
        ctx.stroke();
      });

      // Lignes horizontales pour Uc(t)
      const uSteps = [0, E * 0.25, E * 0.5, E * 0.75, E];
      uSteps.forEach((uVal) => {
        const y = uCToY(uVal);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(paddingLeft + plotWidth, y);
        ctx.stroke();
      });
    }

    // Axe zéro principal pour I(t)
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, zeroY_I);
    ctx.lineTo(paddingLeft + plotWidth, zeroY_I);
    ctx.stroke();

    // Axe zéro principal pour Uc(t)
    ctx.beginPath();
    ctx.moveTo(paddingLeft, zeroY_Uc);
    ctx.lineTo(paddingLeft + plotWidth, zeroY_Uc);
    ctx.stroke();

    // Cadres des graphes
    ctx.strokeStyle = '#223049';
    ctx.lineWidth = 1;
    ctx.strokeRect(paddingLeft, 14, plotWidth, graphTopHeight - 14);
    ctx.strokeRect(paddingLeft, graphBottomY, plotWidth, graphBottomHeight);

    // Labels des axes Y
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';

    // Labels I(t) (mA)
    const maxI_mA = maxI_scale * 1000;
    ctx.fillText(`+${(maxI_mA * 0.8).toFixed(1)}`, paddingLeft - 8, currentToY(maxI_scale * 0.8) + 4);
    ctx.fillText('0', paddingLeft - 8, zeroY_I + 4);
    ctx.fillText(`-${(maxI_mA * 0.8).toFixed(1)}`, paddingLeft - 8, currentToY(-maxI_scale * 0.8) + 4);

    // Titre Graph 1
    ctx.fillStyle = '#f87171'; // Rouge comme dans la vidéo
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Courant  I = f(t)  [mA]', paddingLeft + 10, 28);

    // Labels Uc(t) (V)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${E.toFixed(1)}V`, paddingLeft - 8, uCToY(E) + 4);
    ctx.fillText(`${(E * 0.5).toFixed(1)}V`, paddingLeft - 8, uCToY(E * 0.5) + 4);
    ctx.fillText('0V', paddingLeft - 8, zeroY_Uc + 4);

    // Titre Graph 2
    ctx.fillStyle = '#4ade80'; // Vert comme dans la vidéo
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Tension  Uc = f(t)  [V]', paddingLeft + 10, graphBottomY + 18);

    // Asymptote horizontale uC = E
    if (showAsymptote) {
      const yAsymptote = uCToY(E);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, yAsymptote);
      ctx.lineTo(paddingLeft + plotWidth, yAsymptote);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Asymptote E = ${E.toFixed(1)} V`, paddingLeft + plotWidth - 10, yAsymptote - 4);
    }

    // --- REPRÉSENTATION PÉDAGOGIQUE DU BAC : TANGENTE & 63% / 37% ---
    if (historyRef.current.length > 0) {
      // Rechercher le dernier point de basculement de l'historique
      let lastSwitchIndex = 0;
      for (let k = historyRef.current.length - 1; k > 0; k--) {
        if (historyRef.current[k].mode !== historyRef.current[k - 1].mode) {
          lastSwitchIndex = k;
          break;
        }
      }

      const switchPt = historyRef.current[lastSwitchIndex];
      const isCharging = switchPt.mode === 'charge';
      const t0 = switchPt.t;
      const tTau = t0 + tau;

      // 1. Tangente à l'origine
      if (showTangent && tTau <= tMax) {
        const x0 = timeToX(t0);
        const xTau = timeToX(tTau);

        ctx.strokeStyle = '#facc15'; // Jaune éclatant
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 3]);

        if (isCharging) {
          // Tangente à la charge : part de (t0, 0) et passe par (t0 + tau, E)
          const y0 = uCToY(0);
          const yTau = uCToY(E);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(xTau, yTau);
          ctx.stroke();

          // Point d'intersection remarquable (t0 + tau, E)
          ctx.setLineDash([]);
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(xTau, yTau, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = '10px sans-serif';
          ctx.fillText(`(t₀+τ, E)`, xTau + 6, yTau - 6);
        } else {
          // Tangente à la décharge : part de (t0, E) et coupe l'axe (u=0) à t0 + tau
          const y0 = uCToY(E);
          const yTau = uCToY(0);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(xTau, yTau);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(xTau, yTau, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = '10px sans-serif';
          ctx.fillText(`(t₀+τ, 0)`, xTau + 6, yTau - 6);
        }
        ctx.setLineDash([]);
      }

      // 2. Méthode des 63% (Charge) ou 37% (Décharge)
      if (showTauLine && tTau <= tMax) {
        const xTau = timeToX(tTau);
        const uTauValue = isCharging ? 0.632 * E : 0.368 * E;
        const yTauVal = uCToY(uTauValue);

        ctx.strokeStyle = '#c084fc'; // Violet
        ctx.lineWidth = 1.4;
        ctx.setLineDash([3, 3]);

        // Ligne verticale descendante vers l'axe des temps
        ctx.beginPath();
        ctx.moveTo(xTau, graphBottomY);
        ctx.lineTo(xTau, zeroY_Uc);
        ctx.stroke();

        // Ligne horizontale vers l'axe des tensions
        ctx.beginPath();
        ctx.moveTo(paddingLeft, yTauVal);
        ctx.lineTo(xTau, yTauVal);
        ctx.stroke();
        ctx.setLineDash([]);

        // Marqueur rond violet
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(xTau, yTauVal, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(
          isCharging ? `0.63 E = ${uTauValue.toFixed(2)}V` : `0.37 E = ${uTauValue.toFixed(2)}V`,
          paddingLeft + 6,
          yTauVal - 4
        );
        ctx.fillText(`t = t₀ + τ (${tTau.toFixed(2)}s)`, xTau + 4, zeroY_Uc - 8);
      }
    }

    // --- TRACÉ DES COURBES HISTORIQUES ---
    const history = historyRef.current;
    if (history.length > 1) {
      // 1. Tracé Courbe I(t) en Rouge
      ctx.beginPath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      let startedI = false;
      for (let j = 0; j < history.length; j++) {
        const pt = history[j];
        if (pt.t < tMin) continue;
        const x = timeToX(pt.t);
        const y = currentToY(pt.i);

        if (!startedI) {
          ctx.moveTo(x, y);
          startedI = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // 2. Tracé Courbe Uc(t) en Vert
      ctx.beginPath();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      let startedUc = false;
      for (let j = 0; j < history.length; j++) {
        const pt = history[j];
        if (pt.t < tMin) continue;
        const x = timeToX(pt.t);
        const y = uCToY(pt.uC);

        if (!startedUc) {
          ctx.moveTo(x, y);
          startedUc = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Points traceurs animés en temps réel (Halo et tête de lecture)
      const lastPoint = history[history.length - 1];
      const headX = timeToX(lastPoint.t);
      const headY_I = currentToY(lastPoint.i);
      const headY_Uc = uCToY(lastPoint.uC);

      // Traceur I(t)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.beginPath();
      ctx.arc(headX, headY_I, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(headX, headY_I, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Traceur Uc(t)
      ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
      ctx.beginPath();
      ctx.arc(headX, headY_Uc, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(headX, headY_Uc, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Curseur de mesure Interactif (si souris survole le canvas)
    if (hoverData) {
      const hX = timeToX(hoverData.t);
      if (hX >= paddingLeft && hX <= paddingLeft + plotWidth) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);

        ctx.beginPath();
        ctx.moveTo(hX, 14);
        ctx.lineTo(hX, zeroY_Uc);
        ctx.stroke();
        ctx.setLineDash([]);

        // Badge d'info au survol
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(hX + 8, graphTopHeight - 30, 130, 58);
        ctx.fillRect(hX + 8, graphTopHeight - 30, 130, 58);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`t  = ${hoverData.t.toFixed(3)} s`, hX + 14, graphTopHeight - 14);
        ctx.fillStyle = '#f87171';
        ctx.fillText(`i  = ${(hoverData.i * 1000).toFixed(2)} mA`, hX + 14, graphTopHeight - 2);
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`Uc = ${hoverData.uC.toFixed(2)} V`, hX + 14, graphTopHeight + 10);
      }
    }

    ctx.restore();
  };

  // Gestion du survol de souris pour le curseur de mesure
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const paddingLeft = 58;
    const paddingRight = 24;
    const plotWidth = canvas.clientWidth - paddingLeft - paddingRight;
    const currentTime = simTimeRef.current;
    const windowSpan = Math.max(16, Math.ceil(currentTime / 6) * 6);
    const tMax = Math.max(windowSpan, 12);

    if (mouseX >= paddingLeft && mouseX <= paddingLeft + plotWidth) {
      const tHover = ((mouseX - paddingLeft) / plotWidth) * tMax;
      // Chercher le point le plus proche dans l'historique
      const history = historyRef.current;
      if (history.length > 0) {
        let closest = history[0];
        let minDiff = Math.abs(history[0].t - tHover);
        for (let i = 1; i < history.length; i++) {
          const diff = Math.abs(history[i].t - tHover);
          if (diff < minDiff) {
            minDiff = diff;
            closest = history[i];
          }
        }
        setHoverData({ t: closest.t, uC: closest.uC, i: closest.i });
      }
    } else {
      setHoverData(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  // Angle de déviation des aiguilles des galvanomètres (-45° à +45°)
  // Galvanomètre 1 (Courant, zéro central -0.02A à +0.02A)
  const meterCurrent = instantValues.i;
  const maxMeterCurrent = Math.max(I0_max * 1.2, 0.020);
  const currentAngleDeg = Math.min(Math.max((meterCurrent / maxMeterCurrent) * 45, -48), 48);

  // Galvanomètre 2 (Tension, zéro central ou -6V à +6V)
  const meterVoltage = instantValues.uC;
  const maxMeterVoltage = E * 1.15;
  const voltageAngleDeg = Math.min(Math.max((meterVoltage / maxMeterVoltage) * 45, -48), 48);

  return (
    <div className="space-y-6 text-[#e3e3e3]">
      {/* HEADER AVEC TITRE ET BADGES */}
      <div className="bg-[#1e1f20] p-4 sm:p-5 rounded-2xl border border-[#282a2c] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Activity className="w-5 h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide">
              Laboratoire ExAO : Charge & Décharge du Condensateur (RC)
            </h1>
          </div>
          <p className="text-xs text-[#8e918f] max-w-2xl leading-relaxed">
            Reproduction animée et interactive du dispositif d'acquisition informatisée (PASCO Capstone) :
            visualisation simultanée des courbes <span className="text-rose-400 font-mono font-medium">i(t)</span> et{' '}
            <span className="text-emerald-400 font-mono font-medium">u_C(t)</span>, galvanomètres à aiguille
            et exploitation de la constante de temps <span className="text-amber-400 font-mono font-medium">τ = R·C</span>.
          </p>
        </div>

        {/* Badge d'état de l'interrupteur K */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 shadow-sm ${
              switchPosition === 1
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                switchPosition === 1 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span>
              Position ({switchPosition}) : {switchPosition === 1 ? 'Charge active' : 'Décharge active'}
            </span>
          </div>
        </div>
      </div>

      {/* TABS DE NAVIGATION */}
      <div className="flex border-b border-[#282a2c] gap-2 overflow-x-auto no-scrollbar text-xs">
        <button
          onClick={() => setActiveTab('lab')}
          className={`pb-2.5 px-3.5 font-medium transition flex items-center gap-1.5 border-b-2 ${
            activeTab === 'lab'
              ? 'border-rose-400 text-white font-semibold'
              : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Station ExAO & Galvanomètres
        </button>

        <button
          onClick={() => setActiveTab('equations')}
          className={`pb-2.5 px-3.5 font-medium transition flex items-center gap-1.5 border-b-2 ${
            activeTab === 'equations'
              ? 'border-rose-400 text-white font-semibold'
              : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Équations Différentielles & Solutions Bac
        </button>

        <button
          onClick={() => setActiveTab('course')}
          className={`pb-2.5 px-3.5 font-medium transition flex items-center gap-1.5 border-b-2 ${
            activeTab === 'course'
              ? 'border-rose-400 text-white font-semibold'
              : 'border-transparent text-[#8e918f] hover:text-[#c4c7c5]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Méthodes & Pièges du National (2 BAC)
        </button>
      </div>

      {/* ONGLET 1 : LABORATOIRE EXAO (DISPOSITIF PRINCIPAL) */}
      {activeTab === 'lab' && (
        <div className="space-y-6">
          {/* SECTION CENTRALE : DOUBLE COURBES EXAO + INSTRUMENTS À AIGUILLE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* PANNEAU GAUCHE (7/12) : ÉCRAN D'ACQUISITION EXAO */}
            <div className="lg:col-span-8 bg-[#131720] p-4 rounded-2xl border border-[#282a2c] flex flex-col space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#222a38]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-xs font-bold text-white tracking-wide uppercase">
                    Acquisition Graphique Synchronisée (Interface ExAO)
                  </span>
                </div>

                {/* Options d'affichage des outils Bac */}
                <div className="flex items-center gap-2 text-[11px]">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#8e918f] hover:text-white transition">
                    <input
                      type="checkbox"
                      checked={showTangent}
                      onChange={(e) => setShowTangent(e.target.checked)}
                      className="rounded bg-[#1e1f20] border-[#3c4043] text-amber-500 focus:ring-0"
                    />
                    <span>Tangente à l'origine</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-[#8e918f] hover:text-white transition">
                    <input
                      type="checkbox"
                      checked={showTauLine}
                      onChange={(e) => setShowTauLine(e.target.checked)}
                      className="rounded bg-[#1e1f20] border-[#3c4043] text-purple-400 focus:ring-0"
                    />
                    <span>Repère τ (63% / 37%)</span>
                  </label>
                </div>
              </div>

              {/* CANVA INTERACTIF */}
              <div className="relative w-full h-[400px] sm:h-[430px] rounded-xl overflow-hidden border border-[#1e293b] bg-[#0a0d14]">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-crosshair block"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                />
              </div>

              {/* BARRE D'ÉTAT TEMPORELLE ET VALEURS INSTANTANÉES */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-center text-xs">
                <div className="bg-[#1a202c] p-2 rounded-xl border border-[#2d3748]">
                  <div className="text-[10px] text-[#8e918f]">Temps écoulé</div>
                  <div className="font-mono font-bold text-white text-sm">
                    {instantValues.t.toFixed(2)} s
                  </div>
                </div>

                <div className="bg-[#1a202c] p-2 rounded-xl border border-[#2d3748]">
                  <div className="text-[10px] text-emerald-400">Tension u_C(t)</div>
                  <div className="font-mono font-bold text-emerald-300 text-sm">
                    {instantValues.uC.toFixed(2)} V
                  </div>
                </div>

                <div className="bg-[#1a202c] p-2 rounded-xl border border-[#2d3748]">
                  <div className="text-[10px] text-rose-400">Courant i(t)</div>
                  <div className="font-mono font-bold text-rose-300 text-sm">
                    {(instantValues.i * 1000).toFixed(2)} mA
                  </div>
                </div>

                <div className="bg-[#1a202c] p-2 rounded-xl border border-[#2d3748]">
                  <div className="text-[10px] text-amber-400">Charge q(t)</div>
                  <div className="font-mono font-bold text-amber-300 text-sm">
                    {(instantValues.q * 1000).toFixed(2)} mC
                  </div>
                </div>

                <div className="bg-[#1a202c] p-2 rounded-xl border border-[#2d3748] col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-sky-400">Énergie ℰ_e</div>
                  <div className="font-mono font-bold text-sky-300 text-sm">
                    {instantValues.energy.toFixed(1)} mJ
                  </div>
                </div>
              </div>
            </div>

            {/* PANNEAU DROIT (4/12) : DEUX GALVANOMÈTRES À AIGUILLE & SCHÉMA DU CIRCUIT */}
            <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
              {/* CADRAN 1 : GALVANOMÈTRE DE COURANT (CENTRE ZÉRO) */}
              <div className="bg-[#1e1f20] p-3.5 rounded-2xl border border-[#282a2c] shadow-md">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#282a2c]">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-xs font-semibold text-white">Galvanomètre : Courant I (A)</span>
                  </div>
                  <span className="text-[11px] font-mono text-rose-400 font-bold">
                    {(meterCurrent * 1000).toFixed(1)} mA
                  </span>
                </div>

                {/* VISUEL SVG DU CADRAN À AIGUILLE */}
                <div className="relative flex justify-center py-2">
                  <svg viewBox="0 0 200 110" className="w-48 h-28 drop-shadow">
                    {/* Fond du cadran */}
                    <path
                      d="M 15 95 A 85 85 0 0 1 185 95 Z"
                      fill="#121824"
                      stroke="#334155"
                      strokeWidth="2"
                    />
                    {/* Arc gradué */}
                    <path
                      d="M 30 95 A 70 70 0 0 1 170 95"
                      fill="none"
                      stroke="#475569"
                      strokeWidth="1.5"
                    />

                    {/* Graduations principales (-20mA, -10mA, 0, +10mA, +20mA) */}
                    <line x1="30" y1="95" x2="22" y2="95" stroke="#ef4444" strokeWidth="2" />
                    <line x1="100" y1="25" x2="100" y2="18" stroke="#f8fafc" strokeWidth="2" />
                    <line x1="170" y1="95" x2="178" y2="95" stroke="#ef4444" strokeWidth="2" />

                    {/* Graduations intermédiaires */}
                    <line x1="51" y1="46" x2="45" y2="40" stroke="#94a3b8" strokeWidth="1.5" />
                    <line x1="149" y1="46" x2="155" y2="40" stroke="#94a3b8" strokeWidth="1.5" />

                    {/* Valeurs textuelles */}
                    <text x="100" y="38" textAnchor="middle" fill="#f8fafc" fontSize="9" fontWeight="bold">
                      0
                    </text>
                    <text x="35" y="85" textAnchor="middle" fill="#94a3b8" fontSize="8">
                      -{(maxMeterCurrent * 1000).toFixed(0)}
                    </text>
                    <text x="165" y="85" textAnchor="middle" fill="#94a3b8" fontSize="8">
                      +{(maxMeterCurrent * 1000).toFixed(0)}
                    </text>
                    <text x="100" y="60" textAnchor="middle" fill="#64748b" fontSize="8">
                      mA
                    </text>

                    {/* Aiguille mobile pivotante */}
                    <g
                      transform={`rotate(${currentAngleDeg}, 100, 95)`}
                      className="transition-transform duration-75 ease-out"
                    >
                      <line x1="100" y1="95" x2="100" y2="22" stroke="#ef4444" strokeWidth="2.2" />
                      <polygon points="100,16 97,25 103,25" fill="#ef4444" />
                    </g>
                    {/* Pivot central métallique */}
                    <circle cx="100" cy="95" r="5" fill="#e2e8f0" stroke="#0f172a" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              {/* CADRAN 2 : VOLTMÈTRE DU CONDENSATEUR */}
              <div className="bg-[#1e1f20] p-3.5 rounded-2xl border border-[#282a2c] shadow-md">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#282a2c]">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-semibold text-white">Voltmètre : Tension Uc (V)</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">
                    {meterVoltage.toFixed(2)} V
                  </span>
                </div>

                {/* VISUEL SVG DU CADRAN À AIGUILLE */}
                <div className="relative flex justify-center py-2">
                  <svg viewBox="0 0 200 110" className="w-48 h-28 drop-shadow">
                    {/* Fond du cadran */}
                    <path
                      d="M 15 95 A 85 85 0 0 1 185 95 Z"
                      fill="#121824"
                      stroke="#334155"
                      strokeWidth="2"
                    />
                    {/* Arc gradué */}
                    <path
                      d="M 30 95 A 70 70 0 0 1 170 95"
                      fill="none"
                      stroke="#475569"
                      strokeWidth="1.5"
                    />

                    {/* Graduations principales (0V à gauche, E/2 au centre, E à droite) */}
                    <line x1="30" y1="95" x2="22" y2="95" stroke="#22c55e" strokeWidth="2" />
                    <line x1="100" y1="25" x2="100" y2="18" stroke="#f8fafc" strokeWidth="2" />
                    <line x1="170" y1="95" x2="178" y2="95" stroke="#22c55e" strokeWidth="2" />

                    {/* Valeurs textuelles */}
                    <text x="35" y="85" textAnchor="middle" fill="#94a3b8" fontSize="8">
                      0V
                    </text>
                    <text x="100" y="38" textAnchor="middle" fill="#f8fafc" fontSize="9" fontWeight="bold">
                      {(E * 0.5).toFixed(1)}V
                    </text>
                    <text x="165" y="85" textAnchor="middle" fill="#94a3b8" fontSize="8">
                      {E.toFixed(1)}V
                    </text>
                    <text x="100" y="60" textAnchor="middle" fill="#64748b" fontSize="8">
                      Tension (V)
                    </text>

                    {/* Aiguille mobile pivotante (0V = -45°, E = +45°) */}
                    {(() => {
                      const vFraction = Math.min(Math.max(meterVoltage / E, 0), 1);
                      const voltAngle = -45 + vFraction * 90;
                      return (
                        <g
                          transform={`rotate(${voltAngle}, 100, 95)`}
                          className="transition-transform duration-75 ease-out"
                        >
                          <line x1="100" y1="95" x2="100" y2="22" stroke="#22c55e" strokeWidth="2.2" />
                          <polygon points="100,16 97,25 103,25" fill="#22c55e" />
                        </g>
                      );
                    })()}
                    {/* Pivot central */}
                    <circle cx="100" cy="95" r="5" fill="#e2e8f0" stroke="#0f172a" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              {/* SCHÉMA INTERACTIF DU CIRCUIT RC AVEC INTERRUPTEUR K */}
              <div className="bg-[#1e1f20] p-3.5 rounded-2xl border border-[#282a2c] shadow-md">
                <div className="flex items-center justify-between pb-2 border-b border-[#282a2c]">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Schéma du Circuit RC
                  </span>
                  <span className="text-[10px] text-[#8e918f]">Cliquez sur (1) ou (2)</span>
                </div>

                <div className="relative py-2 flex justify-center">
                  <svg viewBox="0 0 280 140" className="w-full max-w-[280px] h-32">
                    {/* Générateur E (gauche) */}
                    <line x1="30" y1="40" x2="30" y2="110" stroke="#64748b" strokeWidth="2" />
                    {/* Pôle + */}
                    <line x1="20" y1="65" x2="40" y2="65" stroke="#ef4444" strokeWidth="2.5" />
                    {/* Pôle - */}
                    <line x1="24" y1="85" x2="36" y2="85" stroke="#38bdf8" strokeWidth="2" />
                    <text x="14" y="62" fill="#ef4444" fontSize="10" fontWeight="bold">
                      +
                    </text>
                    <text x="14" y="93" fill="#38bdf8" fontSize="10" fontWeight="bold">
                      -
                    </text>
                    <text x="10" y="78" fill="#f8fafc" fontSize="10" fontWeight="bold">
                      E
                    </text>

                    {/* Ligne haute venant du générateur vers contact 1 */}
                    <line x1="30" y1="40" x2="80" y2="40" stroke="#64748b" strokeWidth="2" />

                    {/* Inverseur K (Point central pivot à x=110, y=70) */}
                    {/* Contact 1 (Charge) */}
                    <circle
                      cx="80"
                      cy="40"
                      r="4"
                      fill={switchPosition === 1 ? '#10b981' : '#334155'}
                      stroke="#10b981"
                      strokeWidth="1.5"
                      className="cursor-pointer hover:scale-125 transition"
                      onClick={() => toggleSwitch(1)}
                    />
                    <text
                      x="70"
                      y="32"
                      fill={switchPosition === 1 ? '#10b981' : '#94a3b8'}
                      fontSize="9"
                      fontWeight="bold"
                    >
                      (1)
                    </text>

                    {/* Contact 2 (Décharge) */}
                    <circle
                      cx="80"
                      cy="100"
                      r="4"
                      fill={switchPosition === 2 ? '#f59e0b' : '#334155'}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      className="cursor-pointer hover:scale-125 transition"
                      onClick={() => toggleSwitch(2)}
                    />
                    <text
                      x="70"
                      y="114"
                      fill={switchPosition === 2 ? '#f59e0b' : '#94a3b8'}
                      fontSize="9"
                      fontWeight="bold"
                    >
                      (2)
                    </text>

                    {/* Ligne basse de retour décharge */}
                    <line x1="80" y1="100" x2="80" y2="110" stroke="#64748b" strokeWidth="2" />

                    {/* Couteau de l'interrupteur K */}
                    <line
                      x1="120"
                      y1="70"
                      x2={switchPosition === 1 ? '82' : '82'}
                      y2={switchPosition === 1 ? '42' : '98'}
                      stroke="#f8fafc"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle cx="120" cy="70" r="3.5" fill="#f8fafc" />
                    <text x="108" y="62" fill="#f8fafc" fontSize="10" fontWeight="bold">
                      K
                    </text>

                    {/* Branche principale vers Conducteur ohmique R */}
                    <line x1="120" y1="70" x2="160" y2="70" stroke="#64748b" strokeWidth="2" />

                    {/* Résistance R */}
                    <rect
                      x="160"
                      y="60"
                      width="35"
                      height="20"
                      fill="#1e293b"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                    />
                    <text x="172" y="74" fill="#f8fafc" fontSize="9" fontWeight="bold">
                      R
                    </text>

                    <line x1="195" y1="70" x2="225" y2="70" stroke="#64748b" strokeWidth="2" />

                    {/* Condensateur C */}
                    <line x1="225" y1="52" x2="225" y2="88" stroke="#38bdf8" strokeWidth="2.5" />
                    <line x1="233" y1="52" x2="233" y2="88" stroke="#38bdf8" strokeWidth="2.5" />
                    <text x="240" y="74" fill="#38bdf8" fontSize="10" fontWeight="bold">
                      C
                    </text>

                    {/* Fil de retour commun vers le bas */}
                    <line x1="233" y1="70" x2="260" y2="70" stroke="#64748b" strokeWidth="2" />
                    <line x1="260" y1="70" x2="260" y2="110" stroke="#64748b" strokeWidth="2" />
                    <line x1="30" y1="110" x2="260" y2="110" stroke="#64748b" strokeWidth="2" />

                    {/* Flèche du sens du courant si i != 0 */}
                    {Math.abs(instantValues.i) > 0.0002 && (
                      <g className="animate-pulse">
                        <polygon
                          points={
                            instantValues.i > 0
                              ? '145,67 153,70 145,73' // vers la droite (charge)
                              : '153,67 145,70 153,73' // vers la gauche (décharge)
                          }
                          fill={instantValues.i > 0 ? '#ef4444' : '#f59e0b'}
                        />
                        <text
                          x="142"
                          y="56"
                          fill={instantValues.i > 0 ? '#ef4444' : '#f59e0b'}
                          fontSize="8"
                          fontWeight="bold"
                        >
                          i
                        </text>
                      </g>
                    )}
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION COMMANDES & RÉGLAGES DES PARAMÈTRES PHYSIQUES */}
          <div className="bg-[#1e1f20] p-4 sm:p-5 rounded-2xl border border-[#282a2c] space-y-4">
            {/* BARRE SUPÉRIEURE DE CONTRÔLE */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#282a2c]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                    isPlaying
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                  }`}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? 'Pause' : 'Reprendre'}
                </button>

                <button
                  onClick={handleReset}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[#282a2c] text-[#c4c7c5] hover:text-white hover:bg-[#34373a] transition flex items-center gap-1.5 border border-[#3c4043]"
                  title="Réinitialiser à t=0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Réinitialiser
                </button>
              </div>

              {/* SÉLECTEUR MANUEL OU AUTOMATIQUE DU COMMUTATEUR K */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8e918f] hidden sm:inline">Mode Interrupteur :</span>
                <div className="flex bg-[#121824] p-1 rounded-xl border border-[#2d3748] text-xs">
                  <button
                    onClick={() => {
                      setIsAutoCycle(false);
                      toggleSwitch(1);
                    }}
                    className={`px-3 py-1 rounded-lg transition font-medium ${
                      !isAutoCycle && switchPosition === 1
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-[#8e918f] hover:text-white'
                    }`}
                  >
                    (1) Charge
                  </button>
                  <button
                    onClick={() => {
                      setIsAutoCycle(false);
                      toggleSwitch(2);
                    }}
                    className={`px-3 py-1 rounded-lg transition font-medium ${
                      !isAutoCycle && switchPosition === 2
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-[#8e918f] hover:text-white'
                    }`}
                  >
                    (2) Décharge
                  </button>
                  <button
                    onClick={() => setIsAutoCycle(true)}
                    className={`px-3 py-1 rounded-lg transition font-medium ${
                      isAutoCycle
                        ? 'bg-rose-600 text-white shadow'
                        : 'text-[#8e918f] hover:text-white'
                    }`}
                  >
                    Auto-Cyclique (Vidéo)
                  </button>
                </div>
              </div>

              {/* Vitesse de simulation */}
              <div className="flex items-center gap-1.5 text-xs text-[#8e918f]">
                <Clock className="w-3.5 h-3.5" />
                <span>Vitesse :</span>
                {[0.5, 1.0, 2.0].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setSimSpeed(spd)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                      simSpeed === spd
                        ? 'bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30'
                        : 'bg-[#181a1b] text-[#8e918f] hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* CURSEURS DES PARAMÈTRES DU CIRCUIT (E, R, C) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
              {/* SLIDER E (Tension du générateur) */}
              <div className="space-y-1.5 bg-[#17191b] p-3 rounded-xl border border-[#282a2c]">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Tension E (Générateur)
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">{E.toFixed(1)} V</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="12"
                  step="0.5"
                  value={E}
                  onChange={(e) => setE(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-[#2d3748] rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#8e918f]">
                  <span>2.0 V</span>
                  <span>6.0 V (Vidéo)</span>
                  <span>12.0 V</span>
                </div>
              </div>

              {/* SLIDER R (Résistance) */}
              <div className="space-y-1.5 bg-[#17191b] p-3 rounded-xl border border-[#282a2c]">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    Résistance R (Conducteur)
                  </span>
                  <span className="font-mono text-rose-400 font-bold">{R} Ω</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  value={R}
                  onChange={(e) => setR(parseInt(e.target.value, 10))}
                  className="w-full accent-rose-500 h-1.5 bg-[#2d3748] rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#8e918f]">
                  <span>100 Ω</span>
                  <span>500 Ω (Vidéo)</span>
                  <span>2000 Ω</span>
                </div>
              </div>

              {/* SLIDER C (Capacité) */}
              <div className="space-y-1.5 bg-[#17191b] p-3 rounded-xl border border-[#282a2c]">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    Capacité C (Condensateur)
                  </span>
                  <span className="font-mono text-sky-400 font-bold">{C_uF} µF</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="3300"
                  step="100"
                  value={C_uF}
                  onChange={(e) => setC_uF(parseInt(e.target.value, 10))}
                  className="w-full accent-sky-500 h-1.5 bg-[#2d3748] rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#8e918f]">
                  <span>200 µF</span>
                  <span>1200 µF (Vidéo)</span>
                  <span>3300 µF</span>
                </div>
              </div>
            </div>

            {/* GRILLE DES RÉSULTATS THÉORIQUES DU BAC */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-[#131720] rounded-xl border border-[#222a38] text-xs">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-[#8e918f]">Constante de temps (τ = R·C)</div>
                  <div className="font-mono font-bold text-amber-300">
                    τ = {tau.toFixed(3)} s ({(tau * 1000).toFixed(0)} ms)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-[#8e918f]">Courant initial maximal (I₀ = E/R)</div>
                  <div className="font-mono font-bold text-rose-300">
                    I₀ = {(I0_max * 1000).toFixed(1)} mA ({I0_max.toFixed(4)} A)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-[#8e918f]">Durée du régime transitoire (5τ)</div>
                  <div className="font-mono font-bold text-emerald-300">
                    Δt_perm ≈ {(5 * tau).toFixed(2)} s (charge à 99.3%)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 2 : ÉQUATIONS DIFFÉRENTIELLES & DÉMONSTRATIONS BAC */}
      {activeTab === 'equations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* CARTE 1 : ÉQUATION DIFFÉRENTIELLE DE LA CHARGE */}
            <div className="bg-[#1e1f20] p-5 rounded-2xl border border-[#282a2c] space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#282a2c]">
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                <h3 className="font-bold text-white text-sm">1. Équation différentielle lors de la Charge</h3>
              </div>

              <div className="text-xs text-[#c4c7c5] space-y-3 leading-relaxed">
                <p>
                  En convention récepteur pour le condensateur et le conducteur ohmique, la loi d'additivité des
                  tensions s'écrit :
                </p>
                <div className="p-3 bg-[#131720] rounded-xl border border-[#222a38] text-center">
                  <MathView content="u_R(t) + u_C(t) = E" block />
                </div>

                <p>
                  D'après la loi d'Ohm, <MathView content="u_R = R \cdot i" /> et la relation fondamentale du
                  condensateur <MathView content="q = C \cdot u_C" /> avec <MathView content="i = \frac{dq}{dt} = C \frac{du_C}{dt}" />.
                  On obtient l'équation différentielle linéaire du 1er ordre :
                </p>

                <div className="p-3 bg-[#131720] rounded-xl border border-emerald-500/30 text-emerald-300 text-center">
                  <MathView content="RC \frac{du_C}{dt} + u_C(t) = E \iff \frac{du_C}{dt} + \frac{1}{\tau} u_C = \frac{E}{\tau}" block />
                </div>

                <h4 className="font-semibold text-white pt-2">Solution analytique :</h4>
                <div className="p-3 bg-[#131720] rounded-xl border border-[#222a38] text-center">
                  <MathView content="u_C(t) = E \left(1 - e^{-t/\tau}\right)" block />
                </div>

                <p>
                  L'intensité du courant en découle directement par dérivation :
                </p>
                <div className="p-3 bg-[#131720] rounded-xl border border-[#222a38] text-center text-rose-300">
                  <MathView content="i(t) = C \frac{du_C}{dt} = \frac{E}{R} e^{-t/\tau} = I_0 e^{-t/\tau}" block />
                </div>
              </div>
            </div>

            {/* CARTE 2 : ÉQUATION DIFFÉRENTIELLE DE LA DÉCHARGE */}
            <div className="bg-[#1e1f20] p-5 rounded-2xl border border-[#282a2c] space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#282a2c]">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <h3 className="font-bold text-white text-sm">2. Équation différentielle lors de la Décharge</h3>
              </div>

              <div className="text-xs text-[#c4c7c5] space-y-3 leading-relaxed">
                <p>
                  En basculant l'interrupteur en position (2), le générateur est exclu du circuit :
                </p>
                <div className="p-3 bg-[#131720] rounded-xl border border-[#222a38] text-center">
                  <MathView content="u_R(t) + u_C(t) = 0" block />
                </div>

                <p>
                  En remplaçant <MathView content="u_R = RC \frac{du_C}{dt}" />, on obtient l'équation sans second membre :
                </p>

                <div className="p-3 bg-[#131720] rounded-xl border border-amber-500/30 text-amber-300 text-center">
                  <MathView content="RC \frac{du_C}{dt} + u_C(t) = 0 \iff \frac{du_C}{dt} + \frac{1}{\tau} u_C = 0" block />
                </div>

                <h4 className="font-semibold text-white pt-2">Solution analytique :</h4>
                <div className="p-3 bg-[#131720] rounded-xl border border-[#222a38] text-center">
                  <MathView content="u_C(t) = E \cdot e^{-t/\tau}" block />
                </div>

                <p>
                  Expression de l'intensité du courant de décharge (le signe négatif explique la déviation à gauche sur le galvanomètre) :
                </p>
                <div className="p-3 bg-[#131720] rounded-xl border border-[#222a38] text-center text-rose-300">
                  <MathView content="i(t) = C \frac{du_C}{dt} = -\frac{E}{R} e^{-t/\tau} = -I_0 e^{-t/\tau}" block />
                </div>
              </div>
            </div>
          </div>

          {/* CARTE 3 : ANALYSE DIMENSIONNELLE DE TAU */}
          <div className="bg-[#1e1f20] p-5 rounded-2xl border border-[#282a2c] space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#282a2c]">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-white text-sm">3. Analyse dimensionnelle : Pourquoi τ = RC a la dimension d'un temps ?</h3>
            </div>

            <div className="text-xs text-[#c4c7c5] space-y-3 leading-relaxed">
              <p>
                Démontrer que <MathView content="\tau = R \cdot C" /> est homogène à un temps est une question classique et incontournable
                au Baccalauréat National :
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-[#131720] rounded-xl border border-[#222a38] space-y-2">
                  <div className="font-semibold text-white">Dimension de la résistance R :</div>
                  <MathView content="u_R = R \cdot i \implies [R] = \frac{[U]}{[I]}" block />
                </div>

                <div className="p-3 bg-[#131720] rounded-xl border border-[#222a38] space-y-2">
                  <div className="font-semibold text-white">Dimension de la capacité C :</div>
                  <MathView content="i = C \frac{du_C}{dt} \implies [C] = \frac{[I] \cdot [T]}{[U]}" block />
                </div>
              </div>

              <div className="p-4 bg-[#131720] rounded-xl border border-purple-500/30 text-center">
                <MathView content="[\tau] = [R] \times [C] = \frac{[U]}{[I]} \times \frac{[I] \cdot [T]}{[U]} = [T]" block />
                <p className="text-purple-300 font-semibold mt-2">
                  La constante de temps <MathView content="\tau" /> a donc bien la dimension d'une durée (seconde s dans le SI).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 3 : MÉTHODES DU NATIONAL & PIÈGES COURANTS */}
      {activeTab === 'course' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PIÈGE 1 : DISCONTINUITÉ DE i(t) VS CONTINUITÉ DE uC(t) */}
            <div className="bg-[#1e1f20] p-4 rounded-2xl border border-rose-500/30 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                Piège n°1 : Continuité de la tension vs Discontinuité du courant
              </div>
              <p className="text-xs text-[#c4c7c5] leading-relaxed">
                Le condensateur emmagasine de l'énergie sous forme électrostatique :
                <MathView content="\mathcal{E}_e = \frac{1}{2} C u_C^2" />. L'énergie ne pouvant varier instantanément (puissance infinie
                impossible), <strong>la tension u_C(t) est obligatoirement une fonction continue du temps :</strong>
                <MathView content="u_C(0^+) = u_C(0^-) = 0" />.
                En revanche, <strong>l'intensité du courant i(t) subit un saut brusque</strong> de 0 à <MathView content="I_0 = E/R" />
                à la fermeture de l'interrupteur !
              </p>
            </div>

            {/* PIÈGE 2 : TANGENTE À LA DÉCHARGE */}
            <div className="bg-[#1e1f20] p-4 rounded-2xl border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                Piège n°2 : Intersection de la tangente à la décharge
              </div>
              <p className="text-xs text-[#c4c7c5] leading-relaxed">
                À la charge, la tangente à l'origine à t=0 coupe <strong>l'asymptote horizontale u_C = E</strong> à l'instant <MathView content="t = \tau" />.
                Mais attention : <strong>à la décharge</strong>, l'asymptote est la droite <MathView content="u_C = 0" /> (l'axe des abscisses).
                La tangente à l'origine coupe donc <strong>l'axe des temps (u=0)</strong> exactement à <MathView content="t = \tau" /> !
              </p>
            </div>

            {/* MÉTHODE 1 : MÉTHODE DES 63% ET 37% */}
            <div className="bg-[#1e1f20] p-4 rounded-2xl border border-emerald-500/30 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                Méthode n°1 : Détermination de τ par la valeur 63% ou 37%
              </div>
              <p className="text-xs text-[#c4c7c5] leading-relaxed">
                À la charge : pour <MathView content="t = \tau" />, <MathView content="u_C(\tau) = E(1 - e^{-1}) \approx 0.632 \cdot E" />.
                Il suffit de calculer 0.632 × E, de repérer cette ordonnée sur la courbe, et de lire l'abscisse correspondante qui est τ.
                À la décharge : pour <MathView content="t = \tau" />, <MathView content="u_C(\tau) = E \cdot e^{-1} \approx 0.368 \cdot E" /> (37% de E).
              </p>
            </div>

            {/* MÉTHODE 2 : BILAN ÉNERGÉTIQUE ET RENDEMENT */}
            <div className="bg-[#1e1f20] p-4 rounded-2xl border border-sky-500/30 space-y-2">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                Méthode n°2 : Énergie fournie vs Énergie stockée
              </div>
              <p className="text-xs text-[#c4c7c5] leading-relaxed">
                Lors de la charge complète, le générateur fournit une énergie totale :
                <MathView content="\mathcal{E}_g = \int_0^\infty E \cdot i(t) dt = C \cdot E^2" />.
                L'énergie finale emmagasinée dans le condensateur est :
                <MathView content="\mathcal{E}_e = \frac{1}{2} C E^2" />.
                Exactement la moitié (<MathView content="50\%" />) de l'énergie fournie est toujours dissipée par effet Joule dans le conducteur ohmique !
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
