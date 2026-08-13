import { usePointDetail } from "../hooks/usePointDetail";
import { PointDetailContent } from "./PointDetailContent";
import type { Point } from "../types";

interface PointDetailProps {
  point: Point;
  nearbyPoints?: Point[];
  onClose: () => void;
  onPointUpdated?: (updated: Point) => void;
}

// Detalle de un punto en el panel lateral derecho (desktop). Estilo Airbnb:
// el mapa principal sigue a la izquierda; aquí, botón "volver" fijo y debajo
// el contenido con pestañas (Información / Novedades). La galería vive dentro
// de la pestaña Información; en Novedades, el formulario queda fijo y solo la
// lista de mensajes hace scroll (estilo chat).
export function PointDetail({ point, nearbyPoints, onClose, onPointUpdated }: PointDetailProps) {
  const detail = usePointDetail(point.id);

  // Verificación oficial de moderador: tras éxito, propaga el nuevo
  // verificationStatus al Home (actualiza `selected` y la lista de puntos).
  const handleModeratorVerify = async () => {
    await detail.moderatorVerify();
    onPointUpdated?.({ ...point, verificationStatus: "approved" });
  };

  // Cambio de estado del ciclo de vida: tras éxito, propaga el nuevo status al
  // Home para que el badge y el mapa reflejen el cambio al instante.
  const handleStatusChange = async (status: "resolved" | "cancelled" | "active") => {
    await detail.changeStatus(status);
    onPointUpdated?.({ ...point, status });
  };

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
          createdById={detail.createdById}
          validationCount={detail.validationCount}
          userValidated={detail.userValidated}
          validating={detail.validating}
          onValidate={detail.validate}
          moderatorVerifying={detail.moderatorVerifying}
          onModeratorVerify={handleModeratorVerify}
          onStatusChange={handleStatusChange}
          statusChanging={detail.statusChanging}
          onRequestStatusChange={detail.requestStatusChange}
          statusRequesting={detail.statusRequesting}
          statusHistory={detail.statusHistory}
          updates={detail.updates}
          contacts={detail.contacts}
          locations={detail.locations}
          loading={detail.loading}
          error={detail.error}
          message={detail.message}
          onMessageChange={detail.setMessage}
          kind={detail.kind}
          onKindChange={detail.setKind}
          viewers={detail.viewers}
          submitting={detail.submitting}
          onSubmitNovedad={detail.submitNovedad}
        />
      </div>
    </div>
  );
}
