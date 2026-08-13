import { useEffect } from "react";
import { usePointDetail } from "../hooks/usePointDetail";
import { PointDetailContent } from "./PointDetailContent";
import { VerifyBar } from "./VerifyBar";
import { locationLabel, type Point } from "../types";

interface HomeBottomSheetProps {
  point: Point;
  nearbyPoints?: Point[];
  onClose: () => void;
  onPointUpdated?: (updated: Point) => void;
}

// Hoja inferior tipo Airbnb para móvil: cubre casi toda la pantalla sobre el
// mapa. Estructura (arriba → abajo):
//  - Header fijo: botón cerrar + "tarjeta" del punto (título, badge, dirección).
//  - Contenido (PointDetailContent): galería FIJADA arriba (ambas pestañas) +
//    pestañas Información / Novedades. En Información, el mapa queda fijado y
//    solo el texto scrolla; en Novedades, el formulario queda fijo y solo la
//    lista de mensajes hace scroll (el mapa no se muestra).
export function HomeBottomSheet({ point, nearbyPoints, onClose, onPointUpdated }: HomeBottomSheetProps) {
  const detail = usePointDetail(point.id);
  const isNeedHelp = point.type === "need_help";
  const address = locationLabel(point.location);

  // Verificación oficial de moderador: tras éxito, propaga el nuevo
  // verificationStatus al Home (actualiza `selected` y la lista de puntos).
  const handleModeratorVerify = async () => {
    await detail.moderatorVerify();
    onPointUpdated?.({ ...point, verificationStatus: "approved" });
  };

  // Cerrar con tecla Escape (accesibilidad).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex h-[100dvh] flex-col bg-white md:hidden">
      {/* Header fijo: cierre + "tarjeta" del dispositivo */}
      <header className="relative shrink-0 border-b border-gray-200 px-4 pb-3 pt-3">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          ✕
        </button>
        <h2 className="pr-10 text-base font-bold text-gray-900">{point.title}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {isNeedHelp ? (
            point.verificationStatus === "approved" ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                ✓ Verificado
              </span>
            ) : (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                No verificado
              </span>
            )
          ) : point.helpType ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              {point.helpType}
            </span>
          ) : null}
          {address && <span className="text-xs text-gray-400">{address}</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          {detail.createdByEmail ? (
            <>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold uppercase text-gray-600">
                {detail.createdByEmail.charAt(0)}
              </span>
              <span className="text-xs text-gray-600">{detail.createdByEmail}</span>
            </>
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
              Anónimo
            </span>
          )}
        </div>
        <VerifyBar
          code={point.code}
          validationCount={detail.validationCount}
          userValidated={detail.userValidated}
          validating={detail.validating}
          onValidate={detail.validate}
          pointType={point.type}
          verificationStatus={point.verificationStatus}
          onModeratorVerify={handleModeratorVerify}
          moderatorVerifying={detail.moderatorVerifying}
          className="mt-2"
        />
      </header>

      {/* Contenido con pestañas (Información / Novedades). Cada pestaña gestiona
          su propio scroll; el header de arriba y el mini-mapa de abajo quedan
          fijos. En Novedades, el formulario queda fijo y solo la lista scrolla. */}
      <div className="min-h-0 flex-1">
        <PointDetailContent
          point={point}
          nearbyPoints={nearbyPoints}
          createdByEmail={detail.createdByEmail}
          validationCount={detail.validationCount}
          userValidated={detail.userValidated}
          validating={detail.validating}
          onValidate={detail.validate}
          moderatorVerifying={detail.moderatorVerifying}
          onModeratorVerify={handleModeratorVerify}
          updates={detail.updates}
          contacts={detail.contacts}
          locations={detail.locations}
          loading={detail.loading}
          error={detail.error}
          message={detail.message}
          onMessageChange={detail.setMessage}
          submitting={detail.submitting}
          onSubmitNovedad={detail.submitNovedad}
          hideTitle
        />
      </div>
    </div>
  );
}
