import React, { useMemo } from 'react';
import katex from 'katex';
import DOMPurify from 'dompurify';
import {
  ScientificGraphicsRenderer,
  ScientificSvgCard,
  GraphicSpec,
  MindMapSpec,
} from './ScientificGraphicsRenderer';

interface MathViewProps {
  content: string;
  className?: string;
  block?: boolean;
}

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
 * Supprime tout encadrement \boxed{...} en conservant l'expression mathématique complète
 */
function unwrapBoxedLatex(input: string): string {
  let result = input;
  let guard = 0;
  while (result.includes('\\boxed') && guard < 10) {
    guard++;
    const idx = result.indexOf('\\boxed');
    if (idx === -1) break;
    let cursor = idx + 6;
    while (cursor < result.length && /\s/.test(result[cursor])) cursor++;
    if (cursor < result.length && result[cursor] === '{') {
      let depth = 0;
      const startContent = cursor + 1;
      let endIdx = -1;
      for (let i = cursor; i < result.length; i++) {
        if (result[i] === '\\' && i + 1 < result.length) {
          i++;
          continue;
        }
        if (result[i] === '{') depth++;
        else if (result[i] === '}') {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
      if (endIdx !== -1) {
        const inner = result.slice(startContent, endIdx);
        result = result.slice(0, idx) + inner + result.slice(endIdx + 1);
      } else {
        result = result.replace('\\boxed', '');
      }
    } else {
      result = result.replace('\\boxed', '');
    }
  }
  return result;
}

/**
 * Nettoie et prépare une expression LaTeX avant de la confier à KaTeX
 */
function sanitizeLatexForKatex(rawMath: string, isDisplay: boolean): { code: string; forceDisplay: boolean } {
  let code = unwrapBoxedLatex(rawMath.trim());
  let forceDisplay = isDisplay;

  // Convertit \begin{align} ou \begin{align*} en \begin{aligned} (compatible partout dans KaTeX)
  if (/\\begin\{align\*?\}/.test(code)) {
    code = code
      .replace(/\\begin\{align\*?\}/g, '\\begin{aligned}')
      .replace(/\\end\{align\*?\}/g, '\\end{aligned}');
    forceDisplay = true;
  }

  if (/\\begin\{equation\*?\}/.test(code)) {
    code = code
      .replace(/\\begin\{equation\*?\}/g, '')
      .replace(/\\end\{equation\*?\}/g, '')
      .trim();
    forceDisplay = true;
  }

  if (/\\begin\{(aligned|cases|matrix|pmatrix|bmatrix|vmatrix)\}/.test(code)) {
    forceDisplay = true;
  }

  return { code, forceDisplay };
}

/**
 * Sous-composant dédié qui injecte directement le rendu LaTeX dans un conteneur DOM KaTeX
 * sans cadre contraignant et en gras avec hauteur libre
 */
/**
 * Rendu KaTeX sécurisé : trust désactivé (bloque \htmlStyle, \htmlClass,
 * \includegraphics, \href...) + double passage DOMPurify sur le HTML généré,
 * car le contenu vient de réponses IA non fiables.
 */
function renderKatexToSafeHtml(code: string, displayMode: boolean): string {
  try {
    const html = katex.renderToString(code, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
      macros: { ...KATEX_MACROS },
    });
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true, mathMl: true } });
  } catch {
    return '';
  }
}

/**
 * (M12) Rendu KaTeX unique et mémoïsé : un seul `renderToString` par formule et par
 * changement de contenu (plus de double rendu « initial + effet »), et composant
 * mémoïsé pour ignorer les re-rendus du parent pendant le streaming du chat.
 */
const KatexContainer: React.FC<{ math: string; displayMode: boolean; className?: string }> = React.memo(
  function KatexContainer({ math, displayMode, className = '' }) {
    const { code, forceDisplay } = sanitizeLatexForKatex(math, displayMode);
    const effectiveDisplay = displayMode || forceDisplay;

    // Rendu synchrone initial pour éviter tout clignotement — calculé UNE fois par contenu
    const initialHtml = useMemo(
      () => renderKatexToSafeHtml(code, effectiveDisplay),
      [code, effectiveDisplay]
    );

    return (
      <span
        className={`katex-container katex-render font-bold ${
          effectiveDisplay
            ? 'block my-3 py-2.5 px-1 text-center leading-relaxed'
            : 'inline mx-1 py-0.5 align-baseline leading-normal'
        } ${className}`}
        dangerouslySetInnerHTML={{ __html: initialHtml }}
      />
    );
  }
);

