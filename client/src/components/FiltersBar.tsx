import type { HelpTypeOption, PointType } from "../types";
import { HELP_TYPES } from "../types";

interface FiltersBarProps {
  type: PointType | "todos";
  helpType: HelpTypeOption | "todas";
  onTypeChange: (type: PointType | "todos") => void;
  onHelpTypeChange: (helpType: HelpTypeOption | "todas") => void;
  // Buscador de texto libre: filtra por título, descripción, tipo de ayuda,
  // ciudad, barrio, dirección y código. Multi-término (todos deben coincidir).
  query: string;
  onQueryChange: (q: string) => void;
  // Toggle "Mostrar resueltos": por defecto no aparecen en el mapa para no
  // saturar; con este flag se incluyen. Siempre visible (count opcional).
  showResolved: boolean;
  onShowResolvedChange: (show: boolean) => void;
  resolvedCount: number;
}

const TYPE_OPTIONS: { value: PointType | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "offer_help", label: "Puntos de ayuda" },
  { value: "need_help", label: "Necesita ayuda" },
];

export function FiltersBar({
  type,
  helpType,
  onTypeChange,
  onHelpTypeChange,
  query,
  onQueryChange,
  showResolved,
  onShowResolvedChange,
  resolvedCount,
}: FiltersBarProps) {
  return (
    <div className="flex flex-col gap-2 p-3 border-b border-gray-200">
      {/* Buscador de texto: filtra por toda la info del punto. */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar: ciudad, tipo, mascota, raza…"
          className="w-full rounded-full border border-gray-300 bg-white py-2 pl-9 pr-9 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Limpiar búsqueda"
            className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600 hover:bg-gray-300"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onTypeChange(opt.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
              type === opt.value
                ? "bg-brand text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {type === "offer_help" && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => onHelpTypeChange("todas")}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
              helpType === "todas" ? "bg-brand-dark text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            Todos los tipos
          </button>
          {HELP_TYPES.map((value) => (
            <button
              key={value}
              onClick={() => onHelpTypeChange(value)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                helpType === value ? "bg-brand-dark text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-xs text-gray-600 select-none cursor-pointer">
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(e) => onShowResolvedChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand"
        />
        Mostrar resueltos{resolvedCount > 0 ? ` (${resolvedCount})` : ""}
      </label>
    </div>
  );
}
