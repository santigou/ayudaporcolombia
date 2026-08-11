import type { PointCategory, PointType } from "../types";
import { CATEGORY_LABELS } from "../types";

interface FiltersBarProps {
  type: PointType | "todos";
  category: PointCategory | "todas";
  onTypeChange: (type: PointType | "todos") => void;
  onCategoryChange: (category: PointCategory | "todas") => void;
}

const TYPE_OPTIONS: { value: PointType | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "ayuda", label: "Puntos de ayuda" },
  { value: "necesita_ayuda", label: "Personas no ubicadas" },
];

export function FiltersBar({ type, category, onTypeChange, onCategoryChange }: FiltersBarProps) {
  return (
    <div className="flex flex-col gap-2 p-3 border-b border-gray-200">
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
      {type === "ayuda" && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => onCategoryChange("todas")}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
              category === "todas" ? "bg-brand-dark text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            Todas las categorías
          </button>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <button
              key={value}
              onClick={() => onCategoryChange(value as PointCategory)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                category === value ? "bg-brand-dark text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
