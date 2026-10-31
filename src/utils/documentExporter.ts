import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import katex from 'katex';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Math as DocxMath,
  MathRun,
  MathFraction,
  MathRadical,
  MathSubScript,
  MathSuperScript,
  MathSubSuperScript,
  ShadingType,
} from 'docx';

export interface ExportOptions {
  title?: string;
  content: string;
  branch?: string;
  source?: string;
  date?: string;
  /** (M16) Progression du rendu PDF page par page, pour indicateur UI. */
  onProgress?: (pagesDone: number, totalPages: number) => void;
}

// =============================================================================
// DICTIONNAIRE COMPLET DES SYMBOLES LATEX -> UNICODE MATHÉMATIQUE (PHYSIQUE-CHIMIE)
// =============================================================================
const LATEX_SYMBOLS: Record<string, string> = {
  // Lettres grecques minuscules
  '\\alpha': 'α',
  '\\beta': 'β',
  '\\gamma': 'γ',
  '\\delta': 'δ',
  '\\epsilon': 'ε',
  '\\varepsilon': 'ε',
  '\\zeta': 'ζ',
  '\\eta': 'η',
  '\\theta': 'θ',
  '\\vartheta': 'θ',
  '\\iota': 'ι',
  '\\kappa': 'κ',
  '\\lambda': 'λ',
  '\\mu': 'μ',
  '\\nu': 'ν',
  '\\xi': 'ξ',
  '\\pi': 'π',
  '\\varpi': 'π',
  '\\rho': 'ρ',
  '\\varrho': 'ρ',
  '\\sigma': 'σ',
  '\\varsigma': 'ς',
  '\\tau': 'τ',
  '\\upsilon': 'υ',
  '\\phi': 'φ',
  '\\varphi': 'φ',
  '\\chi': 'χ',
  '\\psi': 'ψ',
  '\\omega': 'ω',

  // Lettres grecques majuscules
  '\\Gamma': 'Γ',
  '\\Delta': 'Δ',
  '\\Theta': 'Θ',
  '\\Lambda': 'Λ',
  '\\Xi': 'Ξ',
  '\\Pi': 'Π',
  '\\Sigma': 'Σ',
  '\\Upsilon': 'Υ',
  '\\Phi': 'Φ',
  '\\Psi': 'Ψ',
  '\\Omega': 'Ω',

  // Opérateurs et relations physiques / mathématiques
  '\\cdot': '·',
  '\\times': '×',
  '\\div': '÷',
  '\\pm': '±',
  '\\mp': '∓',
  '\\approx': '≈',
  '\\simeq': '≃',
  '\\cong': '≅',
  '\\equiv': '≡',
  '\\neq': '≠',
  '\\ne': '≠',
  '\\leq': '≤',
  '\\le': '≤',
  '\\geq': '≥',
  '\\ge': '≥',
  '\\ll': '≪',
  '\\gg': '≫',
  '\\propto': '∝',
  '\\infty': '∞',
  '\\partial': '∂',
  '\\nabla': '∇',
  '\\forall': '∀',
  '\\exists': '∃',
  '\\in': '∈',
  '\\notin': '∉',
  '\\subset': '⊂',
  '\\cup': '∪',
  '\\cap': '∩',
  '\\emptyset': '∅',
  '\\perp': '⊥',
  '\\parallel': '∥',
  '\\angle': '∠',
  '\\circ': '°',
  '\\degree': '°',
  '\\prime': '′',
  '\\dots': '…',
  '\\ldots': '…',
  '\\cdots': '⋯',

  // Grands opérateurs
  '\\sum': '∑',
  '\\prod': '∏',
  '\\int': '∫',
  '\\oint': '∮',

  // Flèches (Mécanique, Chimie, Équilibres acido-basiques & rédox)
  '\\rightarrow': '→',
  '\\to': '→',
  '\\leftarrow': '←',
  '\\longrightarrow': '⟶',
  '\\longleftarrow': '⟵',
  '\\leftrightarrow': '↔',
  '\\Rightarrow': '⇒',
  '\\Leftarrow': '⇐',
  '\\Longrightarrow': '⟹',
  '\\Leftrightarrow': '⇔',
  '\\iff': '⇔',
  '\\rightleftharpoons': '⇌',
  '\\leftrightarrows': '⇄',
  '\\uparrow': '↑',
  '\\downarrow': '↓',
  '\\mapsto': '↦',

  // Fonctions usuelles
  '\\sin': 'sin',
  '\\cos': 'cos',
  '\\tan': 'tan',
  '\\cot': 'cot',
  '\\ln': 'ln',
  '\\log': 'log',
  '\\exp': 'exp',
  '\\lim': 'lim',
  '\\max': 'max',
  '\\min': 'min',
};

/**
 * Extrait le contenu entre accolades { ... } en respectant l'imbrication
 */
function extractBracedGroup(input: string, startIndex: number): { content: string; nextIndex: number } | null {
  let i = startIndex;
  while (i < input.length && /\s/.test(input[i])) i++;
  if (i >= input.length || input[i] !== '{') return null;

  let depth = 0;
  const contentStart = i + 1;
  for (; i < input.length; i++) {
    if (input[i] === '\\' && i + 1 < input.length) {
      i++; // Ignore escaped character
      continue;
    }
    if (input[i] === '{') depth++;
    else if (input[i] === '}') {
      depth--;
      if (depth === 0) {
        return {
          content: input.slice(contentStart, i),
          nextIndex: i + 1,
        };
      }
    }
  }
  // Si accolade non fermée, prend jusqu'à la fin
  return {
    content: input.slice(contentStart),
    nextIndex: input.length,
  };
}

/**
 * Supprime tout encadrement \boxed{...} en conservant la formule complète
 */
