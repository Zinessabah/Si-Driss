import React, { useState, useMemo, useRef } from 'react';
import { Download, RefreshCw, ZoomIn, ZoomOut, Info, Activity, GitFork, Copy, Check } from 'lucide-react';
import katex from 'katex';
import DOMPurify from 'dompurify';

const KATEX_MACROS: Record<string, string> = {
  '\\unit': '\\text{#1}',
  '\\pu': '\\text{#1}',
  '\\si': '\\text{#1}',
  '\\SI': '#1\\,\\text{#2}',
  '\\degree': '^\\circ',
  '\\d': '\\mathrm{d}',
  '\\dd': '\\mathrm{d}',
  '\\vect': '\\vec{#1}',
  '\\norm': '\\left\\|#1\\right\\|',
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\boxed': '#1',
};

/**
 * Convertit des notations de physique ASCII (ex: d^2 u_C / dt^2, (R_t / L), T ~ T_0, 2*pi*sqrt(LC)) en code LaTeX valide
 */
export function normalizePhysicsMathToLatex(input: string): string {
  if (!input) return '';
  let s = input.trim();

  // Enlève d'éventuels délimiteurs $...$ externes
  if (s.startsWith('$') && s.endsWith('$') && s.length >= 2) {
    s = s.slice(1, -1).trim();
  }

  // Détection si déjà du LaTeX avec commandes explicites
  const hasLatexCommands = /\\(frac|sqrt|cdot|approx|lambda|tau|pi|Delta|theta|mu|le|ge)\b/.test(s);

  // 1. Dérivées secondes : d^2 u_C / dt^2 ou d^2u_C/dt^2 -> \frac{d^2 u_C}{dt^2}
  s = s.replace(/d\^2\s*([a-zA-Z_]+)\s*\/\s*dt\^2/gi, '\\frac{d^2 $1}{dt^2}');
  s = s.replace(/d\^2\s*([a-zA-Z_]+)\s*\/\s*d([a-zA-Z_]+)\^2/gi, '\\frac{d^2 $1}{d$2^2}');

  // 2. Dérivées premières : du_C/dt, dq/dt, di/dt, dE_t/dt -> \frac{d...}{dt}
  s = s.replace(/d([a-zA-Z_]+)\s*\/\s*dt/gi, '\\frac{d$1}{dt}');
  s = s.replace(/d([a-zA-Z_]+)\s*\/\s*d([a-zA-Z_]+)/gi, '\\frac{d$1}{d$2}');

  // 3. Fractions entre parenthèses : (R_t / L) -> \frac{R_t}{L}, (1 / LC) -> \frac{1}{LC}
  s = s.replace(/\(\s*([a-zA-Z0-9_]+)\s*\/\s*([a-zA-Z0-9_]+)\s*\)/g, '\\frac{$1}{$2}');

  // 4. Fractions numériques : 1/2 -> \frac{1}{2}, 1/LC -> \frac{1}{LC}
  s = s.replace(/\b1\/2\b/g, '\\frac{1}{2}');
  s = s.replace(/\b([0-9]+)\s*\/\s*([a-zA-Z0-9_]+)\b/g, '\\frac{$1}{$2}');

  // 5. Racines : sqrt(...) -> \sqrt{...}
  s = s.replace(/sqrt\(([^)]+)\)/gi, '\\sqrt{$1}');

  // 6. Lettres grecques si non précédées d'un antislash
  if (!hasLatexCommands) {
    s = s.replace(/(?<!\\)\bpi\b/gi, '\\pi');
    s = s.replace(/(?<!\\)\blambda\b/gi, '\\lambda');
    s = s.replace(/(?<!\\)\btau\b/gi, '\\tau');
    s = s.replace(/(?<!\\)\bDelta\b/g, '\\Delta');
    s = s.replace(/(?<!\\)\bdelta\b/g, '\\delta');
    s = s.replace(/(?<!\\)\btheta\b/gi, '\\theta');
    s = s.replace(/(?<!\\)\bmu\b/gi, '\\mu');
    s = s.replace(/(?<!\\)\bomega\b/gi, '\\omega');
    s = s.replace(/(?<!\\)\bOmega\b/g, '\\Omega');
  }

  // 7. Opérateurs
  s = s.replace(/\s*\*\s*/g, ' \\cdot ');
  s = s.replace(/<=/g, ' \\le ');
  s = s.replace(/>=/g, ' \\ge ');
  s = s.replace(/\s*~\s*/g, ' \\approx ');
  s = s.replace(/!=/g, ' \\neq ');

  return s;
}

