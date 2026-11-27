const VECTOR_SINGLE_SYMBOLS = new Set([
  'P', 'F', 'R', 'T', 'f', 'v', 'a', 'g', 'E', 'B', 'p', 'i', 'j', 'k', 'u', 'n', 'e',
]);

const FORCE_TERM_CORE_RE = /^(?:P|R|f|T|F)(?:_(?:\{[^{}\n]+\}|[A-Za-z0-9]+))?$/;
const SCALAR_PROJECTION_HINT_RE =
  /_(?:\{?(?:x|y|z|X|Y|Z|0x|0y|0z)\}?|\\text\{[xyz]\})|\\(?:sin|cos|tan)\b|\b(?:m\s*(?:\\cdot\s*)?g|k\s*(?:\\cdot\s*)?v)\b|[0-9]+\s*(?:\\text\{)?(?:N|m\/s|m\s*\\cdot\s*s\^\{-1\}|kg|rad)/;

function addArrowToCore(core: string): string {
  const trimmed = core.trim();
  if (!trimmed || /^\\(?:vec|overrightarrow)\b/.test(trimmed)) return trimmed;
  const subIdx = trimmed.indexOf('_');
  if (subIdx > 0) {
    const base = trimmed.slice(0, subIdx).trim();
    const sub = trimmed.slice(subIdx);
    if (/^[A-Z]{2}$/.test(base)) {
      return `\\overrightarrow{${base}}${sub}`;
    }
    return `\\vec{${base}}${sub}`;
  }
  if (/^[A-Z]{2}$/.test(trimmed)) {
    return `\\overrightarrow{${trimmed}}`;
  }
  return `\\vec{${trimmed}}`;
}

function normalizeEquationClauseVectors(clause: string): string {
  if (!clause.includes('=')) return clause;
  const eqParts = clause.split('=');
  if (eqParts.length < 2) return clause;

  // Vérifie s'il existe des indices clairs de projection scalaire sur un axe
  if (SCALAR_PROJECTION_HINT_RE.test(clause)) {
    return clause;
  }

  // Transforme chaque égalité adjacente LHS = RHS (ex: A = B = C)
  let changed = false;
  for (let i = 0; i < eqParts.length - 1; i++) {
    const lhs = eqParts[i].trim();
    const rhs = eqParts[i + 1].trim();
    if (!lhs || !rhs) continue;

    // Si présence de signe '-' entre termes sur un membre de forces (ex: P - f = ma), c'est une projection algébrique
    const hasForceSubtraction = /(?:^|\s)-\s*(?:\\vec\{)?(?:P|R|f|T|F)\b/.test(lhs);
    if (hasForceSubtraction) continue;

    const alreadyVectorized = /\\(?:vec|overrightarrow)\s*\{|\\sum\s*\\vec\{F\}/.test(`${lhs} = ${rhs}`);

    // Détection d'une somme de forces sans \sum : P + R = 0, P + R + f = m a_G, P + F_A + f = m a, R = R_N + R_T
    const lhsTerms = lhs.split('+').map((t) => t.trim()).filter(Boolean);
    const rhsTerms = rhs.split('+').map((t) => t.trim()).filter(Boolean);

    const isPureForceSumLhs =
      lhsTerms.length >= 2 &&
      lhsTerms.every((t) => {
        const bare = t.replace(/^\\(?:vec|overrightarrow)\s*\{([^{}]+)\}/, '$1');
        return FORCE_TERM_CORE_RE.test(bare);
      });

    const isForceDecompositionRhs =
      /^R(?:_\{?(?:\\text\{)?[A-Za-z]+\}?)?$/.test(lhs.replace(/^\\vec\{R\}/, 'R')) &&
      rhsTerms.length >= 2 &&
      rhsTerms.every((t) => {
        const bare = t.replace(/^\\vec\s*\{([^{}]+)\}/, '$1');
        return /^R_[A-Za-z0-9{}]+$/.test(bare);
      });

    const isVectorRhs =
      /^(?:0|\\vec\s*\{\s*0\s*\}|m\s*(?:\\cdot\s*)?(?:\\vec\s*\{\s*a\s*\}|a)(?:_(?:\{[^{}]+\}|[A-Za-z0-9]+))?|m\s*(?:\\cdot\s*)?\\frac\s*\{\s*d\s*(?:\\vec\s*\{\s*v\s*\}|v)(?:_(?:\{[^{}]+\}|[A-Za-z0-9]+))?\s*\}\s*\{\s*dt\s*\}|\\frac\s*\{\s*d\s*(?:\\vec\s*\{\s*p\s*\}|p)(?:_(?:\{[^{}]+\}|[A-Za-z0-9]+))?\s*\}\s*\{\s*dt\s*\})$/.test(
        rhs
      );
    const isVectorDynamicsLhs =
      /^\\sum\s*\\vec\s*\{\s*F\s*\}/.test(lhs) ||
      (isPureForceSumLhs && (isVectorRhs || alreadyVectorized));

    if (isVectorDynamicsLhs || isForceDecompositionRhs) {
      let nextLhs = lhs;
      if (isPureForceSumLhs || isVectorDynamicsLhs || isForceDecompositionRhs) {
        nextLhs = nextLhs.replace(
          /(?<!\\vec\{)(?<!\\overrightarrow\{)(?<!\\)(?<![A-Za-z_])\b(P|R|f|T|F)(_(?:\{[^{}\n]+\}|[A-Za-z0-9]+))?\b/g,
          (_m, sym: string, sub = '') => `\\vec{${sym}}${sub}`
        );
      }

      let nextRhs = rhs
        .replace(
          /^(m\s*(?:\\cdot\s*)?)(?<!\\vec\{)\b(a|g)(_(?:\{[^{}\n]+\}|[A-Za-z0-9]+))?\b/g,
          (_m, prefix: string, sym: string, sub = '') => `${prefix}\\vec{${sym}}${sub}`
        )
        .replace(
          /^(m\s*(?:\\cdot\s*)?\\frac\s*\{\s*d\s*)(?!\\vec\{)(v)(_(?:\{[^{}\n]+\}|[A-Za-z0-9]+))?(\s*\}\s*\{\s*dt\s*\})/g,
          (_m, p1: string, sym: string, sub = '', p2: string) => `${p1}\\vec{${sym}}${sub}${p2}`
        )
        .replace(
          /^(\\frac\s*\{\s*d\s*)(?!\\vec\{)(p)(_(?:\{[^{}\n]+\}|[A-Za-z0-9]+))?(\s*\}\s*\{\s*dt\s*\})/g,
          (_m, p1: string, sym: string, sub = '', p2: string) => `${p1}\\vec{${sym}}${sub}${p2}`
        )
        .replace(/^0$/, '\\vec{0}');

      if (isForceDecompositionRhs) {
        nextRhs = nextRhs.replace(
          /(?<!\\vec\{)\b(R)(_(?:\{[^{}\n]+\}|[A-Za-z0-9]+))\b/g,
          (_m, sym: string, sub: string) => `\\vec{${sym}}${sub}`
        );
      }

      if (nextLhs !== lhs || nextRhs !== rhs) {
        eqParts[i] = eqParts[i].replace(lhs, nextLhs);
        eqParts[i + 1] = eqParts[i + 1].replace(rhs, nextRhs);
        changed = true;
      }
    }
  }

  return changed ? eqParts.join(' = ').replace(/\s*=\s*/g, ' = ') : clause;
}

/**
 * Filet de sécurité notation vectorielle officielle marocaine (2BAC BIOF) :
 * - Remplace toute notation anglo-saxonne (\mathbf{F}, \boldsymbol{a}, \hat{i}, \vec{\mathbf{F}}) par \vec{...} ou \overrightarrow{...}
 * - Ajoute automatiquement les flèches sur \sum \vec{F}_{\text{ext}}, les moments M_\Delta(\vec{F}),
 *   le travail W(\vec{F}), la force de Lorentz/électrique et les sommes vectorielles de forces avant projection.
 */
export function enforceMoroccanVectorNotation(rawCode: string): string {
  if (!rawCode) return '';
  let code = rawCode;

  // 1. Nettoie les doubles notations \vec{\mathbf{F}} ou \mathbf{\vec{F}} -> \vec{F}
  code = code.replace(
    /\\vec\s*\{\s*\\(?:mathbf|boldsymbol)\s*\{([^{}]+)\}\s*\}/g,
    (_m, inner: string) => addArrowToCore(inner)
  );
  code = code.replace(
    /\\(?:mathbf|boldsymbol)\s*\{\s*\\vec\s*\{([^{}]+)\}\s*\}/g,
    (_m, inner: string) => `\\vec{${inner.trim()}}`
  );

  // 2. Vecteurs anglo-saxons en gras : \mathbf{F}, \mathbf{F_A}, \boldsymbol{a_G}, \mathbf{AB} -> \vec{...} / \overrightarrow{...}
  code = code.replace(
    /\\(?:mathbf|boldsymbol)\s*\{\s*([A-Za-z]+)((?:_(?:\{[^{}\n]+\}|[A-Za-z0-9]+))?)\s*\}/g,
    (full, base: string, sub: string) => {
      if (VECTOR_SINGLE_SYMBOLS.has(base)) {
        return `\\vec{${base}}${sub}`;
      }
      if (/^[A-Z]{2}$/.test(base)) {
        return `\\overrightarrow{${base}}${sub}`;
      }
      return full;
    }
  );

  // 3. Vecteurs unitaires à chapeau anglo-saxons (\hat{i}, \hat{\imath}, \hat{j}, \hat{k}, \hat{u}_r, \hat{n})
  code = code.replace(
    /\\hat\s*\{\s*\\?(i(?:math)?|j(?:math)?|k|u|n|e)\s*\}/g,
    (_m, sym: string) => {
      const clean = sym.startsWith('i') ? 'i' : sym.startsWith('j') ? 'j' : sym;
      return `\\vec{${clean}}`;
    }
  );

  // 4. Somme des forces sans flèche : \sum F, \Sigma F, \sum F_{ext}, \sum F_{\mathrm{ext}}, \sum F_i
  code = code.replace(
    /\\(?:sum|Sigma)\s*F(?![A-Za-z])(\s*(?:_(?:\{[^{}\n]+\}|[A-Za-z0-9]+)))?/g,
    (_m, sub = '') => `\\sum \\vec{F}${sub.trim()}`
  );

  // 5. Moment d'une force & travail d'une force sans flèche sur F
  code = code.replace(
    /(\\mathcal\{M\}|M)_(\\Delta)\(\s*(?<!\\vec\{)(F(?:_(?:\{[^{}\n]+\}|[A-Za-z0-9]+))?)\s*\)/g,
    (_m, mSym: string, delta: string, fSym: string) => `${mSym}_${delta}(${addArrowToCore(fSym)})`
  );
  code = code.replace(
    /\bW(_\{[^{}\n]*\})?\(\s*(?<!\\vec\{)(F(?:_(?:\{[^{}\n]+\}|[A-Za-z0-9]+))?)\s*\)/g,
    (_m, sub = '', fSym: string) => `W${sub}(${addArrowToCore(fSym)})`
  );

  // 6. Force électrique / Force de Lorentz sans flèches
  code = code.replace(
    /(?<!\\vec\{)\b(F(?:_\{?e\}?)?)\s*=\s*q\s*(?:\\cdot\s*)?(?<!\\vec\{)E\b/g,
    (_m, fSym: string) => `${addArrowToCore(fSym)} = q\\vec{E}`
  );
  code = code.replace(
    /(\\vec\{F\}(?:_\{?e\}?)?\s*=\s*q\s*(?:\\cdot\s*)?)(?<!\\vec\{)E\b/g,
    '$1\\vec{E}'
  );
  code = code.replace(
    /(?<!\\vec\{)\b(F(?:_\{?m\}?)?)\s*=\s*q\s*(?:\\cdot\s*)?(?<!\\vec\{)v\s*\\wedge\s*(?<!\\vec\{)B\b/g,
    (_m, fSym: string) => `${addArrowToCore(fSym)} = q\\vec{v} \\wedge \\vec{B}`
  );

  // 7. Mise à niveau équation par équation pour sommes vectorielles (\sum \vec{F} = m a_G, P + R + f = m a_G, P + R = 0)
  const clauseParts = code.split(/(\\iff|\\implies|\\Rightarrow|\\\\|;|,(?=\s))/);
  if (clauseParts.length === 1) {
    code = normalizeEquationClauseVectors(code);
  } else {
    code = clauseParts
      .map((part, idx) => (idx % 2 === 0 ? normalizeEquationClauseVectors(part) : part))
      .join('');
  }

  return code;
}
