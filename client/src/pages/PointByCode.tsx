import { Link, useParams } from "react-router-dom";
import { usePointByCode } from "../hooks/usePointByCode";
import { PointDetailContent } from "../components/PointDetailContent";

// Página pública compartible (/p/:code): abre un punto por su código corto y
// reutiliza el MISMO componente de detalle (PointDetailContent) que el panel
// lateral del mapa y el bottom-sheet móvil. La única diferencia: si el punto
// está pendiente de moderación, muestra un aviso ámbar pidiendo verificación
// comunitaria.
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

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-4">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← Ver en el mapa
        </Link>
      </div>
      <div className="min-h-0 flex-1">
        <PointDetailContent
          point={point}
          pendingNotice={pendingNotice}
          createdByEmail={point.createdByEmail}
          validationCount={point.validationCount}
          userValidated={point.userValidated}
          validating={validating}
          onValidate={validate}
          moderatorVerifying={moderatorVerifying}
          onModeratorVerify={moderatorVerify}
          updates={updates}
          contacts={point.contacts}
          locations={point.locations}
          loading={loading}
          error={error}
          message={message}
          onMessageChange={setMessage}
          submitting={submitting}
          onSubmitNovedad={submitNovedad}
        />
      </div>
    </div>
  );
}
