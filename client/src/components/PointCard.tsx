import type { Point } from "../types";
import { CATEGORY_LABELS } from "../types";

interface PointCardProps {
  point: Point;
  selected?: boolean;
  onClick?: () => void;
}

export function PointCard({ point, selected, onClick }: PointCardProps) {
  const isNecesitaAyuda = point.type === "necesita_ayuda";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 transition ${
        selected ? "border-brand bg-brand/5" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900 line-clamp-1">{point.title}</h3>
        {isNecesitaAyuda ? (
          <span className="shrink-0 rounded-full bg-red-100 text-red-700 text-[11px] px-2 py-0.5 font-medium">
            No verificado
          </span>
        ) : point.category ? (
          <span className="shrink-0 rounded-full bg-emerald-100 text-emerald-700 text-[11px] px-2 py-0.5 font-medium">
            {CATEGORY_LABELS[point.category]}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-gray-600 line-clamp-2">{point.description}</p>
      {point.addressText && (
        <p className="mt-1 text-xs text-gray-400">{point.addressText}</p>
      )}
    </button>
  );
}
