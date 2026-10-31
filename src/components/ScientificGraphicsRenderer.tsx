import React, { useState, useMemo, useRef } from 'react';
import { Download, RefreshCw, ZoomIn, ZoomOut, Info, Activity, GitFork, Copy, Check } from 'lucide-react';

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
    // Remplacement des fonctions mathématiques standard
    const sanitized = fnStr
      .replace(/\bexp\b/g, 'Math.exp')
      .replace(/\bsin\b/g, 'Math.sin')
      .replace(/\bcos\b/g, 'Math.cos')
      .replace(/\btan\b/g, 'Math.tan')
      .replace(/\bsqrt\b/g, 'Math.sqrt')
      .replace(/\bln\b/g, 'Math.log')
      .replace(/\blog\b/g, 'Math.log10')
      .replace(/\babs\b/g, 'Math.abs')
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\^/g, '**');

    // Évaluation sécurisée avec scope restreint
    const fn = new Function('x', 'Math', `return (${sanitized});`);
    const val = fn(x, Math);
    return typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : 0;
  } catch {
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

  // Normalisation des séries
  const series: CurveSeries[] = useMemo(() => {
    if (spec.curves && spec.curves.length > 0) {
      return spec.curves;
    }
    if (spec.function) {
      return [
        {
          id: 'main',
          name: yLabel,
          color: spec.color || '#38bdf8',
          fn: spec.function,
          strokeWidth: 2.5,
        },
      ];
    }
    return [];
  }, [spec.curves, spec.function, spec.color, yLabel]);

  // Dimensions SVG internes
  const width = 640;
  const height = 360;
  const margin = { top: 30, right: 35, bottom: 45, left: 55 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // Échelles
  const effectiveXMax = xMin + (xMax - xMin) / zoomLevel;
  const effectiveYMax = yMin + (yMax - yMin) / zoomLevel;

  const scaleX = (x: number) => margin.left + ((x - xMin) / (effectiveXMax - xMin)) * plotWidth;
  const scaleY = (y: number) => margin.top + plotHeight - ((y - yMin) / (effectiveYMax - yMin)) * plotHeight;
  const unscaleX = (px: number) => xMin + ((px - margin.left) / plotWidth) * (effectiveXMax - xMin);

  // Génération des points d'échantillonnage pour chaque fonction
  const sampleSteps = 240;
  const renderedPaths = useMemo(() => {
    return series.map((s) => {
      if (s.data && s.data.length > 0) {
        const points = s.data
          .filter((pt) => pt.x >= xMin && pt.x <= effectiveXMax)
          .map((pt) => `${scaleX(pt.x)},${scaleY(pt.y)}`)
          .join(' ');
        return { ...s, d: points ? `M ${points.replace(/ /g, ' L ')}` : '' };
      }

      if (s.fn) {
        const stepSize = (effectiveXMax - xMin) / sampleSteps;
        const pts: string[] = [];
        for (let i = 0; i <= sampleSteps; i++) {
          const x = xMin + i * stepSize;
          const y = evaluateMathFunction(s.fn, x);
          const px = scaleX(x);
          const py = Math.max(margin.top - 10, Math.min(margin.top + plotHeight + 10, scaleY(y)));
          pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
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
              const y0 = series[0]?.fn ? evaluateMathFunction(series[0].fn, x0) : 0;
              // Équation de la tangente : y - y0 = slope * (x - x0)
              const xEnd = Math.min(effectiveXMax, x0 + (effectiveYMax - y0) / (tg.slope || 1));
              const yEnd = y0 + tg.slope * (xEnd - x0);

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

            {/* Tracé des courbes mathématiques */}
            {renderedPaths.map((s) => (
              <g key={`series-${s.id}`}>
                <path
                  d={s.d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.strokeWidth || 2.5}
                  strokeDasharray={s.dashArray || 'none'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glowEffect)"
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
              {notes}
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

  const renderTree = (node: MindMapNode, depth = 0, index = 0): React.ReactNode => {
    const isRoot = depth === 0;
    const colors = [
      'border-amber-500 bg-amber-500/10 text-amber-300',
      'border-sky-500 bg-sky-500/10 text-sky-300',
      'border-emerald-500 bg-emerald-500/10 text-emerald-300',
      'border-purple-500 bg-purple-500/10 text-purple-300',
      'border-rose-500 bg-rose-500/10 text-rose-300',
    ];
    const colorClass = colors[(depth + index) % colors.length];

    return (
      <div key={`node-${depth}-${index}-${node.label}`} className="flex flex-col items-start gap-2">
        <div
          className={`px-3 py-2 rounded-xl border font-medium text-xs sm:text-sm shadow-md transition-all hover:scale-[1.02] ${
            isRoot
              ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-400 text-amber-200 font-bold text-sm sm:text-base px-4 py-2.5'
              : colorClass
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{node.label}</span>
            {node.badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-200 font-semibold border border-slate-700">
                {node.badge}
              </span>
            )}
          </div>
          {node.formula && (
            <div className="mt-1 text-[11px] font-mono text-slate-200 bg-slate-950/70 px-2 py-0.5 rounded border border-slate-800/80">
              {node.formula}
            </div>
          )}
        </div>

        {/* Enfants */}
        {node.children && node.children.length > 0 && (
          <div className="pl-4 sm:pl-6 border-l-2 border-slate-800/80 my-1 space-y-2.5">
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
      </div>

      <div className="p-4 overflow-x-auto">{renderTree(root)}</div>
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