/**
 * Rendu KaTeX sécurisé avec dompurify
 */
export function renderLatexHtml(code: string, displayMode: boolean): string {
  try {
    const html = katex.renderToString(code, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
      macros: KATEX_MACROS,
    });
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true, mathMl: true } });
  } catch {
    return '';
  }
}

/**
 * Rend un texte mixte (mots français + formules $...$ ou expressions mathématiques sans délimiteur)
 */
export const MindMapTextView: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  if (!text) return null;

  // Délimiteurs explicites $...$
  if (text.includes('$')) {
    const tokens = text.split(/(\$[^$]+\$)/g);
    return (
      <span className={className}>
        {tokens.map((token, i) => {
          if (token.startsWith('$') && token.endsWith('$') && token.length > 2) {
            const math = normalizePhysicsMathToLatex(token.slice(1, -1));
            const html = renderLatexHtml(math, false);
            return (
              <span
                key={i}
                className="inline-block mx-0.5 align-middle font-bold text-amber-200"
                dangerouslySetInnerHTML={{ __html: html || token }}
              />
            );
          }
          return <span key={i}>{token}</span>;
        })}
      </span>
    );
  }

  // Détection automatique d'expressions mathématiques dans du texte sans délimiteurs
  // Exemples : "T_0 = 2*pi*sqrt(LC)", "T ~ T_0", "R_t = 0", "R_t", "u_C", "E_t"
  const mathRegex = /\b([A-Za-z]+_[A-Za-z0-9]+(?:\s*[=~<>]=?\s*[^,()]+)?|[A-Za-z]\s*[=~<>]=?\s*[^,()]+|[A-Za-z]+_[A-Za-z0-9]+)\b/g;

  const parts: { type: 'text' | 'math'; value: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'math', value: match[0].trim() });
    lastIndex = mathRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  if (parts.length === 0 || (parts.length === 1 && parts[0].type === 'text')) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.type === 'math') {
          const math = normalizePhysicsMathToLatex(p.value);
          const html = renderLatexHtml(math, false);
          return (
            <span
              key={i}
              className="inline-block mx-0.5 align-middle font-bold text-amber-200"
              dangerouslySetInnerHTML={{ __html: html || p.value }}
            />
          );
        }
        return <span key={i}>{p.value}</span>;
      })}
    </span>
  );
};

/**
 * Rend une formule complète de carte mentale avec KaTeX en mode display élégant
 */
