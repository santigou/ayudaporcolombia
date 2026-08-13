import { usePointDetail } from "../hooks/usePointDetail";
import { PointDetailContent } from "./PointDetailContent";
import type { Point } from "../types";

interface PointDetailProps {
  point: Point;
  nearbyPoints?: Point[];
  onClose: () => void;
}

// Detalle de un punto en el panel lateral derecho (desktop). Estilo Airbnb:
// el mapa principal sigue a la izquierda; aquí, botón "volver" fijo y debajo
// el contenido con pestañas (Información / Novedades). La galería vive dentro
// de la pestaña Información; en Novedades, el formulario queda fijo y solo la
// lista de mensajes hace scroll (estilo chat).
export function PointDetail({ point, nearbyPoints, onClose }: PointDetailProps) {
  const detail = usePointDetail(point.id);

  return (
    <div className="flex h-full flex-col">
      <button
        onClick={onClose}
        className="shrink-0 px-4 pt-4 text-sm text-gray-500 hover:text-gray-700"
      >
        ← Volver a la lista
      </button>
      <div className="min-h-0 flex-1">
        <PointDetailContent
          point={point}
          nearbyPoints={nearbyPoints}
          createdByEmail={detail.createdByEmail}
          updates={detail.updates}
          contacts={detail.contacts}
          locations={detail.locations}
          loading={detail.loading}
          error={detail.error}
          message={detail.message}
          onMessageChange={detail.setMessage}
          submitting={detail.submitting}
          onSubmitNovedad={detail.submitNovedad}
        />
      </div>
    </div>
  );
}
