import { useEffect, useMemo, useState } from "react";
import {
  CONTACT_LABELS,
  LOCATION_TYPE_LABELS,
  STATUS_LABELS,
  locationLabel,
  type ContactInfo,
  type Point,
  type PointLocationEntry,
  type PointStatus,
  type PointStatusHistoryItem,
  type PointUpdateItem,
  type UpdateKind,
} from "../types";
import { PointNovedades } from "./PointNovedades";
import { ImageGallery } from "./ImageGallery";
import { PointMiniMap } from "./PointMiniMap";
import { VerifyBar } from "./VerifyBar";
import { StatusControls } from "./StatusControls";

interface PointDetailContentProps {
  point: Point;
  updates: PointUpdateItem[];
  contacts: ContactInfo[];
  locations: PointLocationEntry[];
  loading: boolean;
  error: string | null;
  message: string;
  onMessageChange: (v: string) => void;
  submitting: boolean;
  onSubmitNovedad: () => void;
  // Tipo/categoría de la novedad en curso + presencia (chat en tiempo real).
  kind?: UpdateKind;
  onKindChange?: (v: UpdateKind) => void;
  viewers?: number;
  // Si true, omite el bloque de título+badge+dirección (porque el padre ya lo
  // muestra, p. ej. en el header fijo del bottom-sheet móvil).
  hideTitle?: boolean;
  // Email del creador del punto (null = anónimo, p. ej. need_help sin sesión).
  createdByEmail?: string | null;
  // Id del creador (para saber si el usuario actual es el dueño y puede cambiar
  // el estado directamente). null = anónimo → solo el moderador puede.
  createdById?: string | null;
  // Verificación comunitaria.
  validationCount?: number;
  userValidated?: boolean;
  validating?: boolean;
  onValidate?: () => void;
  // Puntos disponibles para pintar como contexto en el mini-mapa del detalle.
  nearbyPoints?: Point[];
  // Aviso opcional (texto) que se muestra resaltado bajo el título, p. ej. para
  // puntos pendientes abiertos por link compartible (PointByCode).
  pendingNotice?: string;
  // Verificación oficial de moderador (need_help): estado + callback.
  moderatorVerifying?: boolean;
  onModeratorVerify?: () => void;
  // Cambio de estado del ciclo de vida (resolved/cancelled/reactivar).
  onStatusChange?: (status: "resolved" | "cancelled" | "active") => Promise<void>;
  statusChanging?: boolean;
  onRequestStatusChange?: (status: "resolved" | "cancelled" | "active", reason?: string) => Promise<void>;
  statusRequesting?: boolean;
  // Historial de cambios de estado (tab "Estado").
  statusHistory?: PointStatusHistoryItem[];
}

type Tab = "info" | "novedades" | "estado";

