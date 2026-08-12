import type { HelpTypeOption, PointType } from "../types";
import { HELP_TYPES } from "../types";

interface FiltersBarProps {
  type: PointType | "todos";
  helpType: HelpTypeOption | "todas";
  onTypeChange: (type: PointType | "todos") => void;
  onHelpTypeChange: (helpType: HelpTypeOption | "todas") => void;
}

const TYPE_OPTIONS: { value: PointType | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "offer_help", label: "Puntos de ayuda" },
  { value: "need_help", label: "Personas no ubicadas" },
];

export function FiltersBar({ type, helpType, onTypeChange, onHelpTypeChange }: FiltersBarProps) {
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
    </div>
  );
}
