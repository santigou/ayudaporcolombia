import type { Point } from "../types";
import { PointCard } from "./PointCard";

interface PointListProps {
  points: Point[];
  selectedId?: string | null;
  onSelect: (point: Point) => void;
}

export function PointList({ points, selectedId, onSelect }: PointListProps) {
  if (points.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 text-center">
        No hay puntos que coincidan con los filtros.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 p-3 overflow-y-auto">
      {points.map((point) => (
        <PointCard
          key={point.id}
          point={point}
          selected={point.id === selectedId}
          onClick={() => onSelect(point)}
        />
      ))}
    </div>
  );
}
