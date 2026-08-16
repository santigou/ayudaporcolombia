import { useMemo, useRef } from "react";

// ============================================================================
// JsonTextarea / JsonView — resaltado de JSON SIN dependencias.
//
// Técnica: un <pre> coloreado detrás de un <textarea> transparente con exactamente
// la misma tipografía/padding/métricas; el usuario escribe sobre el textarea y ve
// los colores del pre debajo. El tokenizador es tolerante: mientras escribes y el
// JSON no parsea, colorea lo que puede (nunca estorba la edición).
// ============================================================================

const TOKEN_COLORS = {
  key: "text-sky-300",
  string: "text-green-300",
  number: "text-amber-300",
  boolean: "text-fuchsia-300",
  null: "text-gray-400",
  punct: "text-gray-500",
  invalid: "text-red-400",
};

// Tokeniza char a char: claves ("...":), strings, números, literales y puntuación.
function highlightJson(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === "'") {
      // String (o clave si viene seguida de ':'): consume hasta la comilla de cierre.
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === "\\") j++; // escape
        j++;
      }
      const isKey = /^\s*:/.test(src.slice(j + 1, j + 3));
      out += `<span class="${isKey ? TOKEN_COLORS.key : TOKEN_COLORS.string}">${escapeHtml(src.slice(i, Math.min(j + 1, n)))}</span>`;
      i = j + 1;
    } else if (/[-\d.]/.test(c)) {
      let j = i;
      while (j < n && /[-\d.eE+]/.test(src[j])) j++;
      out += `<span class="${TOKEN_COLORS.number}">${escapeHtml(src.slice(i, j))}</span>`;
      i = j;
    } else if (/[a-zA-Z_$]/.test(c)) {
      let j = i;
      while (j < n && /[a-zA-Z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      const color =
        word === "true" || word === "false" ? TOKEN_COLORS.boolean : word === "null" ? TOKEN_COLORS.null : TOKEN_COLORS.invalid;
      out += `<span class="${color}">${escapeHtml(word)}</span>`;
      i = j;
    } else if (c === "$") {
      // Expresión JSONata dentro de un string ya coloreado... los $ fuera de
      // strings (poco común) se pintan como clave.
      let j = i;
      while (j < n && /[a-zA-Z0-9_$.]/.test(src[j])) j++;
      out += `<span class="${TOKEN_COLORS.key}">${escapeHtml(src.slice(i, j))}</span>`;
      i = j;
    } else {
      out += `<span class="${TOKEN_COLORS.punct}">${escapeHtml(c)}</span>`;
      i++;
    }
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const SHARED_STYLE = "font-mono text-xs leading-relaxed whitespace-pre-wrap break-words p-3 m-0 border-0";

// Editable: textarea transparente sobre el pre coloreado (scroll sincronizado).
export function JsonTextarea({
  value,
  onChange,
  rows = 14,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  ariaLabel?: string;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const html = useMemo(() => highlightJson(value) + "\n", [value]);
  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-700 bg-gray-900 focus-within:border-brand">
      <pre ref={preRef} aria-hidden="true" className={`${SHARED_STYLE} pointer-events-none text-gray-300`} dangerouslySetInnerHTML={{ __html: html }} />
      <textarea
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (preRef.current) {
            preRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
            preRef.current.scrollLeft = (e.target as HTMLTextAreaElement).scrollLeft;
          }
        }}
        spellCheck={false}
        rows={rows}
        className={`${SHARED_STYLE} absolute inset-0 h-full w-full resize-none bg-transparent text-transparent caret-white outline-none`}
      />
    </div>
  );
}

// Read-only (resultados del dry-run, etc.).
export function JsonView({ value, className = "" }: { value: string; className?: string }) {
  const html = useMemo(() => highlightJson(value) + "\n", [value]);
  return (
    <pre
      className={`${SHARED_STYLE} max-h-72 overflow-auto rounded-lg bg-gray-900 text-gray-300 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
