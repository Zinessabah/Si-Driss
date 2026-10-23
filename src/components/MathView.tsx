import React from 'react';
import katex from 'katex';

interface MathViewProps {
  content: string;
  className?: string;
  block?: boolean;
}

/**
 * Safely renders text with embedded LaTeX equations ($...$ for inline, $$...$$ for block).
 * Also automatically detects single LaTeX formulas without $ delimiters (e.g. \tau = RC, fractions, etc.)
 * and converts \(...\) and \[...\].
 */
export const MathView: React.FC<MathViewProps> = ({ content, className = '', block = false }) => {
  if (!content) return null;

  const trimmed = content.trim();

  // If the string starts and ends with a single $ pair (e.g. "$\tau = RC$")
  if (trimmed.startsWith('$') && trimmed.endsWith('$') && !trimmed.startsWith('$$') && trimmed.lastIndexOf('$') === trimmed.length - 1 && trimmed.indexOf('$', 1) === trimmed.length - 1) {
    const mathCode = trimmed.slice(1, -1).trim();
    try {
      const html = katex.renderToString(mathCode, {
        displayMode: block,
        throwOnError: false,
      });
      return (
        <span
          className={`katex-render ${block ? 'block my-2 text-center' : 'inline-block mx-0.5 align-middle'} ${className}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } catch {
      // fallback
    }
  }

  // If the entire string is a formula without $ delimiters (e.g. \tau = RC or \frac{...}{...})
  const hasDelimiters = trimmed.includes('$') || trimmed.includes('\\(') || trimmed.includes('\\[');
  const looksLikeFormula =
    !hasDelimiters &&
    (block ||
      trimmed.startsWith('\\') ||
      trimmed.includes('\\frac') ||
      trimmed.includes('\\tau') ||
      trimmed.includes('\\lambda') ||
      trimmed.includes('\\sum') ||
      trimmed.includes('\\vec') ||
      trimmed.includes('\\sqrt') ||
      trimmed.includes('\\theta') ||
      trimmed.includes('\\Delta') ||
      trimmed.includes('\\pi') ||
      trimmed.includes('\\cdot') ||
      trimmed.includes('^{') ||
      trimmed.includes('_{') ||
      (trimmed.includes('=') && !trimmed.includes('\n')));

  if (looksLikeFormula) {
    try {
      const html = katex.renderToString(trimmed, {
        displayMode: block,
        throwOnError: false,
      });
      return (
        <span
          className={`katex-render ${block ? 'block my-2 text-center' : 'inline-block mx-0.5 align-middle'} ${className}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } catch {
      // fallback to tokenization below
    }
  }

  // Pre-normalize \[ ... \] and \( ... \) to $$ ... $$ and $ ... $
  const normalized = content
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  // Match $$...$$ (display) or $...$ (inline)
  const regex = /(\$\$[\s\S]*?\$\$|\$[^$]+?\$)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    const textBefore = normalized.substring(lastIndex, match.index);
    if (textBefore) {
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {textBefore}
        </span>
      );
    }

    const matchedStr = match[0];
    const isDisplay = matchedStr.startsWith('$$');
    const mathCode = isDisplay ? matchedStr.slice(2, -2) : matchedStr.slice(1, -1);

    try {
      const html = katex.renderToString(mathCode.trim(), {
        displayMode: isDisplay || block,
        throwOnError: false,
      });
      parts.push(
        <span
          key={`math-${match.index}`}
          className={isDisplay || block ? 'block my-2 overflow-x-auto text-center' : 'inline-block mx-0.5 align-middle'}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } catch {
      parts.push(
        <span key={`err-${match.index}`} className="font-mono text-amber-400">
          {matchedStr}
        </span>
      );
    }

    lastIndex = regex.lastIndex;
  }

  const remainingText = normalized.substring(lastIndex);
  if (remainingText) {
    parts.push(
      <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
        {remainingText}
      </span>
    );
  }

  const Container = block ? 'div' : 'span';
  return <Container className={`leading-relaxed ${className}`}>{parts}</Container>;
};