// URL de Google Maps para "Cómo llegar". Si el punto define un origen (p. ej.
// ruta de transporte), lo añade para que Maps trace la ruta completa; si no,
// Maps parte de la ubicación actual del usuario hasta el destino.
function buildDirectionsUrl(
  destination: { lat: number; lng: number },
  origin?: { lat: number; lng: number } | null,
): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// Cuerpo compartido del detalle de un punto con DOS pestañas:
//  - "Información": título/badge/dirección, descripción, ubicaciones, contactos.
//  - "Novedades": formulario de publicación + timeline (PointNovedades).
// Lo usan el panel lateral (desktop) y el bottom-sheet (móvil). La galería y el
// mini-mapa los pinta cada contenedor donde les corresponda.
export function PointDetailContent({
  point,
  updates,
  contacts,
  locations,
  loading,
  error,
  message,
  onMessageChange,
  submitting,
  onSubmitNovedad,
  kind,
  onKindChange,
  viewers = 0,
  hideTitle = false,
  createdByEmail = null,
  createdById = null,
  validationCount = 0,
  userValidated = false,
  validating = false,
  onValidate,
  nearbyPoints = [],
  pendingNotice,
  moderatorVerifying = false,
  onModeratorVerify,
  onStatusChange,
  statusChanging = false,
  onRequestStatusChange,
  statusRequesting = false,
  statusHistory = [],
}: PointDetailContentProps) {
  const [tab, setTab] = useState<Tab>("info");
  const [activeLocIndex, setActiveLocIndex] = useState(0); // ubicación activa del mini-mapa
  const isNeedHelp = point.type === "need_help";
  // El verificationStatus puede cambiar in-place (moderador verifica un need_help).
  // Lo.trackeamos localmente para que la UI reaccione sin esperar a recargar el listado.
  const [verificationStatus, setVerificationStatus] = useState(point.verificationStatus);
  useEffect(() => {
    setVerificationStatus(point.verificationStatus);
  }, [point.verificationStatus]);
  const address = locationLabel(point.location);
  // Ubicaciones del punto para el mini-mapa: las del detalle si ya cargaron;
  // si no, la del listado como fallback (siempre ≥1 al renderizar el mini-mapa).
  const mapLocations: PointLocationEntry[] =
    locations.length > 0
      ? locations
      : point.location
        ? [{ ...point.location, type: "location" as const }]
        : [];
  // Destino e origen de "Cómo llegar" según la ubicación activa:
  //  - Destino = la ubicación activa del mini-mapa.
  //  - Origen = si existe un rol "origin" y la activa NO es ese origen, se traza
  //    ruta origen → activa. Si la activa es el origen (o no hay), Maps parte de
  //    la ubicación actual del usuario.
  const activeLocation = mapLocations[activeLocIndex] ?? mapLocations[0] ?? null;
  const directionsTarget = activeLocation ?? point.location;
  const directionsOrigin =
    activeLocation && activeLocation.type !== "origin"
      ? (mapLocations.find((l) => l.type === "origin") ?? null)
      : null;

  // Puntos disponibles para el mini-mapa: excluye el propio punto y los que no
  // tienen coordenadas; de los demás toma los 50 más cercanos para no saturar
  // el mini-mapa ni degradar el rendimiento con cientos de marcadores DOM.
  const miniMapPoints = useMemo(() => {
    if (!point.location) return [];
    const { lat, lng } = point.location;
    return nearbyPoints
      .filter((p) => p.location && p.id !== point.id)
      .map((p) => ({ p, d: (p.location!.lat - lat) ** 2 + (p.location!.lng - lng) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 50)
      .map((x) => x.p);
  }, [nearbyPoints, point.id, point.location]);

  // Al cambiar de punto, vuelve a la pestaña de Información y a la 1ª ubicación.
  useEffect(() => {
    setTab("info");
    setActiveLocIndex(0);
  }, [point.id]);

  return (
    <div className="flex h-full flex-col">
      {/* Galería de imágenes: FIJADA arriba, visible en ambas pestañas. */}
      {point.photos.length > 0 && (
        <div className="shrink-0 px-4 pt-3">
          <ImageGallery photos={point.photos} alt={point.title} />
        </div>
      )}

      {/* Barra de pestañas (fija) */}
      <div className="flex shrink-0 gap-1 border-b border-gray-200 px-4 pt-3">
        <TabButton active={tab === "info"} onClick={() => setTab("info")}>
          Información
        </TabButton>
        <TabButton active={tab === "novedades"} onClick={() => setTab("novedades")}>
          Novedades
          {updates.length > 0 && (
            <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 text-[11px] font-medium text-gray-600">
              {updates.length}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "estado"} onClick={() => setTab("estado")}>
          Estado
        </TabButton>
      </div>

      {/* Contenido de la pestaña. */}
      <div className="min-h-0 flex-1">
        {tab === "info" ? (
          <div className="flex h-full flex-col">
            {/* Mapa (ubicación): FIJADO, SOLO visible en la pestaña Información. */}
            {mapLocations.length > 0 && (
              <div className="shrink-0 px-4 pt-3">
                <div className="relative">
                  <PointMiniMap
                    locations={mapLocations}
                    pointType={point.type}
                    points={miniMapPoints}
                    activeIndex={activeLocIndex}
                    onActiveIndexChange={setActiveLocIndex}
                    className="h-40 w-full"
                  />
                  {directionsTarget && (
                  <a
                    href={buildDirectionsUrl(directionsTarget, directionsOrigin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-md ring-1 ring-black/5 transition hover:bg-gray-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2 4 22l8-4 8 4z" />
                    </svg>
                    Cómo llegar
                  </a>
                  )}
                </div>
              </div>
            )}
            {/* Texto (descripción, ubicaciones, contactos): única zona con scroll. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {!hideTitle && (
                <>
                  <h2 className="text-lg font-bold text-gray-900">{point.title}</h2>
                  <div className="mt-1.5 flex items-center gap-2">
                    {createdByEmail ? (
                      <>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[11px] font-bold uppercase text-gray-600">
                          {createdByEmail.charAt(0)}
                        </span>
                        <span className="text-xs text-gray-600">{createdByEmail}</span>
                      </>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                        Anónimo
                      </span>
                    )}
                  </div>
                  <VerifyBar
                    code={point.code}
                    validationCount={validationCount}
                    userValidated={userValidated}
                    validating={validating}
                    onValidate={onValidate ?? (() => {})}
                    pointType={point.type}
                    verificationStatus={verificationStatus}
                    onModeratorVerify={
                      onModeratorVerify
                        ? () => {
                            onModeratorVerify();
                            setVerificationStatus("approved");
                          }
                        : undefined
                    }
                    moderatorVerifying={moderatorVerifying}
                    className="mt-2"
                  />
                  {isNeedHelp && verificationStatus === "approved" ? (
                    <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                      <p className="font-semibold">✓ Punto verificado</p>
                      <p>Un moderador confirmó que este reporte es verídico.</p>
                    </div>
                  ) : isNeedHelp ? (
                    <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <p className="font-semibold">Información no verificada</p>
                      <p>
                        Este reporte fue publicado directamente por un usuario y no ha sido validado por
                        un moderador. Si tienes información, contacta a las autoridades o canales oficiales
                        antes de actuar.
                      </p>
                    </div>
                  ) : point.helpType ? (
                    <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {point.helpType}
                    </span>
                  ) : null}
                  {pendingNotice && (
                    <p className="mt-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-800">{pendingNotice}</p>
                  )}
                  {point.status === "resolved" && (
                    <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                      <p className="font-semibold">✓ Punto resuelto</p>
                      <p>Este caso fue marcado como resuelto por el creador o un moderador.</p>
                    </div>
                  )}
                  {address && <p className="mt-1 text-xs text-gray-400">{address}</p>}
                </>
              )}

              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{point.description}</p>

              {locations.length > 0 && (
                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-gray-900">Ubicaciones</h3>
                  <ul className="mt-1 flex flex-col gap-1">
                    {locations.map((l, i) => {
                      const label = locationLabel(l);
                      return (
                        <li key={i} className="text-xs text-gray-600">
                          <span className="font-medium text-gray-500">{LOCATION_TYPE_LABELS[l.type]}:</span>{" "}
                          {label ?? `${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}`}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {contacts.length > 0 && (
                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-gray-900">Contacto</h3>
                  <ul className="mt-1 flex flex-col gap-1">
                    {contacts.map((c, i) => (
                      <li key={i} className="text-sm text-gray-700">
                        <span className="text-gray-500">{CONTACT_LABELS[c.type]}:</span> {c.value}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : tab === "novedades" ? (
          <div className="h-full px-4 py-3">
            <PointNovedades
              updates={updates}
              loading={loading}
              error={error}
              message={message}
              onMessageChange={onMessageChange}
              kind={kind ?? "message"}
              onKindChange={onKindChange ?? (() => {})}
              submitting={submitting}
              onSubmitNovedad={onSubmitNovedad}
              viewers={viewers}
            />
          </div>
        ) : (
          <EstadoTab
            status={point.status}
            createdById={createdById}
            history={statusHistory}
            onChangeStatus={onStatusChange}
            changing={statusChanging}
            onRequestStatusChange={onRequestStatusChange}
            requesting={statusRequesting}
            pointId={point.id}
          />
        )}
      </div>
    </div>
  );
}

// Botón de pestaña con indicador inferior (subrayado) cuando está activo.
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-brand text-brand"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

// Color del badge de estado actual (consistente con el resto de la UI).
function statusTone(status: PointStatus): string {
  if (status === "active" || status === "resolved") {
    return status === "resolved"
      ? "bg-blue-100 text-blue-700"
      : "bg-emerald-100 text-emerald-700";
  }
  if (status === "pending") return "bg-amber-100 text-amber-700";
  return "bg-gray-200 text-gray-600"; // cancelled / expired / rejected
}

// Tab "Estado": muestra el estado ACTUAL del punto arriba, los controles para
// cambiarlo (creador/moderador directo; otros, solicitud con motivo) y el
// historial de cambios aplicados.
function EstadoTab({
  status,
  createdById,
  history,
  onChangeStatus,
  changing,
  onRequestStatusChange,
  requesting,
  pointId,
}: {
  status: PointStatus;
  createdById?: string | null;
  history: PointStatusHistoryItem[];
  onChangeStatus?: (status: "resolved" | "cancelled" | "active") => Promise<void>;
  changing?: boolean;
  onRequestStatusChange?: (status: "resolved" | "cancelled" | "active", reason?: string) => Promise<void>;
  requesting?: boolean;
  pointId: string;
}) {
  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      {/* Estado actual */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Estado actual
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(status)}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* Petición / cambio de estado */}
      <StatusControls
        pointId={pointId}
        status={status}
        createdById={createdById}
        className="mt-3"
        onChangeStatus={onChangeStatus}
        changing={changing}
        onRequestStatusChange={onRequestStatusChange}
        requesting={requesting}
      />

      {/* Historial de cambios */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-gray-900">Historial de cambios</h3>
        {history.length === 0 ? (
          <p className="mt-1 text-xs text-gray-500">
            Aún no se han registrado cambios de estado en este punto.
          </p>
        ) : (
          <ol className="mt-2 space-y-2">
            {history.map((h) => (
              <li key={h.id} className="rounded-md border border-gray-200 bg-white p-2.5">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                    {STATUS_LABELS[h.fromStatus]}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand-dark">
                    {STATUS_LABELS[h.toStatus]}
                  </span>
                </div>
                {h.reason && (
                  <p className="mt-1.5 text-xs text-gray-600">
                    <span className="font-medium text-gray-500">Motivo:</span> {h.reason}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-gray-400">
                  {h.actorEmail ?? "Anónimo"} · {new Date(h.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
