import type { Point } from "../types";
import { locationLabel } from "../types";

interface PointCardProps {
  point: Point;
  selected?: boolean;
  onClick?: () => void;
}

export function PointCard({ point, selected, onClick }: PointCardProps) {
  const isNeedHelp = point.type === "need_help";
  const address = locationLabel(point.location);
  const photos = point.photos;
  const hasPhotos = photos.length > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 transition ${
        selected ? "border-brand bg-brand/5" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex gap-3">
        {/* Indicador de fotos: miniatura de la primera + contador adicional */}
        {hasPhotos && (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
            <img src={photos[0]} alt="" className="h-full w-full object-cover" />
            {photos.length > 1 && (
              <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
                +{photos.length - 1}
              </span>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-gray-900 line-clamp-1">{point.title}</h3>
            {point.status === "resolved" ? (
              <span className="shrink-0 rounded-full bg-blue-100 text-blue-700 text-[11px] px-2 py-0.5 font-medium">
                Resuelto
              </span>
            ) : isNeedHelp ? (
              point.verificationStatus === "approved" ? (
                <span className="shrink-0 rounded-full bg-emerald-100 text-emerald-700 text-[11px] px-2 py-0.5 font-medium">
                  ✓ Verificado
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-red-100 text-red-700 text-[11px] px-2 py-0.5 font-medium">
                  No verificado
                </span>
              )
            ) : point.helpType ? (
              <span className="shrink-0 rounded-full bg-emerald-100 text-emerald-700 text-[11px] px-2 py-0.5 font-medium">
                {point.helpType}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">{point.description}</p>
          {address && (
            <p className="mt-1 text-xs text-gray-400 line-clamp-2 break-words">{address}</p>
          )}
        </div>
      </div>
    </button>
  );
}
