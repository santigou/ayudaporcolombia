import type { Point } from "../types";
import { CATEGORY_LABELS } from "../types";

interface PointDetailProps {
  point: Point;
  onClose: () => void;
}

export function PointDetail({ point, onClose }: PointDetailProps) {
  const isNecesitaAyuda = point.type === "necesita_ayuda";
  return (
    <div className="p-4 overflow-y-auto">
      <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 mb-3">
        ← Volver a la lista
      </button>
      <h2 className="text-lg font-bold text-gray-900">{point.title}</h2>
      {isNecesitaAyuda ? (
        <div className="mt-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <p className="font-semibold">Información no verificada</p>
          <p>
            Este reporte fue publicado directamente por un usuario y no ha sido validado por un
            moderador. Si tienes información, contacta a las autoridades o canales oficiales antes
            de actuar.
          </p>
        </div>
      ) : point.category ? (
        <span className="inline-block mt-2 rounded-full bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 font-medium">
          {CATEGORY_LABELS[point.category]}
        </span>
      ) : null}
      <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{point.description}</p>
      {point.addressText && (
        <p className="mt-2 text-xs text-gray-500">Ubicación: {point.addressText}</p>
      )}
      {point.photos.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {point.photos.map((src) => (
            <img key={src} src={src} alt={point.title} className="rounded-md object-cover h-28 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
