import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
  Clock,
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
  // --- Paramètres physiques du dipôle RC ---
  const [E, setE] = useState<number>(6.0); // Volts (comme dans la vidéo PASCO RC_2016_1.cap)
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

  // --- REFS pour synchronisation directe 60 FPS (Zero Lag, Zero Stutter) ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0);

  // Direct DOM refs pour aiguilles et affichages instantanés
  const needleCurrentRef = useRef<SVGGElement | null>(null);
  const needleVoltageRef = useRef<SVGGElement | null>(null);
  const textCurrentValRef = useRef<HTMLSpanElement | null>(null);
  const textVoltageValRef = useRef<HTMLSpanElement | null>(null);
  const boxTimeRef = useRef<HTMLDivElement | null>(null);
  const boxUcRef = useRef<HTMLDivElement | null>(null);
  const boxIRef = useRef<HTMLDivElement | null>(null);
  const boxQRef = useRef<HTMLDivElement | null>(null);
  const boxEnergyRef = useRef<HTMLDivElement | null>(null);

  // État physique continu (en refs pour éviter tout re-render intempestif)
  const simTimeRef = useRef<number>(0);
  const currentModeRef = useRef<'charge' | 'discharge'>('charge');
  const uC_startRef = useRef<number>(0);
  const t_switchRef = useRef<number>(0);
  const current_uCRef = useRef<number>(0);
  const current_iRef = useRef<number>(0);
  const historyRef = useRef<DataPoint[]>([]);

  // Refs de paramètres pour lecture instantanée dans la boucle
  const paramsRef = useRef({
    E,
    R,
    C_uF,
    isPlaying,
    simSpeed,
    isAutoCycle,
    showTangent,
    showTauLine,
    showAsymptote,
    showGrid,
  });

  useEffect(() => {
    paramsRef.current = {
      E,
      R,
      C_uF,
      isPlaying,
      simSpeed,
      isAutoCycle,
      showTangent,
      showTauLine,
      showAsymptote,
      showGrid,
    };
  }, [E, R, C_uF, isPlaying, simSpeed, isAutoCycle, showTangent, showTauLine, showAsymptote, showGrid]);

  // Constantes physiques
  const C_F = C_uF * 1e-6; // Farads
  const tau = R * C_F; // secondes (ex: 500 * 1200e-6 = 0.60 s)
  const I0_max = E / R; // Ampères (ex: 6 / 500 = 0.012 A = 12 mA)
  // Durée d'une demi-alternance : 5*tau + palier d'observation stable (comme dans la vidéo où chaque phase dure ~ 4.8s)
  const halfCycleDuration = Math.max(5 * tau + 1.8, 4.5);

  // Basculement manuel de l'interrupteur K
  const toggleSwitch = useCallback((newPos: 1 | 2) => {
    setSwitchPosition(newPos);
    currentModeRef.current = newPos === 1 ? 'charge' : 'discharge';
    uC_startRef.current = current_uCRef.current;
    t_switchRef.current = simTimeRef.current;
  }, []);

  // Réinitialiser la simulation (à t=0)
  const handleReset = useCallback(() => {
    simTimeRef.current = 0;
    currentModeRef.current = 'charge';
    setSwitchPosition(1);
    uC_startRef.current = 0;
    t_switchRef.current = 0;
    current_uCRef.current = 0;
    current_iRef.current = E / R;

    historyRef.current = [
      {
        t: 0,
        uC: 0,
        i: E / R,
        mode: 'charge',
      },
    ];

    // Mise à jour visuelle immédiate des aiguilles et compteurs
    updateMetersAndReadouts(0, 0, E / R);
  }, [E, R]);

  // Réinitialisation lors du changement des composants du circuit
  useEffect(() => {
    handleReset();
  }, [E, R, C_uF, handleReset]);

  // Synchronisation directe des aiguilles et des affichages
  const updateMetersAndReadouts = (t: number, uC: number, iVal: number) => {
    // 1. Galvanomètre de Courant :
    // Échelle : -0.020 A (-20 mA) à +0.020 A (+20 mA), ZÉRO AU CENTRE VERTICAL
    // Angle : -68° à +68°
    const maxI_scale = 0.020; // 20 mA comme sur le cadran PASCO
    const currentAngleDeg = Math.min(Math.max((iVal / maxI_scale) * 68, -75), 75);

    if (needleCurrentRef.current) {
      needleCurrentRef.current.setAttribute('transform', `rotate(${currentAngleDeg}, 100, 95)`);
    }
    if (textCurrentValRef.current) {
      textCurrentValRef.current.textContent = `${(iVal * 1000).toFixed(2)} mA`;
    }

    // 2. Voltmètre de Tension :
    // Échelle : -6 V à +6 V, ZÉRO AU CENTRE VERTICAL (comme dans la vidéo PASCO !)
    // Angle : -68° à +68°
    const maxV_scale = Math.max(paramsRef.current.E, 6.0);
    const voltAngleDeg = Math.min(Math.max((uC / maxV_scale) * 68, -75), 75);

    if (needleVoltageRef.current) {
      needleVoltageRef.current.setAttribute('transform', `rotate(${voltAngleDeg}, 100, 95)`);
    }
    if (textVoltageValRef.current) {
      textVoltageValRef.current.textContent = `${uC.toFixed(2)} V`;
    }

    // 3. Compteurs numériques d'état instantané
    if (boxTimeRef.current) boxTimeRef.current.textContent = `${t.toFixed(2)} s`;
    if (boxUcRef.current) boxUcRef.current.textContent = `${uC.toFixed(2)} V`;
    if (boxIRef.current) boxIRef.current.textContent = `${(iVal * 1000).toFixed(2)} mA`;
    if (boxQRef.current) boxQRef.current.textContent = `${(C_F * uC * 1000).toFixed(2)} mC`;
    if (boxEnergyRef.current) {
      boxEnergyRef.current.textContent = `${(0.5 * C_F * Math.pow(uC, 2) * 1000).toFixed(1)} mJ`;
    }
  };

  // BOUCLE D'ANIMATION PRINCIPALE (60 FPS SYNCHRONISÉE)
  useEffect(() => {
    let animActive = true;

    const tick = (timestamp: number) => {
      if (!animActive) return;

      if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;
      const realDt = Math.min((timestamp - lastTimestampRef.current) / 1000, 0.04);
      lastTimestampRef.current = timestamp;

      const p = paramsRef.current;

      if (p.isPlaying) {
        const simDt = realDt * p.simSpeed;
        simTimeRef.current += simDt;
        const t = simTimeRef.current;

        const currentTau = p.R * (p.C_uF * 1e-6);
        const currentHalfCycle = Math.max(5 * currentTau + 1.8, 4.5);

        // Mode Automatique (reproduction de la vidéo PASCO)
        if (p.isAutoCycle) {
          const cyclePeriod = 2 * currentHalfCycle;
          const phase = t % cyclePeriod;
          const shouldBeCharge = phase < currentHalfCycle;
          const targetMode: 'charge' | 'discharge' = shouldBeCharge ? 'charge' : 'discharge';

          if (targetMode !== currentModeRef.current) {
            currentModeRef.current = targetMode;
            setSwitchPosition(shouldBeCharge ? 1 : 2);
            uC_startRef.current = current_uCRef.current;
            t_switchRef.current = t;
          }
        }

        // Calcul analytique exact
        const dtSinceSwitch = Math.max(0, t - t_switchRef.current);
        const expFactor = Math.exp(-dtSinceSwitch / currentTau);

        let uC = 0;
        let iVal = 0;

        if (currentModeRef.current === 'charge') {
          // Charge : u_C tend vers E
          uC = p.E + (uC_startRef.current - p.E) * expFactor;
          iVal = ((p.E - uC_startRef.current) / p.R) * expFactor;
        } else {
          // Décharge : u_C tend vers 0
          uC = uC_startRef.current * expFactor;
          iVal = -(uC_startRef.current / p.R) * expFactor;
        }

        current_uCRef.current = uC;
        current_iRef.current = iVal;

        // Mise à jour de l'historique des points tracés
        const history = historyRef.current;
        const lastPt = history[history.length - 1];
        if (!lastPt || t - lastPt.t >= 0.015) {
          history.push({
            t,
            uC,
            i: iVal,
            mode: currentModeRef.current,
          });

          // Rognage propre après 45 secondes pour fluidité maximale
          if (history.length > 2500) {
            history.shift();
          }
        }

        // MISE À JOUR SYNCHRONE DES CADRANS ET AIGUILLES
        updateMetersAndReadouts(t, uC, iVal);
      }

      // Rendu Canvas
      renderCanvas();

      animFrameId.current = requestAnimationFrame(tick);
    };

    animFrameId.current = requestAnimationFrame(tick);

    return () => {
      animActive = false;
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, []);

  // RENDU DU CANVAS EXAO (COURBES I(t) ET Uc(t) SYNCHRONISÉES)
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

    const p = paramsRef.current;
    const currentTau = p.R * (p.C_uF * 1e-6);

    // Fond blanc/gris épuré comme le logiciel PASCO Capstone dans la vidéo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const paddingLeft = 58;
    const paddingRight = 24;
    const plotWidth = width - paddingLeft - paddingRight;

    const graphTopHeight = height * 0.44;
    const graphGap = 28;
    const graphBottomY = graphTopHeight + graphGap;
    const graphBottomHeight = height - graphBottomY - 32;

    // Fenêtre temporelle [0, tMax]
    const currentTime = simTimeRef.current;
    const windowSpan = Math.max(20, Math.ceil((currentTime + 2) / 4) * 4);
    const tMin = 0;
    const tMax = Math.max(windowSpan, 16);

    const timeToX = (t: number) => paddingLeft + ((t - tMin) / (tMax - tMin)) * plotWidth;

    // Échelle I(t) : -0.015 A à +0.015 A (ou dynamique selon E/R)
    const maxI_scale = Math.max(p.E / p.R * 1.25, 0.015);
    const zeroY_I = graphTopHeight / 2;
    const currentToY = (iVal: number) => zeroY_I - (iVal / maxI_scale) * (graphTopHeight * 0.43);

    // Échelle Uc(t) : 0 à E + marge
    const maxUc_scale = Math.max(p.E * 1.15, 6.5);
    const zeroY_Uc = graphBottomY + graphBottomHeight;
    const uCToY = (uVal: number) => zeroY_Uc - (uVal / maxUc_scale) * graphBottomHeight;

    // GRILLES DE L'INTERFACE EXAO
    if (p.showGrid) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;

      // Graduations de temps
      const timeStep = tMax <= 16 ? 2 : tMax <= 30 ? 2 : 4;
      for (let t = tMin; t <= tMax; t += timeStep) {
        const x = timeToX(t);
        ctx.beginPath();
        ctx.moveTo(x, 14);
        ctx.lineTo(x, graphTopHeight);
        ctx.moveTo(x, graphBottomY);
        ctx.lineTo(x, zeroY_Uc);
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${t}`, x, zeroY_Uc + 16);
      }

      // Grille I(t)
      [-maxI_scale * 0.8, 0, maxI_scale * 0.8].forEach((val) => {
        const y = currentToY(val);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(paddingLeft + plotWidth, y);
        ctx.stroke();
      });

      // Grille Uc(t)
      [p.E * 0.33, p.E * 0.67, p.E].forEach((val) => {
        const y = uCToY(val);
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(paddingLeft + plotWidth, y);
        ctx.stroke();
      });
    }

    // Axe ZÉRO pour I(t) (ligne noire bien visible comme dans PASCO)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, zeroY_I);
    ctx.lineTo(paddingLeft + plotWidth, zeroY_I);
    ctx.stroke();

    // Axe ZÉRO pour Uc(t)
    ctx.beginPath();
    ctx.moveTo(paddingLeft, zeroY_Uc);
    ctx.lineTo(paddingLeft + plotWidth, zeroY_Uc);
    ctx.stroke();

    // Cadres extérieurs
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(paddingLeft, 14, plotWidth, graphTopHeight - 14);
    ctx.strokeRect(paddingLeft, graphBottomY, plotWidth, graphBottomHeight);

    // Labels des axes
    ctx.fillStyle = '#334155';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';

    // Valeurs I(t)
    ctx.fillText(`+${(maxI_scale * 0.8).toFixed(2)}`, paddingLeft - 8, currentToY(maxI_scale * 0.8) + 4);
    ctx.fillText('0,00', paddingLeft - 8, zeroY_I + 4);
    ctx.fillText(`-${(maxI_scale * 0.8).toFixed(2)}`, paddingLeft - 8, currentToY(-maxI_scale * 0.8) + 4);

    // Titre Voie 1 : Courant (A) avec carré rouge Exp1
    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Courant (A) — Exp1  [I = f(t)]', paddingLeft + 12, 28);

    // Valeurs Uc(t)
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'right';
    ctx.fillText(`${p.E.toFixed(1)}`, paddingLeft - 8, uCToY(p.E) + 4);
    ctx.fillText('0', paddingLeft - 8, zeroY_Uc + 4);

    // Titre Voie 2 : Tension (V) avec losange vert Exp1
    ctx.fillStyle = '#15803d';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Tension (V) — Exp1  [Uc = f(t)]', paddingLeft + 12, graphBottomY + 18);

    // Label horizontal Temps (s)
    ctx.fillStyle = '#1e293b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Temps (s)', paddingLeft + plotWidth / 2, zeroY_Uc + 28);
    ctx.fillText('Temps (s)', paddingLeft + plotWidth / 2, graphTopHeight + 18);

    // Asymptote horizontale uC = E
    if (p.showAsymptote) {
      const yAsymptote = uCToY(p.E);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, yAsymptote);
      ctx.lineTo(paddingLeft + plotWidth, yAsymptote);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#0284c7';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Asymptote E = ${p.E.toFixed(1)} V`, paddingLeft + plotWidth - 10, yAsymptote - 4);
    }

    // OUTILS BAC : TANGENTE À L'ORIGINE & MÉTHODE DES 63% / 37%
    const history = historyRef.current;
    if (history.length > 0) {
      let lastSwitchIdx = 0;
      for (let k = history.length - 1; k > 0; k--) {
        if (history[k].mode !== history[k - 1].mode) {
          lastSwitchIdx = k;
          break;
        }
      }

      const switchPt = history[lastSwitchIdx];
      const isCharging = switchPt.mode === 'charge';
      const t0 = switchPt.t;
      const tTau = t0 + currentTau;

      // 1. Tangente à l'origine
      if (p.showTangent && tTau <= tMax) {
        const x0 = timeToX(t0);
        const xTau = timeToX(tTau);

        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 3]);

        if (isCharging) {
          const y0 = uCToY(0);
          const yTau = uCToY(p.E);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(xTau, yTau);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.fillStyle = '#ca8a04';
          ctx.beginPath();
          ctx.arc(xTau, yTau, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(`(t₀+τ, E)`, xTau + 6, yTau - 6);
        } else {
          const y0 = uCToY(p.E);
          const yTau = uCToY(0);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(xTau, yTau);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.fillStyle = '#ca8a04';
          ctx.beginPath();
          ctx.arc(xTau, yTau, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(`(t₀+τ, 0)`, xTau + 6, yTau - 6);
        }
        ctx.setLineDash([]);
      }

      // 2. Méthode 63% / 37%
      if (p.showTauLine && tTau <= tMax) {
        const xTau = timeToX(tTau);
        const uTauValue = isCharging ? 0.632 * p.E : 0.368 * p.E;
        const yTauVal = uCToY(uTauValue);

        ctx.strokeStyle = '#9333ea';
        ctx.lineWidth = 1.3;
        ctx.setLineDash([3, 3]);

        ctx.beginPath();
        ctx.moveTo(xTau, graphBottomY);
        ctx.lineTo(xTau, zeroY_Uc);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(paddingLeft, yTauVal);
        ctx.lineTo(xTau, yTauVal);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#9333ea';
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

    // TRACÉ DES DEUX COURBES SYNCHRONISÉES
    if (history.length > 1) {
      // 1. Courbe I(t) Rouge
      ctx.beginPath();
      ctx.strokeStyle = '#dc2626';
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

      // 2. Courbe Uc(t) Verte
      ctx.beginPath();
      ctx.strokeStyle = '#16a34a';
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

      // Points traceurs de lecture actuels
      const lastPoint = history[history.length - 1];
      const headX = timeToX(lastPoint.t);
      const headY_I = currentToY(lastPoint.i);
      const headY_Uc = uCToY(lastPoint.uC);

      // Tête I(t)
      ctx.fillStyle = 'rgba(220, 38, 38, 0.3)';
      ctx.beginPath();
      ctx.arc(headX, headY_I, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(headX, headY_I, 4, 0, Math.PI * 2);
      ctx.fill();

      // Tête Uc(t)
      ctx.fillStyle = 'rgba(22, 163, 74, 0.3)';
      ctx.beginPath();
      ctx.arc(headX, headY_Uc, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(headX, headY_Uc, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Curseur de mesure Interactif
    if (hoverData) {
      const hX = timeToX(hoverData.t);
      if (hX >= paddingLeft && hX <= paddingLeft + plotWidth) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);

        ctx.beginPath();
        ctx.moveTo(hX, 14);
        ctx.lineTo(hX, zeroY_Uc);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fillRect(hX + 8, graphTopHeight - 32, 136, 62);
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(hX + 8, graphTopHeight - 32, 136, 62);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`t  = ${hoverData.t.toFixed(3)} s`, hX + 14, graphTopHeight - 16);
        ctx.fillStyle = '#f87171';
        ctx.fillText(`i  = ${(hoverData.i * 1000).toFixed(2)} mA`, hX + 14, graphTopHeight - 2);
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`Uc = ${hoverData.uC.toFixed(2)} V`, hX + 14, graphTopHeight + 12);
      }
    }

    ctx.restore();
  };

  // Gestion du survol souris
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const paddingLeft = 58;
    const paddingRight = 24;
    const plotWidth = canvas.clientWidth - paddingLeft - paddingRight;
    const currentTime = simTimeRef.current;
    const windowSpan = Math.max(20, Math.ceil((currentTime + 2) / 4) * 4);
    const tMax = Math.max(windowSpan, 16);

    if (mouseX >= paddingLeft && mouseX <= paddingLeft + plotWidth) {
      const tHover = ((mouseX - paddingLeft) / plotWidth) * tMax;
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

  return (
    <div className="space-y-6 text-[#e3e3e3]">
      {/* HEADER AVEC TITRE ET BADGE D'ÉTAT */}
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
            synchronisation frame-par-frame des courbes <span className="text-rose-400 font-mono font-medium">i(t)</span> et{' '}
            <span className="text-emerald-400 font-mono font-medium">u_C(t)</span> avec les deux galvanomètres à aiguille
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

      {/* ONGLET 1 : STATION EXAO */}
      {activeTab === 'lab' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* PANNEAU GAUCHE : ÉCRAN D'ACQUISITION EXAO */}
            <div className="lg:col-span-8 bg-[#131720] p-4 rounded-2xl border border-[#282a2c] flex flex-col space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#222a38]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-xs font-bold text-white tracking-wide uppercase">
                    Graphique d'Acquisition Synchronisée (Interface ExAO)
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
              <div className="relative w-full h-[400px] sm:h-[440px] rounded-xl overflow-hidden border border-[#cbd5e1] bg-white shadow-inner">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-crosshair block"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                />
              </div>

              {/* VALEURS INSTANTANÉES SYNCHRONISÉES EN DIRECT */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-center text-xs">
                <div className="bg-[#1a202c] p-2 rounded-xl border border-[#2d3748]">
                  <div className="text-[10px] text-[#8e918f]">Temps écoulé</div>
                  <div ref={boxTimeRef} className="font-mono font-bold text-white text-sm">
                    0.00 s
                  </div>
                </div>

                <div className="bg-[#1a202c] p-2 rounded-xl border border-[#2d3748]">
                  <div className="text-[10px] text-emerald-400">Tension u_C(t)</div>
                  <div ref={boxUcRef} className="font-mono font-bold text-emerald-300 text-sm">
                    0.00 V
                  </div>
                </div>

                <div className="bg-[#1a202c] p-2 rounded-xl border border-[#2d3748]">
                  <div className="text-[10px] text-rose-400">Courant i(t)</div>
                  <div ref={boxIRef} className="font-mono font-bold text-rose-300 text-sm">
                    {(I0_max * 1000).toFixed(2)} mA
                  </div>
                </div>

                <div className="bg-[#1a202c] p-2 rounded-xl border border-[#2d3748]">
                  <div className="text-[10px] text-amber-400">Charge q(t)</div>
                  <div ref={boxQRef} className="font-mono font-bold text-amber-300 text-sm">
                    0.00 mC
                  </div>
                </div>

                <div className="bg-[#1a202c] p-2 rounded-xl border border-[#2d3748] col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-sky-400">Énergie ℰ_e</div>
                  <div ref={boxEnergyRef} className="font-mono font-bold text-sky-300 text-sm">
                    0.0 mJ
                  </div>
                </div>
              </div>
            </div>

            {/* PANNEAU DROIT : LES DEUX GALVANOMÈTRES IDENTIQUES À LA VIDÉO PASCO */}
            <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
              {/* CADRAN 1 : COURANT (A) — AIGUILLE ROUGE, ZÉRO AU CENTRE */}
              <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-300 shadow-lg text-slate-900">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-red-600 rounded-sm" />
                    <span className="text-xs font-bold text-slate-800 tracking-tight">
                      Courant (A) — Exp1
                    </span>
                  </div>
                  <span ref={textCurrentValRef} className="text-xs font-mono font-bold text-red-600">
                    0.00 mA
                  </span>
                </div>

                {/* VISUEL SVG DU GALVANOMÈTRE STYLE PASCO CAPSTONE */}
                <div className="relative flex justify-center py-1">
                  <svg viewBox="0 0 200 115" className="w-52 h-32">
                    {/* Fond blanc du cadran */}
                    <rect x="0" y="0" width="200" height="115" fill="#ffffff" rx="6" />

                    {/* Arc gradué principal */}
                    <path
                      d="M 22 95 A 80 80 0 0 1 178 95"
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="1.8"
                    />

                    {/* Graduation centrale ZÉRO */}
                    <line x1="100" y1="20" x2="100" y2="12" stroke="#0f172a" strokeWidth="2.5" />
                    <text x="100" y="32" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">
                      0
                    </text>

                    {/* Graduations positives droite (+0.004, +0.008, +0.012, +0.016, +0.020) */}
                    <line x1="126" y1="27" x2="130" y2="21" stroke="#0f172a" strokeWidth="1.6" />
                    <text x="127" y="37" textAnchor="middle" fill="#334155" fontSize="6.5">
                      0.004
                    </text>

                    <line x1="149" y1="46" x2="155" y2="42" stroke="#0f172a" strokeWidth="1.6" />
                    <text x="146" y="55" textAnchor="middle" fill="#334155" fontSize="6.5">
                      0.008
                    </text>

                    <line x1="166" y1="71" x2="173" y2="69" stroke="#0f172a" strokeWidth="1.6" />
                    <text x="162" y="78" textAnchor="middle" fill="#334155" fontSize="6.5">
                      0.012
                    </text>

                    <line x1="174" y1="88" x2="182" y2="88" stroke="#0f172a" strokeWidth="1.6" />
                    <text x="166" y="94" textAnchor="middle" fill="#334155" fontSize="6.5">
                      0.016
                    </text>

                    <line x1="178" y1="95" x2="186" y2="95" stroke="#0f172a" strokeWidth="2" />
                    <text x="175" y="105" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="bold">
                      0.020
                    </text>

                    {/* Graduations négatives gauche (-0.004, -0.008, -0.012, -0.016, -0.020) */}
                    <line x1="74" y1="27" x2="70" y2="21" stroke="#0f172a" strokeWidth="1.6" />
                    <text x="73" y="37" textAnchor="middle" fill="#334155" fontSize="6.5">
                      -0.004
                    </text>

                    <line x1="51" y1="46" x2="45" y2="42" stroke="#0f172a" strokeWidth="1.6" />
                    <text x="54" y="55" textAnchor="middle" fill="#334155" fontSize="6.5">
                      -0.008
                    </text>

                    <line x1="34" y1="71" x2="27" y2="69" stroke="#0f172a" strokeWidth="1.6" />
                    <text x="38" y="78" textAnchor="middle" fill="#334155" fontSize="6.5">
                      -0.012
                    </text>

                    <line x1="26" y1="88" x2="18" y2="88" stroke="#0f172a" strokeWidth="1.6" />
                    <text x="34" y="94" textAnchor="middle" fill="#334155" fontSize="6.5">
                      -0.016
                    </text>

                    <line x1="22" y1="95" x2="14" y2="95" stroke="#0f172a" strokeWidth="2" />
                    <text x="25" y="105" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="bold">
                      -0.020
                    </text>

                    {/* Graduation mineures (ticks fins) */}
                    {[
                      -60, -52, -45, -37, -30, -22, -15, -7, 7, 15, 22, 30, 37, 45, 52, 60,
                    ].map((ang) => {
                      const rad = (ang * Math.PI) / 180;
                      const x1 = 100 + 77 * Math.sin(rad);
                      const y1 = 95 - 77 * Math.cos(rad);
                      const x2 = 100 + 80 * Math.sin(rad);
                      const y2 = 95 - 80 * Math.cos(rad);
                      return (
                        <line
                          key={ang}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="#64748b"
                          strokeWidth="1"
                        />
                      );
                    })}

                    {/* Symbole de l'unité A au pivot */}
                    <text x="100" y="112" textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="bold">
                      A
                    </text>

                    {/* Aiguille mobile pivotante Rouge (mise à jour directe par ref) */}
                    <g ref={needleCurrentRef} transform="rotate(0, 100, 95)">
                      <line x1="100" y1="95" x2="100" y2="18" stroke="#dc2626" strokeWidth="2.4" />
                      <polygon points="100,12 97.5,20 102.5,20" fill="#dc2626" />
                    </g>
                    {/* Pivot noir central */}
                    <circle cx="100" cy="95" r="4.5" fill="#0f172a" />
                  </svg>
                </div>
              </div>

              {/* CADRAN 2 : TENSION (V) — AIGUILLE VERTE, ZÉRO AU CENTRE VERTICAL */}
              <div className="bg-white p-3.5 rounded-2xl border-2 border-slate-300 shadow-lg text-slate-900">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-emerald-600 rotate-45 rounded-xs" />
                    <span className="text-xs font-bold text-slate-800 tracking-tight">
                      Tension (V) — Exp1
                    </span>
                  </div>
                  <span ref={textVoltageValRef} className="text-xs font-mono font-bold text-emerald-600">
                    0.00 V
                  </span>
                </div>

                {/* VISUEL SVG DU VOLTMÈTRE IDENTIQUE À LA VIDÉO PASCO */}
                <div className="relative flex justify-center py-1">
                  <svg viewBox="0 0 200 115" className="w-52 h-32">
                    {/* Fond blanc du cadran */}
                    <rect x="0" y="0" width="200" height="115" fill="#ffffff" rx="6" />

                    {/* Arc gradué principal */}
                    <path
                      d="M 22 95 A 80 80 0 0 1 178 95"
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="1.8"
                    />

                    {/* ZÉRO CENTRAL (12h) */}
                    <line x1="100" y1="20" x2="100" y2="12" stroke="#0f172a" strokeWidth="2.5" />
                    <text x="100" y="32" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold">
                      0
                    </text>

                    {/* Côté positif droit : +2, +4, +6 V */}
                    <line x1="130" y1="28" x2="134" y2="22" stroke="#0f172a" strokeWidth="2" />
                    <text x="127" y="42" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
                      2
                    </text>

                    <line x1="156" y1="52" x2="162" y2="48" stroke="#0f172a" strokeWidth="2" />
                    <text x="148" y="63" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
                      4
                    </text>

                    <line x1="174" y1="84" x2="182" y2="82" stroke="#0f172a" strokeWidth="2.5" />
                    <text x="164" y="93" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
                      6
                    </text>

                    {/* Côté négatif gauche : -2, -4, -6 V */}
                    <line x1="70" y1="28" x2="66" y2="22" stroke="#0f172a" strokeWidth="2" />
                    <text x="73" y="42" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
                      -2
                    </text>

                    <line x1="44" y1="52" x2="38" y2="48" stroke="#0f172a" strokeWidth="2" />
                    <text x="52" y="63" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
                      -4
                    </text>

                    <line x1="26" y1="84" x2="18" y2="82" stroke="#0f172a" strokeWidth="2.5" />
                    <text x="36" y="93" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="bold">
                      -6
                    </text>

                    {/* Graduations mineures intermédiaires (1V, 3V, 5V) */}
                    {[-57, -34, -11, 11, 34, 57].map((ang) => {
                      const rad = (ang * Math.PI) / 180;
                      const x1 = 100 + 77 * Math.sin(rad);
                      const y1 = 95 - 77 * Math.cos(rad);
                      const x2 = 100 + 80 * Math.sin(rad);
                      const y2 = 95 - 80 * Math.cos(rad);
                      return (
                        <line
                          key={ang}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="#64748b"
                          strokeWidth="1.2"
                        />
                      );
                    })}

                    {/* Symbole V au pivot */}
                    <text x="100" y="112" textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="bold">
                      V
                    </text>

                    {/* Aiguille mobile pivotante Verte (mise à jour directe par ref) */}
                    <g ref={needleVoltageRef} transform="rotate(0, 100, 95)">
                      <line x1="100" y1="95" x2="100" y2="18" stroke="#16a34a" strokeWidth="2.4" />
                      <polygon points="100,12 97.5,20 102.5,20" fill="#16a34a" />
                    </g>
                    {/* Pivot noir central */}
                    <circle cx="100" cy="95" r="4.5" fill="#0f172a" />
                  </svg>
                </div>
              </div>

              {/* SCHÉMA INTERACTIF DU CIRCUIT RC */}
              <div className="bg-[#1e1f20] p-3.5 rounded-2xl border border-[#282a2c] shadow-md">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#282a2c]">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Schéma du Circuit RC
                  </span>
                  <span className="text-[10px] text-[#8e918f]">Cliquez sur (1) ou (2)</span>
                </div>

                <div className="relative py-1 flex justify-center">
                  <svg viewBox="0 0 280 135" className="w-full max-w-[280px] h-32">
                    {/* Générateur E */}
                    <line x1="30" y1="35" x2="30" y2="105" stroke="#64748b" strokeWidth="2" />
                    <line x1="20" y1="60" x2="40" y2="60" stroke="#ef4444" strokeWidth="2.5" />
                    <line x1="24" y1="80" x2="36" y2="80" stroke="#38bdf8" strokeWidth="2" />
                    <text x="14" y="58" fill="#ef4444" fontSize="10" fontWeight="bold">
                      +
                    </text>
                    <text x="14" y="88" fill="#38bdf8" fontSize="10" fontWeight="bold">
                      -
                    </text>
                    <text x="10" y="73" fill="#f8fafc" fontSize="10" fontWeight="bold">
                      E
                    </text>

                    {/* Branche vers contact 1 */}
                    <line x1="30" y1="35" x2="80" y2="35" stroke="#64748b" strokeWidth="2" />

                    {/* Contact 1 (Charge) */}
                    <circle
                      cx="80"
                      cy="35"
                      r="4.5"
                      fill={switchPosition === 1 ? '#10b981' : '#334155'}
                      stroke="#10b981"
                      strokeWidth="1.5"
                      className="cursor-pointer hover:scale-125 transition"
                      onClick={() => toggleSwitch(1)}
                    />
                    <text
                      x="70"
                      y="27"
                      fill={switchPosition === 1 ? '#10b981' : '#94a3b8'}
                      fontSize="9"
                      fontWeight="bold"
                    >
                      (1)
                    </text>

                    {/* Contact 2 (Décharge) */}
                    <circle
                      cx="80"
                      cy="95"
                      r="4.5"
                      fill={switchPosition === 2 ? '#f59e0b' : '#334155'}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      className="cursor-pointer hover:scale-125 transition"
                      onClick={() => toggleSwitch(2)}
                    />
                    <text
                      x="70"
                      y="110"
                      fill={switchPosition === 2 ? '#f59e0b' : '#94a3b8'}
                      fontSize="9"
                      fontWeight="bold"
                    >
                      (2)
                    </text>

                    {/* Ligne basse retour décharge */}
                    <line x1="80" y1="95" x2="80" y2="105" stroke="#64748b" strokeWidth="2" />

                    {/* Couteau de l'interrupteur K */}
                    <line
                      x1="120"
                      y1="65"
                      x2={switchPosition === 1 ? '82' : '82'}
                      y2={switchPosition === 1 ? '37' : '93'}
                      stroke="#f8fafc"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle cx="120" cy="65" r="3.5" fill="#f8fafc" />
                    <text x="108" y="58" fill="#f8fafc" fontSize="10" fontWeight="bold">
                      K
                    </text>

                    {/* Branche vers R */}
                    <line x1="120" y1="65" x2="160" y2="65" stroke="#64748b" strokeWidth="2" />

                    {/* Résistance R */}
                    <rect
                      x="160"
                      y="55"
                      width="35"
                      height="20"
                      fill="#1e293b"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                    />
                    <text x="172" y="69" fill="#f8fafc" fontSize="9" fontWeight="bold">
                      R
                    </text>

                    <line x1="195" y1="65" x2="225" y2="65" stroke="#64748b" strokeWidth="2" />

                    {/* Condensateur C */}
                    <line x1="225" y1="48" x2="225" y2="82" stroke="#38bdf8" strokeWidth="2.5" />
                    <line x1="233" y1="48" x2="233" y2="82" stroke="#38bdf8" strokeWidth="2.5" />
                    <text x="240" y="69" fill="#38bdf8" fontSize="10" fontWeight="bold">
                      C
                    </text>

                    {/* Ligne commune de retour */}
                    <line x1="233" y1="65" x2="260" y2="65" stroke="#64748b" strokeWidth="2" />
                    <line x1="260" y1="65" x2="260" y2="105" stroke="#64748b" strokeWidth="2" />
                    <line x1="30" y1="105" x2="260" y2="105" stroke="#64748b" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION COMMANDES & RÉGLAGES DES PARAMÈTRES PHYSIQUES */}
          <div className="bg-[#1e1f20] p-4 sm:p-5 rounded-2xl border border-[#282a2c] space-y-4">
            {/* BARRE DE CONTRÔLE */}
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

              {/* SÉLECTEUR MANUEL / AUTO DU COMMUTATEUR K */}
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
                    Auto-Cyclique (Vidéo PASCO)
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

            {/* CURSEURS DES PARAMÈTRES (E, R, C) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
              {/* SLIDER E */}
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

              {/* SLIDER R */}
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

              {/* SLIDER C */}
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

            {/* GRILLE DES RÉSULTATS THÉORIQUES */}
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
                  <div className="text-[10px] text-[#8e918f]">Régime permanent atteint (5τ)</div>
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
            {/* CARTE 1 : CHARGE */}
            <div className="bg-[#1e1f20] p-5 rounded-2xl border border-[#282a2c] space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#282a2c]">
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                <h3 className="font-bold text-white text-sm">1. Équation différentielle lors de la Charge</h3>
              </div>

              <div className="text-xs text-[#c4c7c5] space-y-3 leading-relaxed">
                <p>
                  En convention récepteur, la loi d'additivité des tensions s'écrit :
                </p>
                <div className="p-3 bg-[#131720] rounded-xl border border-[#222a38] text-center">
                  <MathView content="u_R(t) + u_C(t) = E" block />
                </div>

                <p>
                  Avec <MathView content="u_R = R \cdot i" /> et <MathView content="i = C \frac{du_C}{dt}" />, on obtient :
                </p>

                <div className="p-3 bg-[#131720] rounded-xl border border-emerald-500/30 text-emerald-300 text-center">
                  <MathView content="RC \frac{du_C}{dt} + u_C(t) = E \iff \frac{du_C}{dt} + \frac{1}{\tau} u_C = \frac{E}{\tau}" block />
                </div>

                <h4 className="font-semibold text-white pt-2">Solution analytique :</h4>
                <div className="p-3 bg-[#131720] rounded-xl border border-[#222a38] text-center">
                  <MathView content="u_C(t) = E \left(1 - e^{-t/\tau}\right)" block />
                </div>

                <p>
                  Intensité du courant par dérivation :
                </p>
                <div className="p-3 bg-[#131720] rounded-xl border border-[#222a38] text-center text-rose-300">
                  <MathView content="i(t) = C \frac{du_C}{dt} = \frac{E}{R} e^{-t/\tau} = I_0 e^{-t/\tau}" block />
                </div>
              </div>
            </div>

            {/* CARTE 2 : DÉCHARGE */}
            <div className="bg-[#1e1f20] p-5 rounded-2xl border border-[#282a2c] space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#282a2c]">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <h3 className="font-bold text-white text-sm">2. Équation différentielle lors de la Décharge</h3>
              </div>

              <div className="text-xs text-[#c4c7c5] space-y-3 leading-relaxed">
                <p>
                  En position (2), le générateur est exclu du circuit :
                </p>
                <div className="p-3 bg-[#131720] rounded-xl border border-[#222a38] text-center">
                  <MathView content="u_R(t) + u_C(t) = 0" block />
                </div>

                <p>
                  D'où l'équation sans second membre :
                </p>

                <div className="p-3 bg-[#131720] rounded-xl border border-amber-500/30 text-amber-300 text-center">
                  <MathView content="RC \frac{du_C}{dt} + u_C(t) = 0 \iff \frac{du_C}{dt} + \frac{1}{\tau} u_C = 0" block />
                </div>

                <h4 className="font-semibold text-white pt-2">Solution analytique :</h4>
                <div className="p-3 bg-[#131720] rounded-xl border border-[#222a38] text-center">
                  <MathView content="u_C(t) = E \cdot e^{-t/\tau}" block />
                </div>

                <p>
                  Intensité du courant de décharge (le signe négatif explique la déviation à gauche sur le galvanomètre) :
                </p>
                <div className="p-3 bg-[#131720] rounded-xl border border-[#222a38] text-center text-rose-300">
                  <MathView content="i(t) = C \frac{du_C}{dt} = -\frac{E}{R} e^{-t/\tau} = -I_0 e^{-t/\tau}" block />
                </div>
              </div>
            </div>
          </div>

          {/* CARTE 3 : ANALYSE DIMENSIONNELLE */}
          <div className="bg-[#1e1f20] p-5 rounded-2xl border border-[#282a2c] space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#282a2c]">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-white text-sm">3. Analyse dimensionnelle de τ = RC</h3>
            </div>

            <div className="text-xs text-[#c4c7c5] space-y-3 leading-relaxed">
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

      {/* ONGLET 3 : MÉTHODES ET PIÈGES BAC */}
      {activeTab === 'course' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1e1f20] p-4 rounded-2xl border border-rose-500/30 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                Piège n°1 : Continuité de la tension vs Discontinuité du courant
              </div>
              <p className="text-xs text-[#c4c7c5] leading-relaxed">
                Le condensateur emmagasine de l'énergie : <MathView content="\mathcal{E}_e = \frac{1}{2} C u_C^2" />. L'énergie ne pouvant varier instantanément, <strong>la tension u_C(t) est obligatoirement continue :</strong> <MathView content="u_C(0^+) = u_C(0^-) = 0" />.
                En revanche, <strong>l'intensité du courant i(t) subit un saut brusque</strong> de 0 à <MathView content="I_0 = E/R" /> (à la charge) ou de 0 à <MathView content="-I_0" /> (à la décharge) !
              </p>
            </div>

            <div className="bg-[#1e1f20] p-4 rounded-2xl border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                Piège n°2 : Intersection de la tangente à la décharge
              </div>
              <p className="text-xs text-[#c4c7c5] leading-relaxed">
                À la charge, la tangente à l'origine à t=0 coupe <strong>l'asymptote horizontale u_C = E</strong> à l'instant <MathView content="t = \tau" />.
                À la décharge, l'asymptote est la droite <MathView content="u_C = 0" />.
                La tangente à l'origine coupe donc <strong>l'axe des abscisses (u=0)</strong> exactement à <MathView content="t = \tau" /> !
              </p>
            </div>

            <div className="bg-[#1e1f20] p-4 rounded-2xl border border-emerald-500/30 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                Méthode n°1 : Détermination de τ par la valeur 63% ou 37%
              </div>
              <p className="text-xs text-[#c4c7c5] leading-relaxed">
                À la charge : pour <MathView content="t = \tau" />, <MathView content="u_C(\tau) = E(1 - e^{-1}) \approx 0.632 \cdot E" />.
                À la décharge : pour <MathView content="t = \tau" />, <MathView content="u_C(\tau) = E \cdot e^{-1} \approx 0.368 \cdot E" /> (37% de E).
              </p>
            </div>

            <div className="bg-[#1e1f20] p-4 rounded-2xl border border-sky-500/30 space-y-2">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                Méthode n°2 : Énergie fournie vs Énergie stockée
              </div>
              <p className="text-xs text-[#c4c7c5] leading-relaxed">
                Lors de la charge complète, le générateur fournit : <MathView content="\mathcal{E}_g = C \cdot E^2" />.
                L'énergie finale emmagasinée dans le condensateur est : <MathView content="\mathcal{E}_e = \frac{1}{2} C E^2" />.
                Exactement la moitié (<MathView content="50\%" />) de l'énergie fournie est dissipée sous forme de chaleur par effet Joule dans le conducteur ohmique.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