/**
 * Détecte et enveloppe automatiquement les formules LaTeX brutes qui auraient été écrites
 * sans délimiteurs $...$ dans un segment de texte, sans jamais engloutir de mots français.
 */
function autoWrapBareLatexInText(text: string): string {
  if (!text) return text;

  const hasBackslashCmd = /\\(frac|dfrac|tfrac|sqrt|vec|overrightarrow|dot|ddot|bar|overline|hat|boxed|sum|prod|int|oint|tau|lambda|Lambda|omega|Omega|Delta|delta|theta|Theta|varphi|phi|Phi|psi|Psi|alpha|beta|gamma|Gamma|pi|Pi|mu|nu|rho|sigma|Sigma|epsilon|varepsilon|eta|zeta|chi|cdot|times|div|pm|mp|approx|simeq|cong|equiv|neq|ne|leq|le|geq|ge|ll|gg|propto|infty|partial|nabla|rightarrow|to|leftarrow|longrightarrow|Rightarrow|Leftrightarrow|iff|rightleftharpoons|leftrightarrows|circ|degree|perp|parallel|angle|sin|cos|tan|ln|log|exp|lim)\b/.test(
    text
  );
  const hasSubOrSup = /\b[A-Za-z0-9]+_(\{[^{}\n]+\}|[a-zA-Z0-9]+)|\b[A-Za-z0-9]+\^(\{[^{}\n]+\}|[0-9+\-]+)/.test(text);

  if (!hasBackslashCmd && !hasSubOrSup) {
    return text;
  }

  // Atome mathématique LaTeX (commande \cmd{...} ou variable scientifique avec indice/exposant)
  const atomPattern =
    '(?:\\\\[a-zA-Z]+(?:\\s*\\[[^\\]\\n]*\\])?(?:\\s*\\{[^{}\\n]*(?:\\{[^{}\\n]*\\}[^{}\\n]*)*\\})*(?:\\s*(?:_\\{[^{}\\n]+\\}|_[a-zA-Z0-9]+|\\^\\{[^{}\\n]+\\}|\\^[0-9a-zA-Z+\\-]+))*|\\b[A-Za-z0-9]+(?:_\\{[^{}\\n]+\\}|_[a-zA-Z0-9]+|\\^\\{[^{}\\n]+\\}|\\^[0-9a-zA-Z+\\-]+)+)';

  const regex = new RegExp(atomPattern, 'g');
  let wrapped = text.replace(regex, (m) => `$${m}$`);

  // Fusionne SEULEMENT les atomes mathématiques adjacents séparés par des opérateurs mathématiques purs
  // Ne JAMAIS engloutir de chiffres précédents (ex: "Figure 1 $u_C$") ni de mots français suivants (ex: "$u_C$ = tension")
  let prev = '';
  let guard = 0;
  while (wrapped !== prev && guard < 6) {
    prev = wrapped;
    guard++;
    // Fusionne $a$ + $b$ -> $a + b$
    wrapped = wrapped.replace(
      /\$([^$\n]+)\$\s*([=+\-*/<>]\s*|-?\b[0-9]+(?:\.[0-9]+)?\s*)\$([^$\n]+)\$/g,
      (_m, p1, op, p2) => `$${p1} ${op.trim()} ${p2}$`
    );
    // Fusionne $a$ = 0 (valeur numérique ou unité strictement mathématique) -> $a = 0$
    wrapped = wrapped.replace(
      /\$([^$\n]+)\$(\s*[=~<>]=?\s*-?[0-9]+(?:\.[0-9]+)?(?:\s*(?:ms|V|A|Hz|rad\/s|s|m|kg|J|F|H|ohm|Ω)\b)?)(?=[.,;:\s)\]]|$)/g,
      (_m, p1, rhs) => `$${p1}${rhs}$`
    );
  }

  return wrapped;
}

