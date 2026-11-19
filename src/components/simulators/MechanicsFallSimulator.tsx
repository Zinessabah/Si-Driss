import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Compass,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Sparkles,
  Info,
  HelpCircle,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ArrowDown,
  Layers,
  Droplet,
} from 'lucide-react';
import { MathView } from '../MathView';

// Helper for nice round axis graduations
function getNiceTicks(maxVal: number, targetTicks = 5): { step: number; ticks: number[]; maxTick: number } {
  if (maxVal <= 0 || !isFinite(maxVal)) return { step: 1, ticks: [0, 1], maxTick: 1 };
  const rawStep = maxVal / targetTicks;
  const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const fraction = rawStep / power;
  let niceFraction = 1;
  if (fraction < 1.5) niceFraction = 1;
  else if (fraction < 3) niceFraction = 2;
  else if (fraction < 7) niceFraction = 5;
  else niceFraction = 10;
  const step = niceFraction * power;
  const ceilMax = Math.ceil((maxVal - 1e-9) / step) * step;
  const ticks: number[] = [];
  for (let val = 0; val <= ceilMax + step * 0.001; val += step) {
    ticks.push(Number(val.toFixed(4)));
  }
  return { step, ticks, maxTick: ticks[ticks.length - 1] || ceilMax };
}

interface SavedCurve {
  mass: number;
  radius: number;
  fluidDensity: number;
  kFriction: number;
  frictionPower: 1 | 2;
  A: number;
  B: number;
  v_lim: number;
  tau: number;
}