export const MindMapFormulaView: React.FC<{ formula: string }> = ({ formula }) => {
  const latex = useMemo(() => normalizePhysicsMathToLatex(formula), [formula]);
  const html = useMemo(() => renderLatexHtml(latex, true), [latex]);

  if (!html) {
    return (
      <code className="text-xs font-mono text-amber-300 block text-center py-1">
        {formula}
      </code>
    );
  }

  return (
    <div
      className="text-center font-bold text-slate-100 py-0.5 overflow-x-auto [&_.katex]:text-sm sm:[&_.katex]:text-[15px] select-all"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export interface CurvePoint {
  x: number;
  y: number;
  label?: string;
  color?: string;
}

export interface CurveTangent {
  t0: number; // point d'abscisse de la tangente
  slope: number; // pente dy/dx
  label?: string;
  color?: string;
}

export interface CurveAsymptote {
  y?: number; // asymptote horizontale y = constant
  x?: number; // asymptote verticale x = constant
  label?: string;
  color?: string;
}

export interface CurveSeries {
  id: string;
  name: string;
  color: string;
  /** Expression JavaScript en x, ex: "5 * (1 - Math.exp(-x / 2))" */
  fn?: string;
  /** Ou tableau de points discrets (x, y) */
  data?: { x: number; y: number }[];
  strokeWidth?: number;
  dashArray?: string;
  unit?: string;
}

export interface CurveChartSpec {
  type?: 'curve';
  title: string;
  subtitle?: string;
  xLabel: string;
  yLabel: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** Courbe principale (raccourci) */
  function?: string;
  color?: string;
  /** Ou plusieurs courbes superposées */
  curves?: CurveSeries[];
  /** Tangente(s) */
  tangent?: CurveTangent;
  tangents?: CurveTangent[];
  /** Asymptote(s) */
  asymptote?: CurveAsymptote;
  asymptotes?: CurveAsymptote[];
  /** Points remarquables */
  points?: CurvePoint[];
  /** Remarques pédagogiques ou méthode de lecture */
  notes?: string;
}

export interface MindMapNode {
  label: string;
  formula?: string;
  badge?: string;
  children?: MindMapNode[];
}

export interface MindMapSpec {
  type: 'mindmap';
  title: string;
  subtitle?: string;
  root: MindMapNode;
}

export type GraphicSpec = CurveChartSpec | MindMapSpec;

/**
 * Évalue en toute sécurité une expression mathématique simple f(x)
 */
function evaluateMathFunction(fnStr: string, x: number): number {
  try {
    // 1. Éliminer d'abord tout préfixe 'Math.' déjà présent pour repartir d'une base saine
    let sanitized = fnStr.replace(/Math\./g, '');

    // 2. Préfixer rigoureusement toutes les fonctions et constantes mathématiques par Math.
    sanitized = sanitized
      .replace(/\b(exp|sin|cos|tan|sqrt|log10|log|abs|pow|asin|acos|atan|min|max|ceil|floor|round)\b/g, 'Math.$1')
      .replace(/\bln\b/g, 'Math.log')
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\be\b/g, 'Math.E')
      .replace(/\^/g, '**');

    // 3. Évaluation sécurisée
    const fn = new Function('x', 'Math', `return (${sanitized});`);
    const val = fn(x, Math);
    return typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : 0;
  } catch (err) {
    console.warn('[ScientificCurve] Erreur calcul f(x):', fnStr, err);
    return 0;
  }
}

/**
 * Composant de rendu pour une courbe scientifique interactive
 */
export const ScientificCurveChart: React.FC<{ spec: CurveChartSpec }> = ({ spec }) => {
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const {
    title,
    subtitle,
    xLabel = 't',
    yLabel = 'f(t)',
    xMin = 0,
    xMax = 10,
    yMin = 0,
    yMax = 10,
    notes,
  } = spec;

  // Normalisation des séries : conserve TOUJOURS la fonction principale et les courbes complémentaires
  const series: CurveSeries[] = useMemo(() => {
    const list: CurveSeries[] = [];
    if (spec.function) {
      list.push({
        id: 'main',
        name: spec.yLabel || yLabel || 'f(t)',
        color: spec.color || '#38bdf8',
        fn: spec.function,
        strokeWidth: 3,
      });
    }
    if (spec.curves && spec.curves.length > 0) {
      spec.curves.forEach((c) => {
        if (!list.some((existing) => existing.id === c.id)) {
          list.push(c);
        }
      });
    }
    return list;
  }, [spec.curves, spec.function, spec.color, spec.yLabel, yLabel]);

  // Dimensions SVG internes
  const width = 640;
  const height = 360;
  const margin = { top: 30, right: 35, bottom: 45, left: 55 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // Échelles
  const effectiveXMax = xMin + (xMax - xMin) / zoomLevel;
  const effectiveYMax = yMin + (yMax - yMin) / zoomLevel;

  const scaleX = (x: number) => {
    const span = effectiveXMax - xMin;
    if (span <= 0) return margin.left + plotWidth / 2;
    return margin.left + ((x - xMin) / span) * plotWidth;
  };

  const scaleY = (y: number) => {
    const span = effectiveYMax - yMin;
    if (span <= 0) return margin.top + plotHeight / 2;
    return margin.top + plotHeight - ((y - yMin) / span) * plotHeight;
  };

  const unscaleX = (px: number) => xMin + ((px - margin.left) / plotWidth) * (effectiveXMax - xMin);

  // Génération des points d'échantillonnage pour chaque fonction
  const sampleSteps = 300;
  const renderedPaths = useMemo(() => {
    return series.map((s) => {
      if (s.data && s.data.length > 0) {
        const points = s.data
          .filter((pt) => pt.x >= xMin && pt.x <= effectiveXMax)
          .map((pt) => `${scaleX(pt.x).toFixed(1)},${scaleY(pt.y).toFixed(1)}`)
          .join(' ');
        return { ...s, d: points ? `M ${points.replace(/ /g, ' L ')}` : '' };
      }

      if (s.fn) {
        const stepSize = (effectiveXMax - xMin) / sampleSteps;
        const pts: string[] = [];
        for (let i = 0; i <= sampleSteps; i++) {
          const x = xMin + i * stepSize;
          const y = evaluateMathFunction(s.fn, x);
          if (typeof y === 'number' && !isNaN(y) && isFinite(y)) {
            const px = scaleX(x);
            const py = Math.max(margin.top - 20, Math.min(margin.top + plotHeight + 20, scaleY(y)));
            pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
          }
        }
        return { ...s, d: pts.length > 0 ? `M ${pts.join(' L ')}` : '' };
      }

      return { ...s, d: '' };
    });
  }, [series, xMin, effectiveXMax, yMin, effectiveYMax, zoomLevel]);

  // Tangentes
  const allTangents = useMemo(() => {
    const list: CurveTangent[] = [];
    if (spec.tangent) list.push(spec.tangent);
    if (spec.tangents) list.push(...spec.tangents);
    return list;
  }, [spec.tangent, spec.tangents]);

  // Asymptotes
  const allAsymptotes = useMemo(() => {
    const list: CurveAsymptote[] = [];
    if (spec.asymptote) list.push(spec.asymptote);
    if (spec.asymptotes) list.push(...spec.asymptotes);
    return list;
  }, [spec.asymptote, spec.asymptotes]);

  // Points remarquables
  const allPoints = spec.points || [];

  // Graduation grille
  const xTicks = useMemo(() => {
    const count = 6;
    const step = (effectiveXMax - xMin) / count;
    return Array.from({ length: count + 1 }, (_, i) => {
      const val = xMin + i * step;
      return { val, px: scaleX(val), label: Number(val.toFixed(2)).toString() };
    });
  }, [xMin, effectiveXMax, zoomLevel]);

  const yTicks = useMemo(() => {
    const count = 5;
    const step = (effectiveYMax - yMin) / count;
    return Array.from({ length: count + 1 }, (_, i) => {
      const val = yMin + i * step;
      return { val, py: scaleY(val), label: Number(val.toFixed(2)).toString() };
    });
  }, [yMin, effectiveYMax, zoomLevel]);

  // Gestion du survol de la souris sur le graphique
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Normalisation aux coordonnées du viewBox
    const viewBoxX = (clientX / rect.width) * width;
    const viewBoxY = (clientY / rect.height) * height;

    if (
      viewBoxX >= margin.left &&
      viewBoxX <= margin.left + plotWidth &&
      viewBoxY >= margin.top &&
      viewBoxY <= margin.top + plotHeight
    ) {
      const mathX = unscaleX(viewBoxX);
      const firstFn = series[0]?.fn;
      const mathY = firstFn ? evaluateMathFunction(firstFn, mathX) : 0;
      setHoverCoord({
        x: mathX,
        y: mathY,
        px: viewBoxX,
        py: firstFn ? scaleY(mathY) : viewBoxY,
      });
    } else {
      setHoverCoord(null);
    }
  };

  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_courbe.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopySpec = () => {
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden backdrop-blur-md">
      {/* En-tête du graphique */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/60 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-slate-100 flex items-center gap-2">
              {title}
              {series.length > 1 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-normal">
                  {series.length} courbes
                </span>
              )}
            </h4>
            {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
          </div>
        </div>

        {/* Contrôles interactifs */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(z * 1.3, 4))}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Zoom avant"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(z / 1.3, 0.5))}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Zoom arrière"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          {zoomLevel !== 1 && (
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-amber-400 transition"
              title="Réinitialiser zoom"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleCopySpec}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Copier les paramètres"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleDownloadSVG}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Télécharger l'image vectorielle SVG"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Rendu Canvas / SVG vectoriel */}
      <div className="p-2 sm:p-4 flex flex-col items-center">
        <div className="w-full relative max-w-2xl aspect-[16/9] select-none">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full cursor-crosshair overflow-visible"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverCoord(null)}
          >
            <defs>
              <linearGradient id="gridGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
              <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Fond du graphique */}
            <rect
              x={margin.left}
              y={margin.top}
              width={plotWidth}
              height={plotHeight}
              fill="url(#gridGrad)"
              stroke="#334155"
              strokeWidth="1"
              rx="6"
            />

            {/* Lignes de la grille X */}
            {xTicks.map((tick, i) => (
              <g key={`xtick-${i}`}>
                <line
                  x1={tick.px}
                  y1={margin.top}
                  x2={tick.px}
                  y2={margin.top + plotHeight}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text
                  x={tick.px}
                  y={margin.top + plotHeight + 16}
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="system-ui, sans-serif"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Lignes de la grille Y */}
            {yTicks.map((tick, i) => (
              <g key={`ytick-${i}`}>
                <line
                  x1={margin.left}
                  y1={tick.py}
                  x2={margin.left + plotWidth}
                  y2={tick.py}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text
                  x={margin.left - 8}
                  y={tick.py + 3}
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="system-ui, sans-serif"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Labels des axes */}
            <text
              x={margin.left + plotWidth}
              y={margin.top + plotHeight + 34}
              fill="#38bdf8"
              fontSize="12"
              fontWeight="600"
              textAnchor="end"
              fontFamily="system-ui, sans-serif"
            >
              {xLabel} →
            </text>
            <text
              x={margin.left}
              y={margin.top - 12}
              fill="#38bdf8"
              fontSize="12"
              fontWeight="600"
              textAnchor="start"
              fontFamily="system-ui, sans-serif"
            >
              ↑ {yLabel}
            </text>

            {/* Asymptotes */}
            {allAsymptotes.map((asymp, i) => {
              if (asymp.y !== undefined) {
                const py = scaleY(asymp.y);
                if (py >= margin.top && py <= margin.top + plotHeight) {
                  return (
                    <g key={`asymp-y-${i}`}>
                      <line
                        x1={margin.left}
                        y1={py}
                        x2={margin.left + plotWidth}
                        y2={py}
                        stroke={asymp.color || '#f59e0b'}
                        strokeWidth="1.5"
                        strokeDasharray="5 4"
                      />
                      <text
                        x={margin.left + plotWidth - 10}
                        y={py - 6}
                        fill={asymp.color || '#f59e0b'}
                        fontSize="10"
                        fontWeight="600"
                        textAnchor="end"
                      >
                        {asymp.label || `Asymptote y = ${asymp.y}`}
                      </text>
                    </g>
                  );
                }
              }
              return null;
            })}

            {/* Tangentes à l'origine ou en un point */}
            {allTangents.map((tg, i) => {
              const x0 = tg.t0;
              const mainFn = series.find((s) => s.fn)?.fn;
              const y0 = mainFn ? evaluateMathFunction(mainFn, x0) : 0;

              let xEnd = effectiveXMax;
              let yEnd = y0 + tg.slope * (xEnd - x0);
              if (tg.slope > 0) {
                const targetY = allAsymptotes[0]?.y ?? effectiveYMax;
                xEnd = Math.min(effectiveXMax, x0 + (targetY - y0) / tg.slope);
                yEnd = y0 + tg.slope * (xEnd - x0);
              } else if (tg.slope < 0) {
                xEnd = Math.min(effectiveXMax, x0 - y0 / tg.slope);
                yEnd = y0 + tg.slope * (xEnd - x0);
              }

              const px1 = scaleX(x0);
              const py1 = scaleY(y0);
              const px2 = scaleX(xEnd);
              const py2 = scaleY(yEnd);

              return (
                <g key={`tangent-${i}`}>
                  <line
                    x1={px1}
                    y1={py1}
                    x2={px2}
                    y2={py2}
                    stroke={tg.color || '#ec4899'}
                    strokeWidth="1.8"
                    strokeDasharray="4 2"
                  />
                  <circle cx={px1} cy={py1} r="3.5" fill={tg.color || '#ec4899'} />
                  {tg.label && (
                    <text
                      x={px2 - 8}
                      y={Math.max(margin.top + 15, py2 - 6)}
                      fill={tg.color || '#ec4899'}
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="end"
                    >
                      {tg.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Tracé des courbes mathématiques principales */}
            {renderedPaths.map((s) => (
              <g key={`series-${s.id}`}>
                {/* Halo d'ambiance lumineux sous la courbe */}
                <path
                  d={s.d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={(s.strokeWidth || 3) + 4}
                  strokeOpacity="0.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Tracé principal net et éclatant */}
                <path
                  d={s.d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.strokeWidth || 3}
                  strokeDasharray={s.dashArray || 'none'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ))}

            {/* Points remarquables */}
            {allPoints.map((pt, i) => {
              const px = scaleX(pt.x);
              const py = scaleY(pt.y);
              if (
                px >= margin.left &&
                px <= margin.left + plotWidth &&
                py >= margin.top &&
                py <= margin.top + plotHeight
              ) {
                return (
                  <g key={`pt-${i}`}>
                    {/* Lignes projetées sur les axes */}
                    <line
                      x1={px}
                      y1={py}
                      x2={px}
                      y2={margin.top + plotHeight}
                      stroke={pt.color || '#38bdf8'}
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      opacity="0.7"
                    />
                    <line
                      x1={margin.left}
                      y1={py}
                      x2={px}
                      y2={py}
                      stroke={pt.color || '#38bdf8'}
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      opacity="0.7"
                    />
                    <circle cx={px} cy={py} r="5" fill={pt.color || '#fbbf24'} stroke="#0f172a" strokeWidth="2" />
                    {pt.label && (
                      <g>
                        <rect
                          x={Math.min(px + 6, margin.left + plotWidth - 110)}
                          y={Math.max(py - 22, margin.top + 4)}
                          width="100"
                          height="18"
                          rx="4"
                          fill="#0f172a"
                          stroke={pt.color || '#38bdf8'}
                          strokeWidth="1"
                          opacity="0.9"
                        />
                        <text
                          x={Math.min(px + 12, margin.left + plotWidth - 104)}
                          y={Math.max(py - 10, margin.top + 16)}
                          fill="#f8fafc"
                          fontSize="9.5"
                          fontWeight="600"
                        >
                          {pt.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              }
              return null;
            })}

            {/* Curseur de survol interactif */}
            {hoverCoord && (
              <g>
                <line
                  x1={hoverCoord.px}
                  y1={margin.top}
                  x2={hoverCoord.px}
                  y2={margin.top + plotHeight}
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <circle cx={hoverCoord.px} cy={hoverCoord.py} r="4.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
                <g transform={`translate(${Math.min(hoverCoord.px + 10, width - 140)}, ${Math.max(hoverCoord.py - 30, margin.top + 5)})`}>
                  <rect width="130" height="28" rx="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" opacity="0.95" />
                  <text x="8" y="18" fill="#f8fafc" fontSize="10.5" fontFamily="monospace" fontWeight="bold">
                    {xLabel}: {hoverCoord.x.toFixed(2)} | {yLabel}: {hoverCoord.y.toFixed(2)}
                  </text>
                </g>
              </g>
            )}
          </svg>
        </div>

        {/* Légende si plusieurs courbes */}
        {series.length > 1 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs">
            {series.map((s) => (
              <div key={`legend-${s.id}`} className="flex items-center gap-1.5">
                <span className="w-3.5 h-1 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-slate-300 font-medium">{s.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Remarques / Clés de lecture pour l'examen */}
        {notes && (
          <div className="mt-3 w-full p-2.5 rounded-xl bg-slate-950/70 border border-amber-500/20 text-xs text-slate-300 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-amber-300">Guide de lecture Bac : </strong>
              <MindMapTextView text={notes} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Composant de rendu pour une carte mentale (MindMap) scientifique
 */
export const ScientificMindMap: React.FC<{ spec: MindMapSpec }> = ({ spec }) => {
  const { title, subtitle, root } = spec;
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopySpec = () => {
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderTree = (node: MindMapNode, depth = 0, index = 0): React.ReactNode => {
    const isRoot = depth === 0;
    const colors = [
      'border-amber-500/60 bg-amber-500/10 text-amber-200',
      'border-sky-500/60 bg-sky-500/10 text-sky-200',
      'border-emerald-500/60 bg-emerald-500/10 text-emerald-200',
      'border-purple-500/60 bg-purple-500/10 text-purple-200',
      'border-rose-500/60 bg-rose-500/10 text-rose-200',
    ];
    const colorClass = colors[(depth + index) % colors.length];

    return (
      <div key={`node-${depth}-${index}-${node.label}`} className="flex flex-col items-start gap-2.5">
        <div
          className={`px-3.5 py-2.5 rounded-2xl border font-medium text-xs sm:text-sm shadow-md transition-all hover:scale-[1.01] ${
            isRoot
              ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/10 border-amber-400/80 text-amber-100 font-bold text-sm sm:text-base px-4 py-3'
              : colorClass
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-100 tracking-wide">
              <MindMapTextView text={node.label} />
            </span>
            {node.badge && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900/90 text-slate-200 font-medium border border-slate-700/80 shadow-xs inline-flex items-center">
                <MindMapTextView text={node.badge} />
              </span>
            )}
          </div>
          {node.formula && (
            <div className="mt-2 py-1.5 px-3 rounded-xl bg-slate-950/90 text-slate-100 border border-slate-800/90 shadow-inner overflow-x-auto">
              <MindMapFormulaView formula={node.formula} />
            </div>
          )}
        </div>

        {/* Enfants */}
        {node.children && node.children.length > 0 && (
          <div className="pl-4 sm:pl-6 border-l-2 border-slate-800/80 my-1 space-y-3">
            {node.children.map((child, idx) => renderTree(child, depth + 1, idx))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="my-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/60 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-slate-100">{title}</h4>
            {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopySpec}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          title="Copier les paramètres de la carte"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="p-4 sm:p-5 overflow-x-auto">{renderTree(root)}</div>
    </div>
  );
};

/**
 * Composant universel de rendu graphique (Courbes ou MindMap)
 */
export const ScientificGraphicsRenderer: React.FC<{ spec: GraphicSpec }> = ({ spec }) => {
  if (spec.type === 'mindmap' || 'root' in spec) {
    return <ScientificMindMap spec={spec as MindMapSpec} />;
  }
  return <ScientificCurveChart spec={spec as CurveChartSpec} />;
};