function unwrapBoxedLatex(input: string): string {
  if (!input) return '';
  let result = input;
  let guard = 0;
  while (result.includes('\\boxed') && guard < 10) {
    guard++;
    const idx = result.indexOf('\\boxed');
    if (idx === -1) break;
    const group = extractBracedGroup(result, idx + 6);
    if (group) {
      result = result.slice(0, idx) + group.content + result.slice(group.nextIndex);
    } else {
      result = result.replace('\\boxed', '');
    }
  }
  return result;
}

/**
 * Extrait un argument optionnel entre crochets [ ... ] (ex: \sqrt[3]{x})
 */
function extractBracketGroup(input: string, startIndex: number): { content: string; nextIndex: number } | null {
  let i = startIndex;
  while (i < input.length && /\s/.test(input[i])) i++;
  if (i >= input.length || input[i] !== '[') return null;

  let depth = 0;
  const contentStart = i + 1;
  for (; i < input.length; i++) {
    if (input[i] === '[') depth++;
    else if (input[i] === ']') {
      depth--;
      if (depth === 0) {
        return {
          content: input.slice(contentStart, i),
          nextIndex: i + 1,
        };
      }
    }
  }
  return null;
}

/**
 * Pré-normalise le contenu Markdown + LaTeX pour que les blocs multi-lignes $$...$$
 * et les environnements \[...\], \(...\), \begin{aligned} soient uniformisés.
 */
