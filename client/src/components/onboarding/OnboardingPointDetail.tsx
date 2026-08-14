import type { FormEvent, ReactNode } from "react";
import { CONTACT_LABELS, UPDATE_KINDS, type ContactInfo, type Point, type PointUpdateItem, type UpdateKind } from "../../types";
import { ImageGallery } from "../ImageGallery";

// Metadatos visuales de cada categoría de novedad (espejo del de PointNovedades,
// replicado aquí para que el detalle del tutorial sea autónomo y no acople al
// hook de auth). Etiqueta + clases de color para burbuja y badge.
const KIND_META: Record<UpdateKind, { label: string; bubble: string; badge: string }> = {
  message: { label: "Comentario", bubble: "border-gray-200 bg-white", badge: "bg-gray-100 text-gray-600" },
  helping: { label: "Estoy ayudando", bubble: "border-emerald-300 bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" },
  done: { label: "Terminamos", bubble: "border-blue-300 bg-blue-50", badge: "bg-blue-100 text-blue-700" },
  important: { label: "Importante", bubble: "border-amber-300 bg-amber-50", badge: "bg-amber-100 text-amber-700" },
  urgent: { label: "Urgente", bubble: "border-red-400 bg-red-50", badge: "bg-red-100 text-red-700" },
};

interface Props {
  point: Point;
  tab: "info" | "novedades";
  onTabChange: (t: "info" | "novedades") => void;
  // Novedades (simuladas en local; no se llama al backend).
  updates: PointUpdateItem[];
  message: string;
  onMessageChange: (v: string) => void;
  kind: UpdateKind;
  onKindChange: (v: UpdateKind) => void;
  onSubmitNovedad: () => void;
  // Espectadores en vivo (mock, solo ilustrativo).
  viewers: number;
}

// Detalle de un punto para el onboarding: replica el look del detalle real
// (header, galería, pestañas Información / Novedades, barra de verificación)
// pero con DATOS MOCKEADOS y SIN llamar a usePointDetail ni al backend. La
// pestaña Novedades simula la publicación (aviso "necesitas cuenta") en vez de
// hacer un POST real.
export function OnboardingPointDetail({
  point,
  tab,
  onTabChange,
  updates,
  message,
  onMessageChange,
  kind,
  onKindChange,
  onSubmitNovedad,
  viewers,
}: Props) {
  const isNeedHelp = point.type === "need_help";
  const supplies = point.supplies ?? [];
  const contacts: ContactInfo[] = point.contacts ?? [];
  const loc = point.location;
  const directionsUrl = loc
    ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`
    : null;

  return (
    <div className="flex h-full flex-col">
      {point.photos.length > 0 && (
        <div className="shrink-0 px-4 pt-3">
          <ImageGallery photos={point.photos} alt={point.title} />
        </div>
      )}

      {/* Header del punto: título, badge de estado, código y dirección. */}
      <div className="shrink-0 px-4 pt-3">
        <h2 className="text-lg font-bold text-gray-900">{point.title}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {isNeedHelp ? (
            point.verificationStatus === "approved" ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">✓ Verificado</span>
            ) : (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">No verificado</span>
            )
          ) : (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              {point.helpType ?? "Ayuda"}
            </span>
          )}
          <code className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-mono font-semibold text-gray-700">{point.code}</code>
          {loc && (
            <span className="text-xs text-gray-400">
              {[loc.address, loc.neighborhood, loc.city].filter(Boolean).join(", ")}
            </span>
          )}
        </div>
        {/* Barra de verificación/compartir: en el tutorial se muestra
            deshabilitada (no se verifican ni comparten puntos reales). */}
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-400" title="En el tutorial no se verifican puntos">
            Verificar ({point.validationCount})
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-400" title="Compartir (deshabilitado en el tutorial)">
            Compartir
          </span>
        </div>
      </div>
      {/* Pestañas (fijas). */}
      <div className="flex shrink-0 gap-1 border-b border-gray-200 px-4 pt-3">
        <TabButton active={tab === "info"} onClick={() => onTabChange("info")}>
          Información
        </TabButton>
        <TabButton active={tab === "novedades"} onClick={() => onTabChange("novedades")}>
          Novedades
          {updates.length > 0 && (
            <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 text-[11px] font-medium text-gray-600">{updates.length}</span>
          )}
        </TabButton>
      </div>

      {/* Contenido de la pestaña. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {tab === "info" ? (
          <div className="flex flex-col gap-4 text-sm text-gray-700">
            <p className="whitespace-pre-wrap">{point.description}</p>

            {supplies.length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {isNeedHelp ? "Necesita" : "Ofrece"}
                </h3>
                <ul className="flex flex-col gap-2">
                  {supplies.map((s) => {
                    const target = s.targetQuantity ?? 0;
                    const received = s.receivedQuantity ?? 0;
                    const pct = target > 0 ? Math.min(100, Math.round((received / target) * 100)) : null;
                    return (
                      <li key={s.name} className="rounded-md border border-gray-200 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-800">{s.name}</span>
                          <span className="text-xs text-gray-500">
                            {received}
                            {target > 0 ? ` / ${target}` : ""}
                            {s.unit ? ` ${s.unit}` : ""}
                          </span>
                        </div>
                        {pct != null && (
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                            <div className={`h-full ${isNeedHelp ? "bg-red-400" : "bg-brand"}`} style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {contacts.length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Contacto</h3>
                <ul className="flex flex-col gap-1">
                  {contacts.map((c, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">{CONTACT_LABELS[c.type]}</span>
                      <span className="text-gray-800">{c.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {directionsUrl && (
              <a href={directionsUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark">
                🧭 Cómo llegar
              </a>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Aviso: publicar novedades requiere cuenta; en el tutorial se simula. */}
            <div className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="font-semibold">Para publicar novedades necesitas una cuenta.</p>
              <p className="mt-0.5">
                En este tutorial lo saltamos: escribe abajo y pulsa <strong>Simular novedad</strong> para ver cómo se vería.
              </p>
            </div>

            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                onSubmitNovedad();
              }}
              className="mt-3 flex shrink-0 flex-col gap-2"
            >
              <textarea
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Ej. ya llegó el agua, el refugio está lleno…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-2">
                <select
                  value={kind}
                  onChange={(e) => onKindChange(e.target.value as UpdateKind)}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700"
                  title="Tipo de novedad"
                >
                  {UPDATE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_META[k].label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!message.trim()}
                  className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  Simular novedad
                </button>
              </div>
            </form>

            {/* Indicador de presencia (mock). */}
            <div className="mt-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <span className="h-2 w-2 animate-blink rounded-full bg-emerald-500" />
                {viewers} {viewers === 1 ? "persona viendo" : "personas viendo"}
              </span>
            </div>

            {/* Timeline de novedades (estilo chat). */}
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {updates.length === 0 ? (
                <p className="text-xs text-gray-500">Aún no hay novedades.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {updates.map((u) => {
                    const meta = KIND_META[u.kind] ?? KIND_META.message;
                    return (
                      <li key={u.id} className={`rounded-md border px-3 py-2 ${meta.bubble}`}>
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold uppercase text-gray-600">
                            {u.createdByEmail ? u.createdByEmail.charAt(0) : "?"}
                          </span>
                          <span className="text-[11px] font-medium text-gray-600">{u.createdByEmail ?? "Anónimo"}</span>
                          {u.kind !== "message" && (
                            <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>
                              {meta.label}
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-gray-700">{u.message}</p>
                        <p className="mt-1 text-[11px] text-gray-400">{new Date(u.createdAt).toLocaleString()}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
        active ? "border-brand text-brand-dark" : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}