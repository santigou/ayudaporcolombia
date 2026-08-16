import { Link, useParams } from "react-router-dom";
import { usePointByCode } from "../hooks/usePointByCode";
import { MapView } from "../components/MapView";
import { PointDetailContent } from "../components/PointDetailContent";

// Página pública compartible (/p/:code): abre un punto por su código corto.
// En DESKTOP replica la composición del Home: mapa a la izquierda (centrado en
// el punto compartido) + panel lateral derecho (aside w-96) con el MISMO
// componente de detalle que el panel del mapa y el bottom-sheet móvil. En
// móvil se muestra solo el panel (el mini-mapa ya vive dentro del detalle).
export function PointByCode() {
  const { code = "" } = useParams<{ code: string }>();
  const {
    point,
    notFound,
    loading,
    error,
    updates,
    validating,
    moderatorVerifying,
    message,
    setMessage,
    submitting,
    submitNovedad,
    validate,
    moderatorVerify,
    statusChanging,
    changeStatus,
    statusRequesting,
    requestStatusChange,
    statusHistory,
    kind,
    setKind,
    viewers,
  } = usePointByCode(code);

  if (loading) return <div className="p-6 text-center text-sm text-gray-500">Cargando…</div>;

  if (notFound || !point) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-red-600">{error ?? "Punto no encontrado."}</p>
        <Link to="/" className="mt-3 inline-block text-sm font-medium text-brand-dark">
          Volver al mapa
        </Link>
      </div>
    );
  }

  // Aviso solo para offer_help pendientes: el propósito del link compartible es
  // justamente acumular verificaciones antes de la aprobación del moderador.
  const isPending = point.type === "offer_help" && point.verificationStatus === "pending";
  const pendingNotice = isPending
    ? "Este punto está esperando aprobación de un moderador. Verifícalo para ayudar a confirmar que es real."
    : undefined;

  const detail = (
    <PointDetailContent
      point={point}
      pendingNotice={pendingNotice}
      createdByEmail={point.createdByEmail}
      createdById={point.createdById}
      validationCount={point.validationCount}
      userValidated={point.userValidated}
      validating={validating}
      onValidate={validate}
      moderatorVerifying={moderatorVerifying}
      onModeratorVerify={moderatorVerify}
      onStatusChange={changeStatus}
      statusChanging={statusChanging}
      onRequestStatusChange={requestStatusChange}
      statusRequesting={statusRequesting}
      statusHistory={statusHistory}
      updates={updates}
      contacts={point.contacts}
      locations={point.locations}
      loading={loading}
      error={error}
      message={message}
      onMessageChange={setMessage}
      kind={kind}
      onKindChange={setKind}
      viewers={viewers}
      submitting={submitting}
      onSubmitNovedad={submitNovedad}
    />
  );

  // Misma composición que Home: mapa (solo desktop) + aside con el detalle.
  // flyTo centra la cámara en el punto compartido al abrir el link.
  const primary = point.location;
  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-56px)]">
      {/* Mapa grande centrado en el punto compartido (solo desktop). */}
      <div className="hidden md:block md:flex-1">
        <MapView
          points={[point]}
          selectedId={point.id}
          flyTo={primary ? { lat: primary.lat, lng: primary.lng } : null}
        />
      </div>
      {/* Panel lateral idéntico al del Home (aside w-96, mismo borde/fondo). */}
      <aside className="apc-dark flex-1 md:flex-none md:w-96 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
        <div className="shrink-0 px-4 pt-4">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Ver en el mapa
          </Link>
        </div>
        <div className="min-h-0 flex-1">{detail}</div>
      </aside>
    </div>
  );
}