function normalizeMathInMarkdown(rawContent: string): string {
  if (!rawContent) return '';

  let text = rawContent
    // Normalise \[ ... \] en $$ ... $$
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `\n$$${inner.trim()}$$\n`)
    // Normalise \( ... \) en $ ... $
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$${inner.trim()}$`);

  // Regroupe les blocs $$ ... $$ multi-lignes en une ou plusieurs lignes $$ ... $$ propres
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner) => {
    const cleanedInner = inner
      .replace(/\\begin\{(aligned|align\*?|cases|array|matrix|pmatrix|bmatrix)\}/g, '')
      .replace(/\\end\{(aligned|align\*?|cases|array|matrix|pmatrix|bmatrix)\}/g, '')
      .replace(/&/g, ' ')
      .trim();

    // Si le bloc contient des sauts de ligne LaTeX (\\), on crée un bloc $$ par ligne d'équation
    const subEquations = cleanedInner
      .split(/\\\\|\n+/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    if (subEquations.length <= 1) {
      return `\n$$${cleanedInner.replace(/\s+/g, ' ')}$$\n`;
    }
    return '\n' + subEquations.map((eq: string) => `$$${eq}$$`).join('\n') + '\n';
  });

  return text;
}

/**
 * Convertit une expression LaTeX en texte mathématique Unicode lisible (pour titres ou fallback)
 */
export function latexToReadableMath(latex: string): string {
  if (!latex) return '';
  let s = latex.trim();

  // Supprime les délimiteurs $ éventuels
  if (s.startsWith('$$') && s.endsWith('$$')) s = s.slice(2, -2).trim();
  else if (s.startsWith('$') && s.endsWith('$')) s = s.slice(1, -1).trim();

  // Déballe \boxed{...}, \text{...}, \mathrm{...}, \mathbf{...}
  let prev = '';
  let guard = 0;
  while (s !== prev && guard < 12) {
    prev = s;
    guard++;
    s = s
      .replace(/\\boxed\s*\{([^{}]*)\}/g, '$1')
      .replace(/\\(?:text|mathrm|mathbf|textbf|textit|mathit|mathsf|operatorname|unit)\s*\{([^{}]*)\}/g, '$1')
      .replace(/\\(?:vec|overrightarrow)\s*\{([^{}]*)\}/g, '$1\u20D7')
      .replace(/\\dot\s*\{([^{}]*)\}/g, '$1\u0307')
      .replace(/\\ddot\s*\{([^{}]*)\}/g, '$1\u0308')
      .replace(/\\bar\s*\{([^{}]*)\}/g, '$1\u0304')
      .replace(/\\hat\s*\{([^{}]*)\}/g, '$1\u0302')
      .replace(/\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_m, n, d) => {
        const num = n.trim();
        const den = d.trim();
        const numStr = /[+\-]/.test(num) ? `(${num})` : num;
        const denStr = /[+\-·×/\s]/.test(den) ? `(${den})` : den;
        return `${numStr}/${denStr}`;
      })
      .replace(/\\sqrt\s*\[([^\[\]]*)\]\s*\{([^{}]*)\}/g, '($2)^(1/$1)')
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
  }

  // Remplace \left et \right
  s = s
    .replace(/\\left\s*([()[\]{}|.])/g, (_m, ch) => (ch === '.' ? '' : ch))
    .replace(/\\right\s*([()[\]{}|.])/g, (_m, ch) => (ch === '.' ? '' : ch))
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\:/g, ' ')
    .replace(/\\!/g, '')
    .replace(/\\quad/g, '  ')
    .replace(/\\qquad/g, '    ')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\\_/g, '_')
    .replace(/\\%/g, '%');

  // Remplace les commandes LaTeX par leurs symboles Unicode (triées par longueur décroissante)
  const sortedKeys = Object.keys(LATEX_SYMBOLS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    s = s.split(key).join(LATEX_SYMBOLS[key]);
  }

  // Convertit les exposants et indices simples en Unicode ou notation propre
  const supMap: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ',
  };
  const subMap: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'i': 'ᵢ', 'r': 'ᵣ', 'u': 'ᵤ', 'v': 'ᵥ',
  };

  s = s.replace(/\^\{([^{}]+)\}/g, (_m, exp) => {
    const chars = exp.trim().split('');
    if (chars.every((c: string) => supMap[c])) {
      return chars.map((c: string) => supMap[c]).join('');
    }
    return `^(${exp.trim()})`;
  });

  s = s.replace(/\^([0-9+\-n])/g, (_m, exp) => supMap[exp] || `^${exp}`);

  s = s.replace(/_\{([^{}]+)\}/g, (_m, sub) => {
    const chars = sub.trim().split('');
    if (chars.every((c: string) => subMap[c])) {
      return chars.map((c: string) => subMap[c]).join('');
    }
    return `_${sub.trim()}`;
  });

  s = s.replace(/_([0-9a-zA-Z])/g, (_m, sub) => subMap[sub] || `_${sub}`);

  // Nettoie les accolades résiduelles et commandes inconnues éventuelles
  s = s
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return s;
}

// =============================================================================
// COMPILATEUR LATEX -> ÉQUATIONS WORD NATIVES (OMML / docx.Math)
// =============================================================================

type DocxMathComponent =
  | MathRun
  | MathFraction
  | MathRadical
  | MathSubScript
  | MathSuperScript
  | MathSubSuperScript;

/**
 * Crée un MathRun Word natif en gras (style: 'bold')
 */
function createBoldMathRun(text: string): MathRun {
  return new MathRun({ text, style: 'bold' });
}

/**
 * Parse un groupe ou atome unique (pour indice, exposant, numérateur, etc.)
 */
function parseNextMathAtom(input: string, startIndex: number): { nodes: DocxMathComponent[]; nextIndex: number } {
  let i = startIndex;
  while (i < input.length && /\s/.test(input[i])) i++;
  if (i >= input.length) return { nodes: [], nextIndex: i };

  // Groupe entre accolades { ... }
  if (input[i] === '{') {
    const group = extractBracedGroup(input, i);
    if (group) {
      return {
        nodes: parseLatexToDocxMathNodes(group.content),
        nextIndex: group.nextIndex,
      };
    }
  }

  // Commande LaTeX \...
  if (input[i] === '\\') {
    // Cas d'échappement ponctuel (\{, \}, \_, \%, \, , \; , \:)
    const nextChar = input[i + 1] || '';
    if (['{', '}', '_', '%', '#', '&'].includes(nextChar)) {
      return { nodes: [createBoldMathRun(nextChar)], nextIndex: i + 2 };
    }
    if ([',', ';', ':', ' '].includes(nextChar)) {
      return { nodes: [createBoldMathRun(' ')], nextIndex: i + 2 };
    }
    if (nextChar === '!') {
      return { nodes: [], nextIndex: i + 2 };
    }

    const cmdMatch = input.slice(i).match(/^\\([a-zA-Z]+)/);
    if (cmdMatch) {
      const fullCmd = cmdMatch[0];
      const cmdName = cmdMatch[1];
      let cursor = i + fullCmd.length;

      // \left et \right
      if (cmdName === 'left' || cmdName === 'right') {
        while (cursor < input.length && /\s/.test(input[cursor])) cursor++;
        if (input.slice(cursor).startsWith('\\{')) {
          return { nodes: [createBoldMathRun('{')], nextIndex: cursor + 2 };
        }
        if (input.slice(cursor).startsWith('\\}')) {
          return { nodes: [createBoldMathRun('}')], nextIndex: cursor + 2 };
        }
        const delim = input[cursor] || '';
        if (delim === '.') return { nodes: [], nextIndex: cursor + 1 };
        return { nodes: [createBoldMathRun(delim)], nextIndex: cursor + 1 };
      }

      // Fractions : \frac{num}{den}, \dfrac{num}{den}, \tfrac{num}{den}
      if (cmdName === 'frac' || cmdName === 'dfrac' || cmdName === 'tfrac') {
        const numGroup = extractBracedGroup(input, cursor);
        if (numGroup) {
          const denGroup = extractBracedGroup(input, numGroup.nextIndex);
          if (denGroup) {
            const numNodes = parseLatexToDocxMathNodes(numGroup.content);
            const denNodes = parseLatexToDocxMathNodes(denGroup.content);
            return {
              nodes: [
                new MathFraction({
                  numerator: numNodes.length > 0 ? numNodes : [createBoldMathRun('1')],
                  denominator: denNodes.length > 0 ? denNodes : [createBoldMathRun('1')],
                }),
              ],
              nextIndex: denGroup.nextIndex,
            };
          }
        }
      }

      // Racine carrée ou n-ième : \sqrt[n]{x} ou \sqrt{x}
      if (cmdName === 'sqrt') {
        const degGroup = extractBracketGroup(input, cursor);
        const radStart = degGroup ? degGroup.nextIndex : cursor;
        const radGroup = extractBracedGroup(input, radStart);
        if (radGroup) {
          const radNodes = parseLatexToDocxMathNodes(radGroup.content);
          const degNodes = degGroup ? parseLatexToDocxMathNodes(degGroup.content) : undefined;
          return {
            nodes: [
              new MathRadical({
                children: radNodes.length > 0 ? radNodes : [createBoldMathRun(' ')],
                degree: degNodes && degNodes.length > 0 ? degNodes : undefined,
              }),
            ],
            nextIndex: radGroup.nextIndex,
          };
        }
      }

      // Vecteurs et accents : \vec{F}, \overrightarrow{AB}, \dot{\theta}, \ddot{\theta}, \bar{x}, \hat{u}
      if (cmdName === 'vec' || cmdName === 'overrightarrow') {
        const argGroup = extractBracedGroup(input, cursor);
        if (argGroup) {
          const innerText = latexToReadableMath(argGroup.content);
          return {
            nodes: [createBoldMathRun(`${innerText}\u20D7`)],
            nextIndex: argGroup.nextIndex,
          };
        }
      }
      if (cmdName === 'dot') {
        const argGroup = extractBracedGroup(input, cursor);
        if (argGroup) {
          const innerText = latexToReadableMath(argGroup.content);
          return {
            nodes: [createBoldMathRun(`${innerText}\u0307`)],
            nextIndex: argGroup.nextIndex,
          };
        }
      }
      if (cmdName === 'ddot') {
        const argGroup = extractBracedGroup(input, cursor);
        if (argGroup) {
          const innerText = latexToReadableMath(argGroup.content);
          return {
            nodes: [createBoldMathRun(`${innerText}\u0308`)],
            nextIndex: argGroup.nextIndex,
          };
        }
      }
      if (cmdName === 'bar' || cmdName === 'overline') {
        const argGroup = extractBracedGroup(input, cursor);
        if (argGroup) {
          const innerText = latexToReadableMath(argGroup.content);
          return {
            nodes: [createBoldMathRun(`${innerText}\u0304`)],
            nextIndex: argGroup.nextIndex,
          };
        }
      }
      if (cmdName === 'hat') {
        const argGroup = extractBracedGroup(input, cursor);
        if (argGroup) {
          const innerText = latexToReadableMath(argGroup.content);
          return {
            nodes: [createBoldMathRun(`${innerText}\u0302`)],
            nextIndex: argGroup.nextIndex,
          };
        }
      }

      // Conteneurs de texte ou d'encadrement : \text{...}, \mathrm{...}, \mathbf{...}, \boxed{...}
      if (
        ['text', 'mathrm', 'mathbf', 'textbf', 'textit', 'mathit', 'mathsf', 'operatorname', 'unit', 'boxed'].includes(
          cmdName
        )
      ) {
        const argGroup = extractBracedGroup(input, cursor);
        if (argGroup) {
          if (cmdName === 'boxed') {
            return {
              nodes: parseLatexToDocxMathNodes(argGroup.content),
              nextIndex: argGroup.nextIndex,
            };
          }
          const cleanStr = latexToReadableMath(argGroup.content);
          return {
            nodes: [createBoldMathRun(cleanStr)],
            nextIndex: argGroup.nextIndex,
          };
        }
      }

      // Espacements : \quad, \qquad
      if (cmdName === 'quad') return { nodes: [createBoldMathRun('  ')], nextIndex: cursor };
      if (cmdName === 'qquad') return { nodes: [createBoldMathRun('    ')], nextIndex: cursor };

      // Symbole connu dans LATEX_SYMBOLS
      if (LATEX_SYMBOLS[fullCmd]) {
        return {
          nodes: [createBoldMathRun(LATEX_SYMBOLS[fullCmd])],
          nextIndex: cursor,
        };
      }

      // Commande non reconnue : on garde le nom propre si pertinent ou on l'ignore
      return {
        nodes: [],
        nextIndex: cursor,
      };
    }
  }

  // Caractère ordinaire (chiffre, lettre, signe +, -, =, parenthèse)
  const ch = input[i];
  return {
    nodes: [createBoldMathRun(ch)],
    nextIndex: i + 1,
  };
}

/**
 * Convertit une chaîne LaTeX complète en tableau de composants natifs docx.Math en gras
 */
function parseLatexToDocxMathNodes(latex: string): DocxMathComponent[] {
  const result: DocxMathComponent[] = [];
  const trimmed = unwrapBoxedLatex(latex.trim());
  let i = 0;

  while (i < trimmed.length) {
    // Préserve un espace lisible autour des opérateurs si nécessaire
    if (/\s/.test(trimmed[i])) {
      while (i < trimmed.length && /\s/.test(trimmed[i])) i++;
      continue;
    }

    const atom = parseNextMathAtom(trimmed, i);
    i = atom.nextIndex;
    if (atom.nodes.length === 0) continue;

    // Vérifie si cet atome est immédiatement suivi d'un indice (_) et/ou d'un exposant (^)
    while (i < trimmed.length && /\s/.test(trimmed[i])) i++;

    let subNodes: DocxMathComponent[] | null = null;
    let supNodes: DocxMathComponent[] | null = null;

    // Lecture en boucle de _ et ^ (dans n'importe quel ordre : x_a^b ou x^b_a)
    for (let pass = 0; pass < 2; pass++) {
      while (i < trimmed.length && /\s/.test(trimmed[i])) i++;
      if (i < trimmed.length && trimmed[i] === '_' && !subNodes) {
        const subAtom = parseNextMathAtom(trimmed, i + 1);
        subNodes = subAtom.nodes.length > 0 ? subAtom.nodes : [createBoldMathRun(' ')];
        i = subAtom.nextIndex;
      } else if (i < trimmed.length && trimmed[i] === '^' && !supNodes) {
        const supAtom = parseNextMathAtom(trimmed, i + 1);
        supNodes = supAtom.nodes.length > 0 ? supAtom.nodes : [createBoldMathRun(' ')];
        i = supAtom.nextIndex;
      }
    }

    if (subNodes && supNodes) {
      result.push(
        new MathSubSuperScript({
          children: atom.nodes,
          subScript: subNodes,
          superScript: supNodes,
        })
      );
    } else if (subNodes) {
      result.push(
        new MathSubScript({
          children: atom.nodes,
          subScript: subNodes,
        })
      );
    } else if (supNodes) {
      result.push(
        new MathSuperScript({
          children: atom.nodes,
          superScript: supNodes,
        })
      );
    } else {
      result.push(...atom.nodes);
    }
  }

  return result.length > 0 ? result : [createBoldMathRun(latexToReadableMath(latex))];
}

/**
 * Construit un objet natif Word `DocxMath` en gras à partir d'une chaîne LaTeX
 */
function buildDocxMath(latex: string): DocxMath {
  try {
    const nodes = parseLatexToDocxMathNodes(latex);
    return new DocxMath({
      children: nodes,
    });
  } catch {
    return new DocxMath({
      children: [createBoldMathRun(latexToReadableMath(latex))],
    });
  }
}

/**
 * Déclenche le téléchargement d'un Blob dans le navigateur
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =============================================================================
// 1. EXPORTATION EN DOCUMENT WORD (.DOCX) AVEC ÉQUATIONS OMML NATIVES
// =============================================================================

/**
 * Analyse une ligne contenant du texte, du gras (**...**), de l'italique (*...*)
 * et des formules mathématiques ($...$) pour produire des TextRun et DocxMath natifs.
 */
function parseDocxParagraphChildren(rawText: string): (TextRun | DocxMath)[] {
  const children: (TextRun | DocxMath)[] = [];
  // Découpe les formules $...$ d'abord
  const mathRegex = /(\$\$[\s\S]*?\$\$|\$[^$]+?\$)/g;
  const segments = rawText.split(mathRegex);

  for (const segment of segments) {
    if (!segment) continue;

    if (
      (segment.startsWith('$$') && segment.endsWith('$$') && segment.length > 4) ||
      (segment.startsWith('$') && segment.endsWith('$') && segment.length > 2)
    ) {
      const rawLatex = segment.startsWith('$$') ? segment.slice(2, -2).trim() : segment.slice(1, -1).trim();
      children.push(buildDocxMath(rawLatex));
      continue;
    }

    // Sinon, c'est du texte Markdown : on gère **gras** et `code`
    const formatRegex = /(\*\*.*?\*\*|`[^`]+`)/g;
    const textParts = segment.split(formatRegex);

    for (const part of textParts) {
      if (!part) continue;
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        const inner = part.slice(2, -2);
        children.push(
          new TextRun({
            text: inner.includes('\\') ? latexToReadableMath(inner) : inner,
            bold: true,
            font: 'Calibri',
            size: 22,
          })
        );
      } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        const inner = part.slice(1, -1);
        children.push(
          new TextRun({
            text: inner.includes('\\') ? latexToReadableMath(inner) : inner,
            bold: true,
            color: '0369A1',
            font: 'Cambria Math',
            size: 22,
          })
        );
      } else {
        // Si un fragment de texte contient des commandes LaTeX orphelines sans $, on les convertit proprement
        const cleanText = /\\[a-zA-Z]{2,}/.test(part) ? latexToReadableMath(part) : part;
        children.push(
          new TextRun({
            text: cleanText,
            font: 'Calibri',
            size: 22,
          })
        );
      }
    }
  }

  return children.length > 0 ? children : [new TextRun({ text: latexToReadableMath(rawText), font: 'Calibri', size: 22 })];
}