/**
 * Pré-normalise toutes les variantes de délimiteurs LaTeX dans un texte :
 * - Blocs ```latex ... ``` ou ```math ... ``` -> $$ ... $$
 * - \[ ... \] -> $$ ... $$
 * - \( ... \) -> $ ... $
 * - \begin{equation|align|aligned|cases|...} hors $$ -> $$ ... $$
 * - Formules entourées de backticks `$...$` ou `\frac...` -> $...$
 */
function normalizeAllMathDelimiters(raw: string): string {
  if (!raw) return '';

  let normalized = raw
    // Blocs de code ```latex ... ```
    .replace(/```(?:latex|math|tex)\s*([\s\S]*?)```/gi, (_m, inner) => `\n$$${inner.trim()}$$\n`)
    // Délimiteurs \[ ... \] (attention: utilisation d'une fonction de remplacement pour éviter le piège JS de '$$')
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `$$${inner.trim()}$$`)
    // Délimiteurs \( ... \)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$${inner.trim()}$`)
    // Backticks autour de formules déjà délimitées : `$\tau = RC$` -> $\tau = RC$
    .replace(/`(\$\$?[^`]+?\$\$?)`/g, (_m, inner) => inner)
    // Backticks autour de commandes LaTeX : `\tau = RC` -> $\tau = RC$
    .replace(/`([^`\n]*\\[a-zA-Z]+[^`\n]*)`/g, (_m, inner) => `$${inner.trim()}$`);

  // Enveloppe les environnements \begin{...}...\end{...} qui ne sont pas déjà dans $$...$$
  normalized = normalized.replace(
    /(^|[^$])(\\begin\{(aligned|align\*?|equation\*?|cases|matrix|pmatrix|bmatrix|vmatrix)\}[\s\S]*?\\end\{\3\})(?!\$)/g,
    (_m, prefix, envBlock) => `${prefix}$$${envBlock}$$`
  );

  return normalized;
}

/**
 * Formate le texte inline (gras **...**, italique *...*, code `...`) hors formules mathématiques
 */
function renderFormattedPlainText(text: string, keyPrefix: string): React.ReactNode[] {
  if (!text) return [];

  const tokenRegex = /(\*\*[\s\S]+?\*\*|`[^`\n]+`)/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(
        <span key={`${keyPrefix}-txt-${lastIdx}`} className="whitespace-pre-wrap">
          {text.slice(lastIdx, match.index)}
        </span>
      );
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`${keyPrefix}-b-${match.index}`} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={`${keyPrefix}-c-${match.index}`}
          className="px-1.5 py-0.5 rounded bg-slate-800/90 text-amber-300 font-mono text-[0.92em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    lastIdx = tokenRegex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(
      <span key={`${keyPrefix}-end-${lastIdx}`} className="whitespace-pre-wrap">
        {text.slice(lastIdx)}
      </span>
    );
  }

  return parts;
}

/** Hash rapide (djb2) : clés React stables par contenu pendant le streaming (M12). */
function stableHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Rend une chaîne contenant des formules ($...$ et $$...$$) ainsi que du texte enrichi
 */