export const MechanicsFallSimulator: React.FC = () => {
  // --- Paramètres physiques ---
  const [mass, setMass] = useState<number>(25); // g
  const [radius, setRadius] = useState<number>(1.0); // cm
  const [fluidDensity, setFluidDensity] = useState<number>(900); // kg/m³
  const [kFriction, setKFriction] = useState<number>(0.12); // kg/s ou kg/m
  const [frictionPower, setFrictionPower] = useState<1 | 2>(1); // n = 1 (linéaire) ou n = 2 (quadratique)

  // --- Affichage & échelle du graphe ---
  const [scaleMode, setScaleMode] = useState<'calibrated' | 'auto'>('calibrated');
  const [showEulerOnGraph, setShowEulerOnGraph] = useState<boolean>(false);
  const [eulerDtMs, setEulerDtMs] = useState<number>(20); // ms
  const [referenceCurve, setReferenceCurve] = useState<SavedCurve | null>(null);

  // --- Contrôles de simulation animée (Éprouvette & Curseur) ---
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [activeTab, setActiveTab] = useState<'euler' | 'course'>('euler');

  // Refs pour les Canvas et boucle d'animation
  const tubeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const graphCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const simTimeRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);

  // Constante de gravitation
  const g = 9.80;

  // Calculs physiques fondamentaux (Unités SI)
  const m_kg = mass * 1e-3;
  const r_m = radius * 1e-2;
  const volume = (4 / 3) * Math.PI * Math.pow(r_m, 3); // m³
  const solidDensity = volume > 0 ? m_kg / volume : 0; // kg/m³

  // Forces à l'origine (t = 0)
  const weight = m_kg * g; // N
  const buoyantForce = fluidDensity * volume * g; // N
  const archimedeRatio = m_kg > 0 ? (fluidDensity * volume) / m_kg : 0;
  const isFloating = solidDensity <= fluidDensity;

  // Constantes de l'équation différentielle : dv/dt = A - B * v^n
  // A = g * (1 - (rho_f * V) / m) = a_0 (accélération initiale)
  const A = Math.max(0.05, g * (1 - archimedeRatio));
  // B = k / m
  const B = kFriction / m_kg;

  // Vitesse limite et temps caractéristique
  const v_lim = frictionPower === 1 ? A / B : Math.sqrt(A / B);
  const tau = frictionPower === 1 ? 1 / B : v_lim / A;

  // Durée totale d'observation dans le graphe
  const totalObsTime = Math.max(1.2, 5.5 * tau);

  // Position et vitesse analytiques exactes à l'instant t
  const getTheoreticalState = (t: number) => {
    if (t <= 0) return { v: 0, z: 0, a: A };
    let v = 0;
    let z = 0;
    let a = 0;

    if (frictionPower === 1) {
      // Régime linéaire : v(t) = v_lim * (1 - exp(-t / tau))
      const expTerm = Math.exp(-t / tau);
      v = v_lim * (1 - expTerm);
      z = v_lim * (t - tau * (1 - expTerm));
      a = A * expTerm;
    } else {
      // Régime quadratique : v(t) = v_lim * tanh(t / tau)
      const th = Math.tanh(t / tau);
      v = v_lim * th;
      z = v_lim * tau * Math.log(Math.cosh(t / tau));
      a = A * (1 - th * th);
    }
    return { v, z, a };
  };

  // Tableau interactif de la méthode d'Euler (Bac Marocain)
  const eulerStepsData = useMemo(() => {
    const dt = eulerDtMs * 1e-3;
    const steps: Array<{
      i: number;
      t: number;
      vEuler: number;
      vTh: number;
      aEuler: number;
      errorPct: number;
    }> = [];

    let currentVEuler = 0;
    const maxSteps = 8;

    for (let i = 0; i <= maxSteps; i++) {
      const t = i * dt;
      const th = getTheoreticalState(t);
      const aEuler = Math.max(0, A - B * Math.pow(currentVEuler, frictionPower));
      const errorPct = th.v > 0.01 ? (Math.abs(currentVEuler - th.v) / th.v) * 100 : 0;

      steps.push({
        i,
        t,
        vEuler: currentVEuler,
        vTh: th.v,
        aEuler,
        errorPct,
      });

      // Itération d'Euler : v_{i+1} = v_i + a_i * dt
      currentVEuler = currentVEuler + aEuler * dt;
    }
    return steps;
  }, [A, B, frictionPower, eulerDtMs, v_lim, tau]);

  // Points d'Euler pour superposition sur le graphe
  const eulerPointsForGraph = useMemo(() => {
    if (!showEulerOnGraph) return [];
    const dt = eulerDtMs * 1e-3;
    const points: Array<{ t: number; v: number }> = [];
    let currentV = 0;
    const count = Math.min(60, Math.ceil(totalObsTime / dt));

    for (let i = 0; i <= count; i++) {
      const t = i * dt;
      points.push({ t, v: currentV });
      const a = Math.max(0, A - B * Math.pow(currentV, frictionPower));
      currentV = currentV + a * dt;
    }
    return points;
  }, [showEulerOnGraph, eulerDtMs, totalObsTime, A, B, frictionPower]);

  // Mémoriser la courbe actuelle comme courbe témoin de référence
  const handleSaveReference = () => {
    if (referenceCurve) {
      setReferenceCurve(null);
    } else {
      setReferenceCurve({
        mass,
        radius,
        fluidDensity,
        kFriction,
        frictionPower,
        A,
        B,
        v_lim,
        tau,
      });
    }
  };

  // Réinitialiser les paramètres
  const handleResetParams = () => {
    setMass(25);
    setRadius(1.0);
    setFluidDensity(900);
    setKFriction(0.12);
    setFrictionPower(1);
    simTimeRef.current = 0;
  };

  // Réinitialiser le temps d'animation
  const handleResetSimulation = () => {
    simTimeRef.current = 0;
  };

  // Boucle d'animation principale (synchronisation éprouvette & graphe)
  useEffect(() => {
    let isSubscribed = true;

    const renderLoop = (now: number) => {
      if (!isSubscribed) return;

      if (!lastTimestampRef.current) {
        lastTimestampRef.current = now;
      }
      const dtReal = (now - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = now;

      if (isPlaying) {
        simTimeRef.current += Math.min(dtReal, 0.05) * simSpeed;
        // Boucle souple : réinitialiser après 5 * tau ou quand la bille atteint le fond (1.0 m)
        const currentState = getTheoreticalState(simTimeRef.current);
        if (currentState.z >= 1.05 || simTimeRef.current > Math.max(2.5, 6 * tau)) {
          // Pause brève en bas avant de recommencer
          if (simTimeRef.current > Math.max(2.5, 6 * tau) + 0.8) {
            simTimeRef.current = 0;
          }
        }
      }

      const tCurrent = simTimeRef.current;
      const { v: vCurrent, z: zCurrent, a: aCurrent } = getTheoreticalState(tCurrent);

      // =======================================================================
      // 1. DESSIN DU TUBE D'ÉPROUVETTE (Canvas 1)
      // =======================================================================
      const tubeCanvas = tubeCanvasRef.current;
      if (tubeCanvas) {
        const ctx = tubeCanvas.getContext('2d');
        if (ctx) {
          const width = tubeCanvas.width;
          const height = tubeCanvas.height;

          ctx.fillStyle = '#090d16';
          ctx.fillRect(0, 0, width, height);

          // Tube cylindrique gradué
          const tubeLeft = 45;
          const tubeWidth = 65;
          const tubeTop = 30;
          const tubeHeight = height - 60;
          const tubeBottom = tubeTop + tubeHeight;

          // Dégradé de fond du fluide
          let fluidGrad = ctx.createLinearGradient(tubeLeft, 0, tubeLeft + tubeWidth, 0);
          if (fluidDensity >= 1200) {
            // Glycérol (translucide bleuté dense)
            fluidGrad.addColorStop(0, 'rgba(30, 41, 59, 0.85)');
            fluidGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.22)');
            fluidGrad.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
          } else if (fluidDensity >= 950) {
            // Eau / liquide clair
            fluidGrad.addColorStop(0, 'rgba(14, 116, 144, 0.3)');
            fluidGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.25)');
            fluidGrad.addColorStop(1, 'rgba(8, 51, 68, 0.4)');
          } else {
            // Huile végétale (ambre doré)
            fluidGrad.addColorStop(0, 'rgba(217, 119, 6, 0.25)');
            fluidGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.32)');
            fluidGrad.addColorStop(1, 'rgba(180, 83, 9, 0.35)');
          }

          ctx.fillStyle = fluidGrad;
          ctx.fillRect(tubeLeft, tubeTop, tubeWidth, tubeHeight);

          // Parois de verre du tube
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(tubeLeft, tubeTop - 10);
          ctx.lineTo(tubeLeft, tubeBottom);
          ctx.lineTo(tubeLeft + tubeWidth, tubeBottom);
          ctx.lineTo(tubeLeft + tubeWidth, tubeTop - 10);
          ctx.stroke();

          // Menisque supérieur du liquide
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(tubeLeft + tubeWidth / 2, tubeTop, tubeWidth / 2, 4, 0, 0, 2 * Math.PI);
          ctx.stroke();

          // Graduations du tube (0 cm à 100 cm = 1.0 m)
          ctx.font = '10px "Fira Code", monospace';
          ctx.fillStyle = '#94a3b8';
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
          ctx.lineWidth = 1;

          for (let cm = 0; cm <= 100; cm += 10) {
            const yGrad = tubeTop + (cm / 100) * tubeHeight;
            const isMajor = cm % 20 === 0;
            const gradLen = isMajor ? 12 : 6;

            ctx.beginPath();
            ctx.moveTo(tubeLeft - gradLen, yGrad);
            ctx.lineTo(tubeLeft, yGrad);
            ctx.stroke();

            if (isMajor) {
              ctx.fillText(`${cm}`, tubeLeft - 32, yGrad + 3);
            }
          }

          // Unité de la graduation
          ctx.fillStyle = '#64748b';
          ctx.fillText('cm', tubeLeft - 30, tubeTop - 8);

          // Position de la bille (profondeur z bornée à 1.0 m)
          const clampedZ = Math.min(1.0, Math.max(0, zCurrent));
          const ballRadiusPx = Math.max(7, Math.min(16, radius * 8));
          const ballX = tubeLeft + tubeWidth / 2;
          const ballY = tubeTop + (clampedZ / 1.0) * (tubeHeight - ballRadiusPx);

          // Dessin de la bille (métallique brillante avec reflet)
          const ballGrad = ctx.createRadialGradient(
            ballX - ballRadiusPx * 0.35,
            ballY - ballRadiusPx * 0.35,
            1,
            ballX,
            ballY,
            ballRadiusPx
          );
          ballGrad.addColorStop(0, '#f8fafc');
          ballGrad.addColorStop(0.3, '#94a3b8');
          ballGrad.addColorStop(0.8, '#334155');
          ballGrad.addColorStop(1, '#0f172a');

          ctx.fillStyle = ballGrad;
          ctx.beginPath();
          ctx.arc(ballX, ballY, ballRadiusPx, 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Centre de gravité G
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ballX, ballY, 2, 0, 2 * Math.PI);
          ctx.fill();

          // ===================================================================
          // VECTEURS FORCES SUR LA BILLE : Poids P, Archimède FA, Frottement f
          // ===================================================================
          const forceScale = 220; // pixels par Newton
          const lenP = Math.min(75, Math.max(18, weight * forceScale));
          const lenFA = Math.min(lenP, buoyantForce * forceScale);
          const currentFriction = kFriction * Math.pow(vCurrent, frictionPower);
          const lenF = Math.min(80, currentFriction * forceScale);

          // Fonction utilitaire pour tracer une flèche vectorielle
          const drawArrow = (
            fromX: number,
            fromY: number,
            toX: number,
            toY: number,
            color: string,
            label: string
          ) => {
            const headLen = 7;
            const angle = Math.atan2(toY - fromY, toX - fromX);

            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.lineWidth = 2.2;

            ctx.beginPath();
            ctx.moveTo(fromX, fromY);
            ctx.lineTo(toX, toY);
            ctx.stroke();

            // Flèche
            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(
              toX - headLen * Math.cos(angle - Math.PI / 6),
              toY - headLen * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              toX - headLen * Math.cos(angle + Math.PI / 6),
              toY - headLen * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();

            // Label vectoriel
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(label, toX + 6, toY + (toY > fromY ? 4 : -2));
          };

          // 1. Poids P (descendant en rouge)
          drawArrow(ballX, ballY, ballX, ballY + lenP, '#ef4444', 'P');

          // 2. Poussée d'Archimède FA (ascendant en cyan, décalé à gauche)
          if (lenFA > 2) {
            drawArrow(ballX - 4, ballY, ballX - 4, ballY - lenFA, '#06b6d4', 'FA');
          }

          // 3. Force de frottement f (ascendant en orange, décalé à droite)
          if (lenF > 2) {
            drawArrow(ballX + 4, ballY, ballX + 4, ballY - lenF, '#f59e0b', 'f');
          }

          // Statut visuel sous le tube
          ctx.font = '10px "Fira Code", monospace';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(`z = ${(clampedZ * 100).toFixed(1)} cm`, tubeLeft + 6, height - 12);
        }
      }

      // =======================================================================
      // 2. DESSIN DU GRAPHE DE LA VITESSE v(t) (Canvas 2)
      // =======================================================================
      const graphCanvas = graphCanvasRef.current;
      if (graphCanvas) {
        const ctx = graphCanvas.getContext('2d');
        if (ctx) {
          const width = graphCanvas.width;
          const height = graphCanvas.height;

          // Fond sombre oscilloscope
          ctx.fillStyle = '#090d16';
          ctx.fillRect(0, 0, width, height);

          // Marges et repère
          const originX = 55;
          const originY = height - 42;
          const plotWidth = width - originX - 35;
          const plotHeight = originY - 32;

          // Choix de l'échelle max en temps et en vitesse
          let maxTime = 1.20;
          let maxV = 3.50;

          if (scaleMode === 'calibrated') {
            // Échelle fixe étalonnée (si v_lim ou tau dépasse, on étend proprement)
            maxTime = Math.max(1.20, Math.ceil((5 * tau) / 0.5) * 0.5);
            maxV = Math.max(3.50, Math.ceil((v_lim * 1.2) / 0.5) * 0.5);
          } else {
            // Échelle auto-adaptative ajustée aux paramètres actuels
            maxTime = Math.max(0.4, 5.2 * tau);
            maxV = Math.max(0.8, v_lim * 1.35);
          }

          // Graduations intelligentes
          const tTicksInfo = getNiceTicks(maxTime, 6);
          const vTicksInfo = getNiceTicks(maxV, 5);
          const actualMaxTime = tTicksInfo.maxTick;
          const actualMaxV = vTicksInfo.maxTick;

          // Grille secondaire (quadrillage de mesure)
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1;

          // Lignes verticales (temps)
          for (const tVal of tTicksInfo.ticks) {
            const x = originX + (tVal / actualMaxTime) * plotWidth;
            ctx.beginPath();
            ctx.moveTo(x, originY);
            ctx.lineTo(x, originY - plotHeight);
            ctx.stroke();
          }

          // Lignes horizontales (vitesse)
          for (const vVal of vTicksInfo.ticks) {
            const y = originY - (vVal / actualMaxV) * plotHeight;
            ctx.beginPath();
            ctx.moveTo(originX, y);
            ctx.lineTo(originX + plotWidth, y);
            ctx.stroke();
          }

          // Zone du régime transitoire (0 à 5*tau) vs permanent (> 5*tau)
          const x5Tau = originX + ((5 * tau) / actualMaxTime) * plotWidth;
          if (x5Tau <= originX + plotWidth) {
            // Fond légèrement bleuté pour le régime transitoire
            ctx.fillStyle = 'rgba(56, 189, 248, 0.04)';
            ctx.fillRect(originX, originY - plotHeight, x5Tau - originX, plotHeight);

            // Fond légèrement émeraude pour le régime permanent
            ctx.fillStyle = 'rgba(16, 185, 129, 0.04)';
            ctx.fillRect(x5Tau, originY - plotHeight, originX + plotWidth - x5Tau, plotHeight);

            // Ligne séparatrice 5*tau
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x5Tau, originY);
            ctx.lineTo(x5Tau, originY - plotHeight);
            ctx.stroke();
            ctx.setLineDash([]);

            // Labels des régimes
            ctx.font = '10px "Fira Code", monospace';
            ctx.fillStyle = '#38bdf8';
            ctx.fillText('Régime transitoire', originX + 10, originY - plotHeight + 14);
            ctx.fillStyle = '#34d399';
            ctx.fillText('Régime permanent', x5Tau + 8, originY - plotHeight + 14);
          }

          // Axes principaux
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(originX, originY - plotHeight - 10);
          ctx.lineTo(originX, originY);
          ctx.lineTo(originX + plotWidth + 15, originY);
          ctx.stroke();

          // Flèches des axes
          // Axe des ordonnées
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.moveTo(originX, originY - plotHeight - 15);
          ctx.lineTo(originX - 4, originY - plotHeight - 8);
          ctx.lineTo(originX + 4, originY - plotHeight - 8);
          ctx.closePath();
          ctx.fill();

          // Axe des abscisses
          ctx.beginPath();
          ctx.moveTo(originX + plotWidth + 20, originY);
          ctx.lineTo(originX + plotWidth + 12, originY - 4);
          ctx.lineTo(originX + plotWidth + 12, originY + 4);
          ctx.closePath();
          ctx.fill();

          // Nombres gradués sur l'axe du temps (t)
          ctx.font = '10px "Fira Code", monospace';
          ctx.fillStyle = '#94a3b8';
          for (const tVal of tTicksInfo.ticks) {
            const x = originX + (tVal / actualMaxTime) * plotWidth;
            ctx.beginPath();
            ctx.moveTo(x, originY);
            ctx.lineTo(x, originY + 5);
            ctx.stroke();
            ctx.fillText(tVal.toString(), x - 6, originY + 18);
          }

          // Nombres gradués sur l'axe de vitesse (v)
          for (const vVal of vTicksInfo.ticks) {
            const y = originY - (vVal / actualMaxV) * plotHeight;
            ctx.beginPath();
            ctx.moveTo(originX - 5, y);
            ctx.lineTo(originX, y);
            ctx.stroke();
            ctx.fillText(vVal.toString(), originX - 32, y + 3);
          }

          // Labels des axes
          ctx.font = '11px sans-serif';
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText('Temps t (s)', originX + plotWidth - 30, originY + 34);
          ctx.fillText('v (m/s)', originX - 42, originY - plotHeight - 12);

          // ===================================================================
          // COURBE TÉMOIN DE RÉFÉRENCE (si enregistrée)
          // ===================================================================
          if (referenceCurve) {
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = '#c084fc'; // Violet
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            const refSteps = 200;
            for (let i = 0; i <= refSteps; i++) {
              const t = (i / refSteps) * actualMaxTime;
              let vRef = 0;
              if (referenceCurve.frictionPower === 1) {
                vRef = referenceCurve.v_lim * (1 - Math.exp(-t / referenceCurve.tau));
              } else {
                vRef = referenceCurve.v_lim * Math.tanh(t / referenceCurve.tau);
              }
              const x = originX + (t / actualMaxTime) * plotWidth;
              const y = originY - (vRef / actualMaxV) * plotHeight;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // ===================================================================
          // ASYMPTOTE HORIZONTALE v_lim (Vert pointillé)
          // ===================================================================
          const yVlim = originY - (v_lim / actualMaxV) * plotHeight;
          if (yVlim >= originY - plotHeight) {
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = '#10b981'; // Émeraude
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(originX, yVlim);
            ctx.lineTo(originX + plotWidth, yVlim);
            ctx.stroke();

            // Label de l'asymptote
            ctx.font = 'bold 11px "Fira Code", monospace';
            ctx.fillStyle = '#10b981';
            ctx.fillText(
              `v_lim = ${v_lim.toFixed(2)} m/s`,
              originX + plotWidth - 140,
              yVlim - 6
            );
          }

          // ===================================================================
          // TANGENTE À L'ORIGINE t = 0 (Rouge / Rose pointillé)
          // Pente = a_0 = A. Intersection avec v_lim à t = tau !
          // ===================================================================
          const xTau = originX + (tau / actualMaxTime) * plotWidth;
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = '#f43f5e'; // Rose-rouge
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(originX, originY);

          // Prolongement de la tangente au-delà de tau
          const tangentExtendTime = Math.min(actualMaxTime, tau * 1.3);
          const tangentEndX = originX + (tangentExtendTime / actualMaxTime) * plotWidth;
          const tangentEndY = originY - ((A * tangentExtendTime) / actualMaxV) * plotHeight;
          ctx.lineTo(tangentEndX, tangentEndY);
          ctx.stroke();

          // Projection verticale du temps caractéristique tau (Ambre pointillé)
          if (xTau <= originX + plotWidth && yVlim >= originY - plotHeight) {
            ctx.strokeStyle = '#f59e0b'; // Ambre
            ctx.beginPath();
            ctx.moveTo(xTau, originY);
            ctx.lineTo(xTau, yVlim);
            ctx.stroke();

            // Point d'intersection (tau, v_lim)
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(xTau, yVlim, 3.5, 0, 2 * Math.PI);
            ctx.fill();

            // Point sur la courbe à t = tau (63% de v_lim en linéaire)
            const vAtTau = frictionPower === 1 ? v_lim * (1 - Math.exp(-1)) : v_lim * Math.tanh(1);
            const yAtTau = originY - (vAtTau / actualMaxV) * plotHeight;
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(xTau, yAtTau, 3.5, 0, 2 * Math.PI);
            ctx.fill();

            // Graduation et label tau sur l'axe temporel
            ctx.font = 'bold 10px "Fira Code", monospace';
            ctx.fillStyle = '#f59e0b';
            ctx.fillText(`τ = ${(tau * 1000).toFixed(0)} ms`, xTau - 28, originY - 8);
          }
          ctx.setLineDash([]);

          // ===================================================================
          // TRACÉ DE LA COURBE THÉORIQUE PRINCIPALE v(t) (Bleu Cyan lumineux)
          // ===================================================================
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          const curveSteps = 300;
          for (let i = 0; i <= curveSteps; i++) {
            const t = (i / curveSteps) * actualMaxTime;
            const state = getTheoreticalState(t);
            const x = originX + (t / actualMaxTime) * plotWidth;
            const y = originY - (state.v / actualMaxV) * plotHeight;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // ===================================================================
          // POINTS DE LA MÉTHODE D'EULER (si activés)
          // ===================================================================
          if (showEulerOnGraph && eulerPointsForGraph.length > 0) {
            ctx.strokeStyle = '#eab308'; // Jaune
            ctx.fillStyle = '#facc15';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            for (let i = 0; i < eulerPointsForGraph.length; i++) {
              const pt = eulerPointsForGraph[i];
              const x = originX + (pt.t / actualMaxTime) * plotWidth;
              const y = originY - (pt.v / actualMaxV) * plotHeight;
              if (x > originX + plotWidth) break;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Marqueurs circulaires pour chaque étape d'Euler
            for (let i = 0; i < eulerPointsForGraph.length; i++) {
              const pt = eulerPointsForGraph[i];
              const x = originX + (pt.t / actualMaxTime) * plotWidth;
              const y = originY - (pt.v / actualMaxV) * plotHeight;
              if (x > originX + plotWidth) break;
              ctx.beginPath();
              ctx.arc(x, y, 3, 0, 2 * Math.PI);
              ctx.fill();
            }
          }

          // ===================================================================
          // CURSEUR DYNAMIQUE EN TEMPS RÉEL (Point lumineux synchronisé)
          // ===================================================================
          if (tCurrent <= actualMaxTime) {
            const cursorX = originX + (tCurrent / actualMaxTime) * plotWidth;
            const cursorY = originY - (vCurrent / actualMaxV) * plotHeight;

            // Halo pulsant
            ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.beginPath();
            ctx.arc(cursorX, cursorY, 8, 0, 2 * Math.PI);
            ctx.fill();

            // Point central brillant
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cursorX, cursorY, 3.5, 0, 2 * Math.PI);
            ctx.fill();

            // Info-bulle à côté du curseur
            ctx.font = '10px "Fira Code", monospace';
            ctx.fillStyle = '#38bdf8';
            ctx.fillText(
              `t = ${tCurrent.toFixed(2)}s | v = ${vCurrent.toFixed(2)} m/s`,
              cursorX + 8,
              cursorY - 8
            );
          }
        }
      }

      if (isSubscribed) {
        animFrameId.current = requestAnimationFrame(renderLoop);
      }
    };

    animFrameId.current = requestAnimationFrame(renderLoop);

    return () => {
      isSubscribed = false;
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [
    mass,
    radius,
    fluidDensity,
    kFriction,
    frictionPower,
    scaleMode,
    isPlaying,
    simSpeed,
    showEulerOnGraph,
    eulerDtMs,
    referenceCurve,
    A,
    B,
    v_lim,
    tau,
    weight,
    buoyantForce,
    totalObsTime,
  ]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-5">
      {/* =====================================================================
          EN-TÊTE : Titre et Sélecteur de Régime de Frottement
      ====================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
              <Compass className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Laboratoire Mécanique : Chute Verticale dans un Fluide
              </h3>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>Équation différentielle :</span>
                <MathView content="$\frac{\mathrm{d}v}{\mathrm{d}t} = A - B \cdot v^n$" />
                <span>• Vitesse limite</span>
                <MathView content="$v_{\mathrm{lim}}$" />
                <span>• Méthode d'Euler</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sélecteur frottement linéaire (v) vs quadratique (v²) */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setFrictionPower(1)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              frictionPower === 1
                ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Frottement linéaire :</span>
            <MathView content="$f = k \cdot v$" />
          </button>
          <button
            onClick={() => setFrictionPower(2)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              frictionPower === 2
                ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Frottement quadratique :</span>
            <MathView content="$f = k \cdot v^2$" />
          </button>
        </div>
      </div>

      {/* Alerte si la bille flotte (densité trop faible) */}
      {isFloating && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            <MathView
              content={`Remarque physique : Avec ce rayon ($r = ${radius}$ cm) et cette masse ($m = ${mass}$ g), la masse volumique de la bille ($\\rho_s = ${Math.round(solidDensity)}$ kg/m³) est inférieure à celle du fluide ($\\rho_f = ${fluidDensity}$ kg/m³). La bille flotterait dans la réalité car $F_A > P$.`}
            />
          </span>
        </div>
      )}

      {/* =====================================================================
          ZONE PRINCIPALE DE SIMULATION : Éprouvette (Gauche) & Graphe v(t) (Droite)
      ====================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* --- Colonne Gauche (4 cols) : ÉPROUVETTE DE CHUTE --- */}
        <div className="lg:col-span-4 bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Éprouvette de chute (100 cm)
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {fluidDensity === 900 ? 'Huile' : fluidDensity >= 1200 ? 'Glycérol' : 'Eau'}
              </span>
            </div>

            {/* Canvas du tube cylindrique */}
            <div className="flex justify-center bg-slate-900/40 rounded-lg p-1 border border-slate-800/50">
              <canvas
                ref={tubeCanvasRef}
                width={160}
                height={300}
                className="w-40 h-72 block rounded"
              />
            </div>
          </div>

          {/* Contrôles d'animation sous le tube */}
          <div className="mt-3 space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between gap-1.5">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isPlaying ? 'Pause' : 'Reprendre'}
              </button>
              <button
                onClick={handleResetSimulation}
                title="Repartir de t = 0"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSimSpeed(simSpeed === 1 ? 0.5 : simSpeed === 0.5 ? 2 : 1)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono font-bold transition-all"
                title="Vitesse de simulation"
              >
                {simSpeed}x
              </button>
            </div>

            {/* Légende des 3 vecteurs forces */}
            <div className="flex items-center justify-around text-[10px] text-slate-400 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/60">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                <MathView content="$\\vec{P}$" />
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
                <MathView content="$\\vec{F}_A$" />
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <MathView content="$\\vec{f}$" />
              </span>
            </div>
          </div>
        </div>

        {/* --- Colonne Droite (8 cols) : GRAPHE DE LA VITESSE v(t) --- */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div>
            {/* Barre de contrôle du graphe */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 mb-2.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-white tracking-wide">
                  Graphe de vitesse <MathView content="$v(t)$" /> & Détermination Graphique
                </span>
              </div>

              {/* Boutons d'échelle & Courbe témoin */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveReference}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                    referenceCurve
                      ? 'bg-purple-950/60 border-purple-500 text-purple-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                  title="Figer la courbe actuelle en violet pour la comparer aux modifications"
                >
                  {referenceCurve ? '✓ Témoin actif' : '📸 Mémoriser témoin'}
                </button>

                <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                  <button
                    onClick={() => setScaleMode('calibrated')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      scaleMode === 'calibrated'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Échelle fixe
                  </button>
                  <button
                    onClick={() => setScaleMode('auto')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                      scaleMode === 'auto'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Auto-zoom
                  </button>
                </div>
              </div>
            </div>

            {/* Canvas de la courbe v(t) */}
            <div className="relative rounded-lg overflow-hidden border border-slate-800/80 bg-slate-900/60">
              <canvas
                ref={graphCanvasRef}
                width={620}
                height={280}
                className="w-full h-64 sm:h-72 block"
              />
            </div>
          </div>

          {/* Légende détaillée du graphe */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-sky-400 rounded-full" />
                <MathView content="Courbe $v(t)$" />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-emerald-400" />
                <span>Asymptote</span>
                <MathView content="$v_{\mathrm{lim}}$" />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-rose-500" />
                <span>Tangente</span>
                <MathView content="$(a_0 = A)$" />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-amber-400" />
                <span>Temps</span>
                <MathView content="$\tau$" />
              </span>
              {referenceCurve && (
                <span className="flex items-center gap-1.5 text-purple-400">
                  <span className="w-3 h-0.5 border-t border-dashed border-purple-400" />
                  Courbe témoin
                </span>
              )}
            </div>

            {/* Toggle points d'Euler */}
            <button
              onClick={() => setShowEulerOnGraph(!showEulerOnGraph)}
              className={`text-[11px] px-2 py-0.5 rounded border transition-all flex items-center gap-1 ${
                showEulerOnGraph
                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3 h-3" />
              <MathView content="Points d'Euler" />
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          CURSEURS DE RÉGLAGE DES PARAMÈTRES PHYSIQUES
      ====================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
        {/* Curseur 1 : Masse de la bille m */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1">
              <span>Masse de la bille</span> <MathView content="$m$" /> :
            </span>
            <span className="font-mono text-sky-400 font-bold text-xs">{mass} g</span>
          </div>
          <input
            type="range"
            min={10}
            max={80}
            step={1}
            value={mass}
            onChange={(e) => setMass(Number(e.target.value))}
            className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>10 g</span>
            <span>Plomb / Acier</span>
            <span>80 g</span>
          </div>
        </div>

        {/* Curseur 2 : Masse volumique du fluide rho_f */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1">
              <span>Fluide</span> <MathView content="$\rho_f$" /> :
            </span>
            <span className="font-mono text-sky-400 font-bold text-xs">{fluidDensity} kg/m³</span>
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
          <div className="flex gap-1.5">
            <button
              onClick={() => setFluidDensity(900)}
              className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${
                fluidDensity === 900
                  ? 'bg-sky-600/30 border-sky-500 text-sky-200'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              Huile (900)
            </button>
            <button
              onClick={() => setFluidDensity(1000)}
              className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${
                fluidDensity === 1000
                  ? 'bg-sky-600/30 border-sky-500 text-sky-200'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              Eau (1000)
            </button>
            <button
              onClick={() => setFluidDensity(1260)}
              className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${
                fluidDensity === 1260
                  ? 'bg-sky-600/30 border-sky-500 text-sky-200'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              Glycérol (1260)
            </button>
          </div>
        </div>

        {/* Curseur 3 : Coefficient de frottement visqueux k */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1">
              <span>Frottement</span> <MathView content="$k$" /> :
            </span>
            <span className="font-mono text-sky-400 font-bold text-xs">{kFriction.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0.03}
            max={0.35}
            step={0.01}
            value={kFriction}
            onChange={(e) => setKFriction(Number(e.target.value))}
            className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Fluide</span>
            <span>
              <MathView content={frictionPower === 1 ? '$k$ (kg/s)' : '$k$ (kg/m)'} />
            </span>
            <span>Très visqueux</span>
          </div>
        </div>

        {/* Curseur 4 : Rayon de la bille r */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-medium flex items-center gap-1">
              <span>Rayon de la bille</span> <MathView content="$r$" /> :
            </span>
            <span className="font-mono text-sky-400 font-bold text-xs">{radius.toFixed(1)} cm</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>0.5 cm</span>
            <span>
              <MathView content={`$V = ${(volume * 1e6).toFixed(2)}$ cm³`} />
            </span>
            <span>2.0 cm</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          CARTES DE VALEURS PHYSIQUES CALCULÉES (Rendu LaTeX propre)
      ====================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
        {/* Accélération initiale a_0 = A */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
          <div className="text-slate-400 text-[11px] flex items-center justify-center gap-1">
            <span>Accélération</span>
            <MathView content="$a_0 = A$" />
          </div>
          <div className="font-mono text-base font-bold text-sky-400 mt-1">
            {A.toFixed(2)} m/s²
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            <MathView content="$g \cdot \left(1 - \frac{\rho_f \cdot V}{m}\right)$" />
          </div>
        </div>

        {/* Vitesse limite v_lim */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
          <div className="text-slate-400 text-[11px] flex items-center justify-center gap-1">
            <span>Vitesse limite</span>
            <MathView content="$v_{\mathrm{lim}}$" />
          </div>
          <div className="font-mono text-base font-bold text-emerald-400 mt-1">
            {v_lim.toFixed(2)} m/s
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            <MathView
              content={
                frictionPower === 1
                  ? '$v_{\\mathrm{lim}} = \\frac{A}{B}$'
                  : '$v_{\\mathrm{lim}} = \\sqrt{\\frac{A}{B}}$'
              }
            />
          </div>
        </div>

        {/* Temps caractéristique tau */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
          <div className="text-slate-400 text-[11px] flex items-center justify-center gap-1">
            <span>Temps</span>
            <MathView content="$\tau$" />
          </div>
          <div className="font-mono text-base font-bold text-amber-400 mt-1">
            {(tau * 1000).toFixed(0)} ms
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            <MathView
              content={
                frictionPower === 1
                  ? '$\\tau = \\frac{1}{B} = \\frac{m}{k}$'
                  : '$\\tau = \\frac{v_{\\mathrm{lim}}}{A}$'
              }
            />
          </div>
        </div>

        {/* Bilan des forces à l'équilibre */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
          <div className="text-slate-400 text-[11px] flex items-center justify-center gap-1">
            <span>Archimède</span>
            <MathView content="$F_A$" />
          </div>
          <div className="font-mono text-base font-bold text-violet-400 mt-1">
            {(buoyantForce * 1000).toFixed(1)} mN
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-center gap-1">
            <span>Poids</span> <MathView content={`$P = ${(weight * 1000).toFixed(1)}$ mN`} />
          </div>
        </div>
      </div>

      {/* =====================================================================
          ONGLETS PÉDAGOGIQUES : Méthode d'Euler vs Cadre de Référence
      ====================================================================== */}
      <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('euler')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'euler'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900'
              }`}
            >
              Méthode d'Euler (Bac Marocain)
            </button>
            <button
              onClick={() => setActiveTab('course')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'course'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white bg-slate-900'
              }`}
            >
              Cadre de Référence & Formules Clés
            </button>
          </div>

          <button
            onClick={handleResetParams}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Paramètres par défaut
          </button>
        </div>

        {/* --- CONTENU ONGLET 1 : MÉTHODE D'EULER --- */}
        {activeTab === 'euler' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-200">Algorithme itératif d'Euler :</span>
                <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-sky-300 font-mono">
                  <MathView content="$a_i = A - B \cdot v_i^n$" />
                </span>
                <span className="text-slate-400 font-medium">et</span>
                <span className="px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-emerald-300 font-mono">
                  <MathView content="$v_{i+1} = v_i + a_i \cdot \Delta t$" />
                </span>
              </div>

              {/* Sélecteur de pas d'Euler dt */}
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 flex items-center gap-1">
                  Pas de calcul <MathView content="$\Delta t$" /> :
                </span>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={eulerDtMs}
                  onChange={(e) => setEulerDtMs(Number(e.target.value))}
                  className="w-24 accent-sky-400 h-1.5 bg-slate-800 rounded cursor-pointer"
                />
                <span className="font-mono text-sky-400 font-bold">{eulerDtMs} ms</span>
              </div>
            </div>

            {/* Condition de précision du pas d'Euler */}
            <div className="flex items-center gap-2 text-xs">
              {eulerDtMs * 1e-3 <= tau / 10 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Condition respectée :</span>
                  <MathView content="$\Delta t \le \frac{\tau}{10}$" />
                  <span className="text-slate-400">(Excellente précision numérique)</span>
                </span>
              ) : eulerDtMs * 1e-3 <= tau / 5 ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Attention :</span>
                  <MathView content="$\Delta t > \frac{\tau}{10}$" />
                  <span className="text-slate-400">(Précision modérée)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Pas trop grand :</span>
                  <MathView content="$\Delta t > \frac{\tau}{5}$" />
                  <span className="text-slate-400">(Risque d'erreur ou d'instabilité)</span>
                </span>
              )}
            </div>

            {/* Tableau des valeurs d'Euler pas à pas (comme à l'Examen National) */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">
                      <span className="flex items-center gap-1">
                        Étape <MathView content="$i$" />
                      </span>
                    </th>
                    <th className="py-2.5 px-3">
                      <span className="flex items-center gap-1">
                        Temps <MathView content="$t_i$" /> (s)
                      </span>
                    </th>
                    <th className="py-2.5 px-3">
                      <span className="flex items-center gap-1">
                        <MathView content="$v_i$" /> (Euler m/s)
                      </span>
                    </th>
                    <th className="py-2.5 px-3">
                      <span className="flex items-center gap-1">
                        <MathView content="$v(t_i)$" /> (Exact m/s)
                      </span>
                    </th>
                    <th className="py-2.5 px-3">
                      <span className="flex items-center gap-1">
                        <MathView content="$a_i = A - B \cdot v_i^n$" /> (m/s²)
                      </span>
                    </th>
                    <th className="py-2.5 px-3">
                      <span className="flex items-center gap-1">
                        <MathView content="$v_{i+1} = v_i + a_i \cdot \Delta t$" />
                      </span>
                    </th>
                    <th className="py-2.5 px-3">Écart relatif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {eulerStepsData.map((row) => (
                    <tr
                      key={row.i}
                      className={row.i % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-900/20'}
                    >
                      <td className="py-1.5 px-3 font-bold text-slate-300">{row.i}</td>
                      <td className="py-1.5 px-3 text-slate-400">{row.t.toFixed(3)}</td>
                      <td className="py-1.5 px-3 text-sky-400 font-bold">
                        {row.vEuler.toFixed(3)}
                      </td>
                      <td className="py-1.5 px-3 text-slate-300">{row.vTh.toFixed(3)}</td>
                      <td className="py-1.5 px-3 text-amber-400">{row.aEuler.toFixed(2)}</td>
                      <td className="py-1.5 px-3 text-emerald-400">
                        {(row.vEuler + row.aEuler * (eulerDtMs * 1e-3)).toFixed(3)}
                      </td>
                      <td className="py-1.5 px-3">
                        <span
                          className={
                            row.errorPct < 3
                              ? 'text-emerald-400'
                              : row.errorPct < 8
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }
                        >
                          {row.i === 0 ? '-' : `${row.errorPct.toFixed(1)}%`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- CONTENU ONGLET 2 : RAPPELS DU CADRE DE RÉFÉRENCE --- */}
        {activeTab === 'course' && (
          <div className="space-y-4 text-xs text-slate-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                <div className="font-bold text-white text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  1. Équation différentielle du mouvement
                </div>
                <p className="text-slate-400">
                  Système : bille de masse <MathView content="$m$" /> dans un axe vertical $(Oz)$
                  descendant.
                </p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60 text-center">
                  <MathView
                    content="$$\frac{\mathrm{d}v}{\mathrm{d}t} = g \left(1 - \frac{\rho_f \cdot V}{m}\right) - \frac{k}{m} \cdot v^n = A - B \cdot v^n$$"
                    block
                  />
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                  <li>
                    <span className="font-medium text-slate-300">
                      <MathView content="$A = g \left(1 - \frac{\rho_f \cdot V}{m}\right) = a_0$" />
                    </span>{' '}
                    : accélération initiale à <MathView content="$t = 0$" />
                  </li>
                  <li>
                    <span className="font-medium text-slate-300">
                      <MathView content="$B = \frac{k}{m}$" />
                    </span>{' '}
                    : coefficient de frottement massique
                  </li>
                </ul>
              </div>

              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                <div className="font-bold text-white text-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  2. Régime permanent et vitesse limite
                </div>
                <p className="text-slate-400 flex items-center gap-1 flex-wrap">
                  <span>En régime permanent (</span>
                  <MathView content="$t \ge 5\tau$" />
                  <span>), la vitesse devient constante donc</span>
                  <MathView content="$\frac{\mathrm{d}v}{\mathrm{d}t} = 0$" /> :
                </p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/60 text-center">
                  <MathView
                    content={
                      frictionPower === 1
                        ? '$$0 = A - B \cdot v_{\mathrm{lim}} \implies v_{\mathrm{lim}} = \frac{A}{B} = \frac{m \cdot g \left(1 - \frac{\rho_f V}{m}\right)}{k}$$'
                        : '$$0 = A - B \cdot v_{\mathrm{lim}}^2 \implies v_{\mathrm{lim}} = \sqrt{\frac{A}{B}}$$'
                    }
                    block
                  />
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                  <li>
                    À <MathView content="$t = \tau$" /> :{' '}
                    <span className="font-mono text-emerald-400">
                      {frictionPower === 1 ? 'v(τ) ≈ 0,63 · v_lim' : 'v(τ) ≈ 0,76 · v_lim'}
                    </span>{' '}
                    ({frictionPower === 1 ? 'régime linéaire' : 'régime quadratique'})
                  </li>
                  <li>
                    La tangente à l'origine coupe l'asymptote <MathView content="$v = v_{\mathrm{lim}}$" /> en{' '}
                    <MathView content="$t = \tau$" />
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
