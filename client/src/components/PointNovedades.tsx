import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { UPDATE_KINDS, type PointUpdateItem, type UpdateKind } from "../types";

interface PointNovedadesProps {
  updates: PointUpdateItem[];
  loading: boolean;
  error: string | null;
  message: string;
  onMessageChange: (v: string) => void;
  // Tipo/categoría de la novedad en curso (chat en tiempo real).
  kind: UpdateKind;
  onKindChange: (v: UpdateKind) => void;
  submitting: boolean;
  onSubmitNovedad: () => void;
  // Personas viendo este punto ahora mismo (presencia vía WebSocket).
  viewers: number;
}

// Metadatos visuales de cada categoría de novedad: etiqueta y clases de color
// para la burbuja + badge del mensaje. El selector es un dropdown (sin emojis).
const KIND_META: Record<
  UpdateKind,
  { label: string; bubble: string; badge: string }
> = {
  message: { label: "Comentario", bubble: "border-gray-200 bg-white", badge: "bg-gray-100 text-gray-600" },
  helping: { label: "Estoy ayudando", bubble: "border-emerald-300 bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" },
  done: { label: "Terminamos", bubble: "border-blue-300 bg-blue-50", badge: "bg-blue-100 text-blue-700" },
  important: { label: "Importante", bubble: "border-amber-300 bg-amber-50", badge: "bg-amber-100 text-amber-700" },
  urgent: { label: "Urgente", bubble: "border-red-400 bg-red-50", badge: "bg-red-100 text-red-700" },
};

// Sección de novedades (chat en tiempo real) de un punto: formulario de
// publicación con selector de categoría + timeline estilo chat. Es el contenido
// de la pestaña "Novedades". Los mensajes nuevos entran en vivo por WebSocket y
// se muestran del más antiguo al más nuevo con auto-scroll al final.
export function PointNovedades({
  updates,
  loading,
  error,
  message,
  onMessageChange,
  kind,
  onKindChange,
  submitting,
  onSubmitNovedad,
  viewers,
}: PointNovedadesProps) {
  const { user } = useAuth();
  const listRef = useRef<HTMLDivElement>(null);

  // Mantiene la vista en la novedad más reciente (arriba): al cargar el punto y
  // al llegar un mensaje nuevo en tiempo real, baja el scroll al tope superior.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = 0;
  }, [updates]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmitNovedad();
  }

  return (
    <div className="flex h-full flex-col">
      {user ? (
        <form onSubmit={handleSubmit} className="flex shrink-0 flex-col gap-2">
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={
              kind === "helping"
                ? "Ej. voy en camino con 5 personas, llegamos en 30 min…"
                : kind === "done"
                  ? "Ej. ya resolvimos aquí, no hace falta más ayuda…"
                  : kind === "urgent"
                    ? "Ej. urgente: necesitamos agua y atención médica…"
                    : "Añade una novedad (ej. ya llegó el agua, el refugio está lleno)…"
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {/* Fila de acción: dropdown de categoría (izquierda) + botón publicar. */}
          <div className="flex items-center gap-2">
            <select
              value={kind}
              onChange={(e) => onKindChange(e.target.value as UpdateKind)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand"
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
              disabled={submitting || !message.trim()}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? "Publicando…" : "Publicar novedad"}
            </button>
          </div>
        </form>
      ) : (
        <p className="shrink-0 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Inicia sesión para publicar una novedad.
        </p>
      )}

      {/* Indicador de conexión en vivo: botón verde que titila + número de
          personas viendo este punto ahora mismo (incluye al propio usuario). */}
      <div className="mt-2 shrink-0">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          <span className="h-2 w-2 animate-blink rounded-full bg-emerald-500" />
          {viewers} {viewers === 1 ? "persona viendo" : "personas viendo"}
        </span>
      </div>

      {/* Lista de novedades: única zona con scroll (estilo chat). El formulario
          de arriba queda fijo mientras esta lista scrolla internamente. */}
      <div ref={listRef} className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-gray-500">Cargando novedades…</p>
        ) : error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : updates.length === 0 ? (
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
                    <span className="text-[11px] font-medium text-gray-600">
                      {u.createdByEmail ?? "Anónimo"}
                    </span>
                    {u.kind !== "message" && (
                      <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>
                        {meta.label}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-gray-700">{u.message}</p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    {new Date(u.createdAt).toLocaleString()}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