function renderMathAndTextNodes(input: string, forceBlock: boolean, keyPrefix: string): React.ReactNode[] {
  // 1. Découpe d'abord sur les délimiteurs explicites $$...$$ et $...$
  const explicitMathRegex = /(\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\\])+?\$)/g;
  const preliminarySegments: { type: 'math' | 'text'; value: string; display: boolean }[] = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = explicitMathRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      preliminarySegments.push({
        type: 'text',
        value: input.slice(lastIndex, match.index),
        display: false,
      });
    }

    const rawToken = match[0];
    const isDisplay = rawToken.startsWith('$$');
    const mathInner = isDisplay ? rawToken.slice(2, -2) : rawToken.slice(1, -1);

    preliminarySegments.push({
      type: 'math',
      value: mathInner,
      display: isDisplay || forceBlock,
    });

    lastIndex = explicitMathRegex.lastIndex;
  }

  if (lastIndex < input.length) {
    preliminarySegments.push({
      type: 'text',
      value: input.slice(lastIndex),
      display: false,
    });
  }

  // 2. Dans chaque segment 'text', détecte d'éventuelles formules LaTeX sans $ (ex: \frac{a}{b}, \tau)
  const finalNodes: React.ReactNode[] = [];

  preliminarySegments.forEach((seg, idx) => {
    if (seg.type === 'math') {
      finalNodes.push(
        <KatexContainer
          key={`${keyPrefix}-m-${idx}-${stableHash(seg.value)}`}
          math={seg.value}
          displayMode={seg.display}
        />
      );
      return;
    }

    // Détection automatique de LaTeX brut oublié hors délimiteurs $
    const autoWrapped = autoWrapBareLatexInText(seg.value);
    if (autoWrapped === seg.value) {
      finalNodes.push(...renderFormattedPlainText(seg.value, `${keyPrefix}-p-${idx}`));
      return;
    }

    // Re-découpe le segment après auto-enveloppement des formules brutes
    const subRegex = /\$([^$\n]+?)\$/g;
    let subLast = 0;
    let subCount = 0;
    let subMatch: RegExpExecArray | null;

    while ((subMatch = subRegex.exec(autoWrapped)) !== null) {
      if (subMatch.index > subLast) {
        finalNodes.push(
          ...renderFormattedPlainText(
            autoWrapped.slice(subLast, subMatch.index),
            `${keyPrefix}-st-${idx}-${subCount}-${subLast}`
          )
        );
      }
      finalNodes.push(
        <KatexContainer
          key={`${keyPrefix}-ak-${idx}-${subCount}-${stableHash(subMatch[1])}`}
          math={subMatch[1]}
          displayMode={false}
        />
      );
      subLast = subRegex.lastIndex;
      subCount++;
    }

    if (subLast < autoWrapped.length) {
      finalNodes.push(
        ...renderFormattedPlainText(
          autoWrapped.slice(subLast),
          `${keyPrefix}-st-end-${idx}-${subLast}`
        )
      );
    }
  });

  return finalNodes;
}

/**
 * Composant universel de rendu mathématique KaTeX + Markdown scientifique.
 * (M12) Mémoïsé : un message non modifié (hors message en cours de streaming)
 * ne redéclenche AUCUN rendu KaTeX lors des re-rendus du chat.
 */
