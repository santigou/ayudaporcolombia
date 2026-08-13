import { useAuth } from "../context/AuthContext";
import type { PointUpdateItem } from "../types";

interface PointNovedadesProps {
  updates: PointUpdateItem[];
  loading: boolean;
  error: string | null;
  message: string;
  onMessageChange: (v: string) => void;
  submitting: boolean;
  onSubmitNovedad: () => void;
}

// Sección de novedades (timeline) de un punto: formulario de publicación
// (solo usuarios logueados) + lista de novedades ordenadas por fecha. Es el
// contenido de la pestaña "Novedades" del detalle.
export function PointNovedades({
  updates,
  loading,
  error,
  message,
  onMessageChange,
  submitting,
  onSubmitNovedad,
}: PointNovedadesProps) {
  const { user } = useAuth();

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
            placeholder="Añade una novedad (ej. ya llegó el agua, el refugio está lleno)…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={submitting || !message.trim()}
            className="self-start rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Publicando…" : "Publicar novedad"}
          </button>
        </form>
      ) : (
        <p className="shrink-0 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Inicia sesión para publicar una novedad.
        </p>
      )}

      {/* Lista de novedades: única zona con scroll (estilo chat). El formulario
          de arriba queda fijo mientras esta lista scrolla internamente. */}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-gray-500">Cargando novedades…</p>
        ) : error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : updates.length === 0 ? (
          <p className="text-xs text-gray-500">Aún no hay novedades.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {updates.map((u) => (
              <li key={u.id} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                {/* Autor: avatar con la inicial + email (consistente con el detalle). */}
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold uppercase text-gray-600">
                    {u.createdByEmail ? u.createdByEmail.charAt(0) : "?"}
                  </span>
                  <span className="text-[11px] font-medium text-gray-600">{u.createdByEmail ?? "Anónimo"}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-700">{u.message}</p>
                <p className="mt-1 text-[11px] text-gray-400">
                  {new Date(u.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