/**
 * Génère un document Word (.docx) structuré avec de véritables équations Word (OMML)
 */
export async function exportToDocx(options: ExportOptions): Promise<void> {
  const branchName = options.branch === 'SM' ? 'Sciences Mathématiques (SM)' : 'Sciences Physiques (PC)';
  const dateStr =
    options.date ||
    new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  const docTitle = latexToReadableMath(
    options.title || `Résolution Physique-Chimie 2ème Bac ${options.branch || 'PC'}`
  );

  const paragraphs: (Paragraph | Table)[] = [];

  // En-tête officiel
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: "ROYAUME DU MAROC — MINISTÈRE DE L'ÉDUCATION NATIONALE",
          size: 18,
          color: '64748B',
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: `BACCALAURÉAT NATIONAL (BIOF) — FILIÈRE 2ÈME BAC ${options.branch === 'SM' ? 'SM' : 'PC'}`,
          bold: true,
          size: 21,
          color: '1E3A8A',
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [
        new TextRun({
          text: docTitle,
          bold: true,
          size: 30,
          color: '0F172A',
          font: 'Calibri',
        }),
      ],
    })
  );

  // Cartouche d'informations
  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: { fill: 'F8FAFC', type: ShadingType.CLEAR, color: 'auto' },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 40 },
                children: [
                  new TextRun({ text: 'Professeur / Coach : ', bold: true, size: 20, font: 'Calibri' }),
                  new TextRun({ text: 'Si Driss (BIOF Maroc)', size: 20, font: 'Calibri' }),
                ],
              }),
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({ text: 'Filière : ', bold: true, size: 20, font: 'Calibri' }),
                  new TextRun({ text: branchName, size: 20, font: 'Calibri' }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: { fill: 'F8FAFC', type: ShadingType.CLEAR, color: 'auto' },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 40 },
                children: [
                  new TextRun({ text: 'Date : ', bold: true, size: 20, font: 'Calibri' }),
                  new TextRun({ text: dateStr, size: 20, font: 'Calibri' }),
                ],
              }),
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({ text: 'Cadre de référence : ', bold: true, size: 20, font: 'Calibri' }),
                  new TextRun({ text: 'Session Officielle 2ème Bac', size: 20, font: 'Calibri' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  paragraphs.push(infoTable);
  paragraphs.push(new Paragraph({ spacing: { after: 260 }, children: [] }));

  // Normalisation préalable des blocs mathématiques multi-lignes
  const normalizedContent = normalizeMathInMarkdown(options.content);
  const rawLines = normalizedContent.split('\n');

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line || line === '---' || line === '***') {
      paragraphs.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      continue;
    }

    // Titres Markdown (avec support des formules dans les titres !)
    if (line.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 260, after: 120 },
          children: parseDocxParagraphChildren(line.replace(/^#\s+/, '').trim()),
        })
      );
    } else if (line.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 220, after: 100 },
          children: parseDocxParagraphChildren(line.replace(/^##\s+/, '').trim()),
        })
      );
    } else if (line.startsWith('### ') || line.startsWith('#### ')) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 180, after: 80 },
          children: parseDocxParagraphChildren(line.replace(/^#{3,4}\s+/, '').trim()),
        })
      );
    } else if (line.startsWith('$$') && line.endsWith('$$') && line.length > 4) {
      // Bloc d'équation majeure centrée en gras SANS cadre contraignant
      const eqLatex = unwrapBoxedLatex(line.slice(2, -2).trim());
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 240 },
          children: [buildDocxMath(eqLatex)],
        })
      );
    } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      // Liste à puces
      const bulletText = line.replace(/^([-*•])\s+/, '').trim();
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: parseDocxParagraphChildren(bulletText),
          spacing: { after: 100 },
        })
      );
    } else if (/^\d+\.\s/.test(line)) {
      // Liste numérotée
      const textWithoutNum = line.replace(/^\d+\.\s*/, '').trim();
      const numMatch = line.match(/^\d+/);
      const num = numMatch ? numMatch[0] : '1';
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${num}. `, bold: true, color: '1E3A8A', font: 'Calibri', size: 22 }),
            ...parseDocxParagraphChildren(textWithoutNum),
          ],
          spacing: { after: 110 },
        })
      );
    } else {
      // Paragraphe classique avec formules mathématiques natives intégrées
      paragraphs.push(
        new Paragraph({
          children: parseDocxParagraphChildren(line),
          spacing: { after: 130 },
          alignment: AlignmentType.JUSTIFIED,
        })
      );
    }
  }

  // Pied de page / signature de Si Driss
  paragraphs.push(
    new Paragraph({ spacing: { before: 360 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: '— Corrigé officiel généré par Si Driss (2ème Bac BIOF Maroc)',
          italics: true,
          size: 18,
          color: '64748B',
          font: 'Calibri',
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanFilename = (options.title || 'corrigé_si_driss')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 40);
  downloadBlob(blob, `${cleanFilename}.docx`);
}

// =============================================================================
// 2. EXPORTATION EN DOCUMENT PDF (.PDF) AVEC RENDU MATHÉMATIQUE KATEX HAUTE DÉFINITION
// =============================================================================

/**
 * Échappe les caractères HTML spéciaux
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convertit un segment contenant du Markdown (**gras**, *italique*, `code`) et des formules `$...$`
 * en HTML avec rendu mathématique KaTeX authentique.
 */
function renderInlineMarkdownAndMathToHtml(rawText: string): string {
  if (!rawText) return '';

  const mathRegex = /(\$\$[\s\S]*?\$\$|\$[^$]+?\$)/g;
  const parts = rawText.split(mathRegex);

  return parts
    .map((part) => {
      if (!part) return '';

      if (
        (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) ||
        (part.startsWith('$') && part.endsWith('$') && part.length > 2)
      ) {
        const isDisplay = part.startsWith('$$');
        const latexCode = unwrapBoxedLatex((isDisplay ? part.slice(2, -2) : part.slice(1, -1)).trim());
        try {
          const rendered = katex.renderToString(latexCode, {
            displayMode: isDisplay,
            throwOnError: false,
            strict: false,
            macros: { '\\boxed': '#1', '\\unit': '\\text{#1}', '\\pu': '\\text{#1}', '\\si': '\\text{#1}' },
          });
          return `<strong class="math-bold">${rendered}</strong>`;
        } catch {
          return `<strong class="math-fallback">${escapeHtml(latexToReadableMath(latexCode))}</strong>`;
        }
      }

      // Si le texte hors $ contient malgré tout une formule LaTeX oubliée (ex: \tau, \frac{...})
      let processedText = part;
      if (/\\(frac|dfrac|sqrt|vec|sum|int|tau|omega|Omega|Delta|lambda|pi|theta|alpha|beta|cdot|times|rightleftharpoons)/.test(processedText)) {
        try {
          processedText = latexToReadableMath(processedText);
        } catch {
          // ignore
        }
      }

      let safe = escapeHtml(processedText);
      // Gras **...**
      safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Italique *...*
      safe = safe.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // Code inline `...`
      safe = safe.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
      return safe;
    })
    .join('');
}

/**
 * Génère un PDF A4 haute résolution où chaque formule mathématique est rendue avec KaTeX
 * dans un conteneur isolé (sans conflit CSS oklch) et découpé intelligemment bloc par bloc.
 */
export async function exportToPdf(options: ExportOptions): Promise<void> {
  const branchName =
    options.branch === 'SM' ? '2ème Bac SM (Sciences Mathématiques)' : '2ème Bac PC (Sciences Physiques)';
  const dateStr =
    options.date ||
    new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  const docTitle = latexToReadableMath(options.title || `Résolution Physique-Chimie — ${options.branch || 'PC'}`);
  const cleanFilename = (options.title || 'corrige_si_driss')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 40);

  const normalizedContent = normalizeMathInMarkdown(options.content);
  const rawLines = normalizedContent.split('\n');

  // Construction des blocs HTML individuels (.pdf-block) pour éviter toute coupure d'équation entre 2 pages
  const htmlBlocks: string[] = [];

  // Cartouche d'en-tête officiel sur la 1ère page
  htmlBlocks.push(`
    <div class="pdf-block header-banner">
      <div class="header-top">ROYAUME DU MAROC — MINISTÈRE DE L'ÉDUCATION NATIONALE — BACCALAURÉAT BIOF</div>
      <div class="header-title">${escapeHtml(docTitle)}</div>
      <div class="header-meta">
        <span><strong>Filière :</strong> ${escapeHtml(branchName)}</span>
        <span>•</span>
        <span><strong>Date :</strong> ${escapeHtml(dateStr)}</span>
        <span>•</span>
        <span><strong>Professeur :</strong> Si Driss</span>
      </div>
    </div>
  `);

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i].trim();
    if (!rawLine) continue;

    if (rawLine === '---' || rawLine === '***') {
      htmlBlocks.push(`<div class="pdf-block divider"></div>`);
      continue;
    }

    if (rawLine.startsWith('# ')) {
      const inner = renderInlineMarkdownAndMathToHtml(rawLine.replace(/^#\s+/, '').trim());
      htmlBlocks.push(`<div class="pdf-block h1-block">${inner}</div>`);
      continue;
    }

    if (rawLine.startsWith('## ')) {
      const inner = renderInlineMarkdownAndMathToHtml(rawLine.replace(/^##\s+/, '').trim());
      htmlBlocks.push(`<div class="pdf-block h2-block">${inner}</div>`);
      continue;
    }

    if (rawLine.startsWith('### ') || rawLine.startsWith('#### ')) {
      const inner = renderInlineMarkdownAndMathToHtml(rawLine.replace(/^#{3,4}\s+/, '').trim());
      htmlBlocks.push(`<div class="pdf-block h3-block">${inner}</div>`);
      continue;
    }

    if (rawLine.startsWith('$$') && rawLine.endsWith('$$') && rawLine.length > 4) {
      const eqLatex = unwrapBoxedLatex(rawLine.slice(2, -2).trim());
      let renderedEq = '';
      try {
        renderedEq = katex.renderToString(eqLatex, {
          displayMode: true,
          throwOnError: false,
          strict: false,
          macros: { '\\boxed': '#1', '\\unit': '\\text{#1}', '\\pu': '\\text{#1}', '\\si': '\\text{#1}' },
        });
      } catch {
        renderedEq = `<div class="math-fallback"><strong>${escapeHtml(latexToReadableMath(eqLatex))}</strong></div>`;
      }
      htmlBlocks.push(`<div class="pdf-block eq-block">${renderedEq}</div>`);
      continue;
    }

    if (rawLine.startsWith('- ') || rawLine.startsWith('* ') || rawLine.startsWith('• ')) {
      const bulletContent = renderInlineMarkdownAndMathToHtml(rawLine.replace(/^([-*•])\s+/, '').trim());
      htmlBlocks.push(`
        <div class="pdf-block list-block">
          <span class="bullet-dot">•</span>
          <div class="list-text">${bulletContent}</div>
        </div>
      `);
      continue;
    }

    if (/^\d+\.\s/.test(rawLine)) {
      const match = rawLine.match(/^(\d+\.)\s*(.*)/);
      const numLabel = match ? match[1] : '1.';
      const itemContent = renderInlineMarkdownAndMathToHtml(match ? match[2] : rawLine);
      htmlBlocks.push(`
        <div class="pdf-block list-block">
          <span class="num-label">${escapeHtml(numLabel)}</span>
          <div class="list-text">${itemContent}</div>
        </div>
      `);
      continue;
    }

    const pContent = renderInlineMarkdownAndMathToHtml(rawLine);
    htmlBlocks.push(`<div class="pdf-block p-block">${pContent}</div>`);
  }

  // Signature de fin de document
  htmlBlocks.push(`
    <div class="pdf-block signature-block">
      — Corrigé officiel vérifié par <strong>Si Driss</strong> • Programme National 2ème Bac BIOF Maroc
    </div>
  `);

  // Récupère les règles CSS KaTeX et @font-face déjà chargées dans l'application (en filtrant oklch)
  let extractedKatexCss = '';
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = sheet.cssRules || [];
        for (const rule of Array.from(rules)) {
          const text = rule.cssText || '';
          if ((text.includes('katex') || text.includes('KaTeX')) && !text.includes('oklch')) {
            extractedKatexCss += text + '\n';
          }
        }
      } catch {
        // Ignore cross-origin stylesheet access errors
      }
    }
  } catch {
    // Ignore
  }

  // Création d'un iframe hors-écran isolé pour garantir un rendu KaTeX parfait sans interférence CSS oklch()
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '794px';
  iframe.style.height = '1123px';
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error('Impossible d initialiser le moteur de rendu PDF.');

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css" crossorigin="anonymous" />
        <style>
          ${extractedKatexCss}
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            width: 714px;
            margin: 0 auto;
            padding: 12px 0;
            background-color: #ffffff;
            color: #0f172a;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
            font-size: 14px;
            line-height: 1.65;
          }
          .pdf-block {
            width: 100%;
            margin-bottom: 10px;
            background-color: #ffffff;
          }
          .header-banner {
            background-color: #0f172a;
            color: #ffffff;
            padding: 18px 22px;
            border-radius: 10px;
            border-left: 6px solid #f59e0b;
            margin-bottom: 18px;
          }
          .header-top {
            color: #f59e0b;
            font-size: 10.5px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .header-title {
            color: #ffffff;
            font-size: 19px;
            font-weight: 800;
            line-height: 1.3;
            margin-bottom: 8px;
          }
          .header-meta {
            color: #cbd5e1;
            font-size: 11.5px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .h1-block {
            font-size: 17px;
            font-weight: 800;
            color: #0f172a;
            padding-top: 10px;
            padding-bottom: 6px;
            border-bottom: 2px solid #f59e0b;
            margin-top: 8px;
            margin-bottom: 12px;
          }
          .h2-block {
            font-size: 15.5px;
            font-weight: 700;
            color: #1e3a8a;
            padding-top: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid #dbeafe;
            margin-top: 6px;
            margin-bottom: 10px;
          }
          .h3-block {
            font-size: 14.5px;
            font-weight: 700;
            color: #334155;
            padding-top: 6px;
            margin-bottom: 6px;
          }
          .p-block {
            color: #1e293b;
            text-align: justify;
            margin-bottom: 9px;
          }
          .list-block {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            margin-bottom: 8px;
            padding-left: 4px;
          }
          .bullet-dot {
            color: #d97706;
            font-weight: 800;
            font-size: 16px;
            line-height: 1.4;
            flex-shrink: 0;
          }
          .num-label {
            color: #1e3a8a;
            font-weight: 700;
            min-width: 20px;
            flex-shrink: 0;
          }
          .list-text {
            flex: 1;
            color: #1e293b;
          }
          .eq-block {
            padding: 16px 8px;
            margin: 14px 0;
            text-align: center;
            overflow: visible !important;
            line-height: 2.2;
            font-weight: 700;
          }
          .math-bold,
          .math-fallback {
            font-weight: 700 !important;
          }
          .divider {
            height: 1px;
            background-color: #e2e8f0;
            margin: 14px 0;
          }
          .inline-code {
            font-family: monospace;
            background-color: #f1f5f9;
            color: #0369a1;
            padding: 1px 5px;
            border-radius: 4px;
            font-size: 0.92em;
          }
          .signature-block {
            margin-top: 22px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            text-align: right;
            font-size: 11.5px;
            color: #64748b;
            font-style: italic;
          }
          /* Ajustements KaTeX sur fond blanc académique : en gras, sans aucun cadre, hauteur libre */
          .katex,
          .katex * {
            font-weight: 700 !important;
            color: #0f172a !important;
          }
          .katex {
            font-size: 1.1em !important;
            line-height: 1.8 !important;
          }
          .eq-block .katex {
            font-size: 1.22em !important;
            color: #0f172a !important;
          }
          .katex .fbox,
          .katex .boxed {
            border: none !important;
            padding: 0 !important;
            background: transparent !important;
          }
          .katex-display {
            margin: 0 !important;
            padding: 10px 0 !important;
            overflow: visible !important;
          }
        </style>
      </head>
      <body>
        <div id="pdf-root">${htmlBlocks.join('\n')}</div>
        <div id="pdf-stage"></div>
      </body>
      </html>
    `);
    iframeDoc.close();

    // Attend que la feuille de style KaTeX et les polices soient prêtes
    await new Promise<void>((resolve) => {
      const checkReady = () => {
        if (iframeDoc.fonts && iframeDoc.fonts.ready) {
          iframeDoc.fonts.ready.then(() => setTimeout(resolve, 120)).catch(() => setTimeout(resolve, 120));
        } else {
          setTimeout(resolve, 250);
        }
      };
      if (iframeDoc.readyState === 'complete') {
        checkReady();
      } else {
        iframe.onload = checkReady;
        setTimeout(checkReady, 400);
      }
    });

    const rootEl = iframeDoc.getElementById('pdf-root');
    const stageEl = iframeDoc.getElementById('pdf-stage');
    if (!rootEl || !stageEl) throw new Error('Conteneur PDF introuvable.');

    const blockEls = Array.from(rootEl.querySelectorAll('.pdf-block')) as HTMLElement[];

    // Dimensions A4 en mm : 210 x 297
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const marginX = 14;
    const headerHeightMm = 13;
    const footerHeightMm = 12;
    const usableWidthMm = pageWidthMm - marginX * 2; // 182 mm
    const usableHeightMm = pageHeightMm - headerHeightMm - footerHeightMm; // 272 mm

    // Regroupe les blocs HTML en pages afin qu'aucune formule ou ligne ne soit coupée en deux
    const containerWidthPx = 714;
    const pxPerMm = containerWidthPx / usableWidthMm;
    const maxPageHeightPx = Math.floor(usableHeightMm * pxPerMm);

    const pagesBlocks: HTMLElement[][] = [];
    let currentPage: HTMLElement[] = [];
    let currentHeightPx = 0;

    for (const blockEl of blockEls) {
      const blockHeight = Math.max(blockEl.offsetHeight, blockEl.scrollHeight) + 14;
      if (currentPage.length > 0 && currentHeightPx + blockHeight > maxPageHeightPx) {
        pagesBlocks.push(currentPage);
        currentPage = [blockEl];
        currentHeightPx = blockHeight;
      } else {
        currentPage.push(blockEl);
        currentHeightPx += blockHeight;
      }
    }
    if (currentPage.length > 0) {
      pagesBlocks.push(currentPage);
    }

    // Masque le conteneur de mesure initial pendant la capture des pages
    rootEl.style.display = 'none';

    const totalPages = pagesBlocks.length;

    // Rendu page par page à haute résolution (scale: 2)
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      if (pageIdx > 0) {
        pdf.addPage();
      }

      // En-tête vectoriel de page
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Si Driss — Professeur 2ème Bac BIOF Maroc', marginX, 8.5);
      pdf.text(branchName, pageWidthMm - marginX, 8.5, { align: 'right' });
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, 10.5, pageWidthMm - marginX, 10.5);

      // Crée un conteneur de page dédié dans l'iframe
      const pageContainer = iframeDoc.createElement('div');
      pageContainer.style.width = '714px';
      pageContainer.style.backgroundColor = '#ffffff';
      pageContainer.style.padding = '4px 0';

      for (const b of pagesBlocks[pageIdx]) {
        pageContainer.appendChild(b.cloneNode(true));
      }

      stageEl.innerHTML = '';
      stageEl.appendChild(pageContainer);

      const canvas = await html2canvas(pageContainer, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 794,
      });

      // (M16) JPEG qualité 0.92 : fichier beaucoup plus léger que le PNG pour un
      // rendu de texte équivalent, et encodage nettement plus rapide.
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const renderedWidthMm = usableWidthMm;
      const renderedHeightMm = Math.min(
        usableHeightMm,
        (canvas.height / canvas.width) * renderedWidthMm
      );

      pdf.addImage(imgData, 'JPEG', marginX, headerHeightMm, renderedWidthMm, renderedHeightMm);

      // (M16) Progression visible + rend la main au thread principal entre chaque
      // page pour ne pas geler l'interface pendant l'export.
      options.onProgress?.(pageIdx + 1, totalPages);
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Pied de page vectoriel numéroté
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, pageHeightMm - 10, pageWidthMm - marginX, pageHeightMm - 10);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Conforme au Cadre de Référence Officiel — Physique-Chimie', marginX, pageHeightMm - 6);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Page ${pageIdx + 1} / ${totalPages}`, pageWidthMm - marginX, pageHeightMm - 6, {
        align: 'right',
      });
    }

    pdf.save(`${cleanFilename}.pdf`);
  } finally {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }
}