export const MathView: React.FC<MathViewProps> = React.memo(function MathView({
  content,
  className = '',
  block = false,
}) {
  if (!content) return null;

  const trimmed = content.trim();
  if (!trimmed) return null;

  // Cas 1 : La chaîne entière est une formule unique encadrée par $...$ ou $$...$$
  if (
    trimmed.startsWith('$$') &&
    trimmed.endsWith('$$') &&
    trimmed.slice(2, -2).indexOf('$$') === -1
  ) {
    return (
      <KatexContainer
        math={trimmed.slice(2, -2)}
        displayMode={true}
        className={className}
      />
    );
  }

  if (
    trimmed.startsWith('$') &&
    trimmed.endsWith('$') &&
    !trimmed.startsWith('$$') &&
    trimmed.slice(1, -1).indexOf('$') === -1
  ) {
    return (
      <KatexContainer
        math={trimmed.slice(1, -1)}
        displayMode={block}
        className={className}
      />
    );
  }

  // Cas 2 : La chaîne entière est une formule LaTeX brute sans $ (ex: passée depuis un dictionnaire de formules)
  const hasDelimiters =
    trimmed.includes('$') || trimmed.includes('\\(') || trimmed.includes('\\[');
  const isPureSingleLineFormula =
    !hasDelimiters &&
    !trimmed.includes('\n') &&
    (block ||
      trimmed.startsWith('\\') ||
      /^([A-Za-z0-9_^{}\\]+\s*=\s*)/.test(trimmed));

  if (isPureSingleLineFormula) {
    return (
      <KatexContainer
        math={trimmed}
        displayMode={block}
        className={className}
      />
    );
  }

  // Cas 3 : Contenu mixte (texte + schémas SVG + graphiques scientifiques interactifs + formules LaTeX)
  const graphicBlockRegex =
    /```(svg|xml|curve|mindmap|graph|chart|mermaid)\s*([\s\S]*?)```|```(json)\s*(\{[\s\S]*?(?:"type"\s*:\s*"(?:curve|mindmap)"|"root"\s*:|"function"\s*:)[\s\S]*?\})\s*```/gi;
  const openStreamingFenceRe = /```(?:svg|curve|mindmap)\b(?![\s\S]*```)/i;
  const hasCompleteGraphic = graphicBlockRegex.test(content);
  graphicBlockRegex.lastIndex = 0;

  if (hasCompleteGraphic || openStreamingFenceRe.test(content)) {
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = graphicBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const textChunk = content.slice(lastIndex, match.index);
        const normalizedChunk = normalizeAllMathDelimiters(textChunk);
        elements.push(...renderMathAndTextNodes(normalizedChunk, block, `mv-txt-${lastIndex}`));
      }

      const fenceLang = (match[1] || match[3] || '').toLowerCase();
      const rawBlock = (match[2] || match[4] || '').trim();
      const isSvgBlock =
        fenceLang === 'svg' ||
        ((fenceLang === 'xml' || !fenceLang) && /<svg[\s>][\s\S]*<\/svg>/i.test(rawBlock));

      if (isSvgBlock) {
        elements.push(
          <div key={`mv-svg-${match.index}`} className="my-3 w-full">
            <ScientificSvgCard svgCode={rawBlock} />
          </div>
        );
      } else {
        const spec = tryParseGraphicSpec(rawBlock);
        if (spec) {
          elements.push(
            <div key={`mv-graphic-${match.index}`} className="my-3 w-full">
              <ScientificGraphicsRenderer spec={spec} />
            </div>
          );
        } else {
          elements.push(
            <pre
              key={`mv-raw-code-${match.index}`}
              className="my-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-amber-300 overflow-x-auto"
            >
              <code>{match[0]}</code>
            </pre>
          );
        }
      }

      lastIndex = graphicBlockRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      const tailChunk = content.slice(lastIndex);
      const pendingFenceIdx = tailChunk.search(openStreamingFenceRe);
      if (pendingFenceIdx !== -1) {
        const visibleText = tailChunk.slice(0, pendingFenceIdx);
        if (visibleText.trim()) {
          elements.push(
            ...renderMathAndTextNodes(normalizeAllMathDelimiters(visibleText), block, `mv-txt-tail-${lastIndex}`)
          );
        }
        elements.push(
          <div
            key={`mv-pending-${lastIndex}`}
            className="my-2 px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-sky-300 inline-flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span>Tracé du schéma scientifique en cours…</span>
          </div>
        );
      } else {
        const normalizedChunk = normalizeAllMathDelimiters(tailChunk);
        elements.push(...renderMathAndTextNodes(normalizedChunk, block, `mv-txt-end-${lastIndex}`));
      }
    }

    return (
      <div className={`leading-relaxed ${className}`}>
        {elements}
      </div>
    );
  }

  // Contenu standard sans blocs graphiques
  const normalized = normalizeAllMathDelimiters(content);
  const Container = block ? 'div' : 'span';

  return (
    <Container className={`leading-relaxed ${className}`}>
      {renderMathAndTextNodes(normalized, block, 'mv')}
    </Container>
  );
});

/**
 * Nettoie et répare une chaîne JSON générée par un LLM (LaTeX avec antislashs simples, virgules orphelines, commentaires).
 */
function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  // Enlever les commentaires // en fin de ligne
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  // Remplacer les antislashs simples invalides en JSON (ex: \lambda, \tau, \pi, \omega, \Delta, \approx, etc.) par des doubles \\
  // En JSON standard, les seuls échappements valides sont " \ / b f n r t u
  cleaned = cleaned.replace(/\\([^"\\\/bfnrtu]|u[0-9a-fA-F]{0,3}[^0-9a-fA-F])/g, '\\\\$1');
  // Enlever les virgules orphelines avant un crochet ou une accolade
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
  return cleaned;
}

/**
 * Analyse une structure de carte mentale écrite sous forme Mermaid ou de liste indentée en Markdown.
 */
function parseIndentedTextMindmap(content: string): MindMapSpec | null {
  const lines = content.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;

  let title = 'Carte Mentale';
  let rootNode: any = null;
  const stack: { depth: number; node: any }[] = [];

  for (const line of lines) {
    let trimmed = line.trim();
    if (trimmed.toLowerCase() === 'mindmap') continue;
    if (trimmed.startsWith('%%')) continue;

    const indent = line.search(/\S/);

    // Supprimer les puces markdown éventuelles (- , * , + , # , 1. )
    trimmed = trimmed.replace(/^[-*+]\s+/, '');
    trimmed = trimmed.replace(/^#+\s+/, '');
    trimmed = trimmed.replace(/^[0-9]+[.)]\s+/, '');

    // Nettoyer les encapsulations Mermaid : root((...)), [ ... ], ( ... )
    const rootMatch = trimmed.match(/root\s*\(\(\s*(.*?)\s*\)\)/i) || trimmed.match(/\(\(\s*(.*?)\s*\)\)/);
    if (rootMatch) {
      trimmed = rootMatch[1];
      title = trimmed;
    } else {
      const squareMatch = trimmed.match(/^\[\s*(.*?)\s*\]$/);
      if (squareMatch) trimmed = squareMatch[1];
      const parenMatch = trimmed.match(/^\(\s*(.*?)\s*\)$/);
      if (parenMatch) trimmed = parenMatch[1];
    }

    let formula: string | undefined = undefined;
    const formMatch = trimmed.match(/(?:formule|formula)\s*:\s*(.+)$/i);
    if (formMatch) {
      formula = formMatch[1].trim();
      trimmed = trimmed.replace(/(?:formule|formula)\s*:\s*(.+)$/i, '').trim();
      if (!trimmed) trimmed = 'Formule';
    }

    const node: any = { label: trimmed, children: [] };
    if (formula) node.formula = formula;

    if (!rootNode) {
      rootNode = node;
      title = trimmed;
      stack.push({ depth: indent, node });
      continue;
    }

    while (stack.length > 0 && stack[stack.length - 1].depth >= indent) {
      stack.pop();
    }

    if (stack.length > 0) {
      const parent = stack[stack.length - 1].node;
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      rootNode.children = rootNode.children || [];
      rootNode.children.push(node);
    }

    stack.push({ depth: indent, node });
  }

  if (!rootNode) return null;
  return {
    type: 'mindmap',
    title: title || 'Carte Mentale',
    root: rootNode,
  };
}

function tryParseGraphicSpec(raw: string): GraphicSpec | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // 1. Essai JSON standard ou nettoyé si commence par { ou contient des clés graphiques
  if (
    trimmed.startsWith('{') ||
    trimmed.includes('"root"') ||
    trimmed.includes('"function"') ||
    trimmed.includes('"curves"')
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        if (parsed.root && !parsed.type) parsed.type = 'mindmap';
        if ((parsed.function || parsed.curves) && !parsed.type) parsed.type = 'curve';
        if (parsed.type === 'mindmap' || parsed.type === 'curve') return parsed as GraphicSpec;
      }
    } catch {
      try {
        const cleaned = cleanJsonString(trimmed);
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed === 'object') {
          if (parsed.root && !parsed.type) parsed.type = 'mindmap';
          if ((parsed.function || parsed.curves) && !parsed.type) parsed.type = 'curve';
          if (parsed.type === 'mindmap' || parsed.type === 'curve') return parsed as GraphicSpec;
        }
      } catch {
        // Non-bloquant si le bloc est en cours de streaming
      }
    }
  }

  // 2. Essai Mermaid ou Liste indentée
  if (
    trimmed.startsWith('mindmap') ||
    trimmed.startsWith('- ') ||
    trimmed.startsWith('* ') ||
    trimmed.startsWith('#') ||
    trimmed.includes('root((')
  ) {
    const mm = parseIndentedTextMindmap(trimmed);
    if (mm) return mm;
  }

  return null;
}
