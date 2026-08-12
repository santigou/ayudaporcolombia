import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  CONTACT_LABELS,
  LOCATION_TYPE_LABELS,
  type ContactInfo,
  type Point,
  type PointLocationEntry,
  type PointUpdateItem,
} from "../types";
import { locationLabel } from "../types";

interface PointDetailProps {
  point: Point;
  onClose: () => void;
}

export function PointDetail({ point, onClose }: PointDetailProps) {
  const { user } = useAuth();
  const isNeedHelp = point.type === "need_help";

  const [updates, setUpdates] = useState<PointUpdateItem[]>([]);
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [locations, setLocations] = useState<PointLocationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const [updatesData, detailData] = await Promise.all([
        api.get<PointUpdateItem[]>(`/points/${point.id}/updates`),
        api.get<{ contacts?: ContactInfo[]; locations?: PointLocationEntry[] }>(
          `/points/${point.id}`,
        ),
      ]);
      setUpdates(updatesData);
      setContacts(detailData.contacts ?? []);
      setLocations(detailData.locations ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos cargar el detalle.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<PointUpdateItem>(`/points/${point.id}/updates`, { message });
      setUpdates((prev) => [created, ...prev]);
      setMessage("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos publicar la novedad.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 overflow-y-auto">
      <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 mb-3">
        ← Volver a la lista
      </button>
      <h2 className="text-lg font-bold text-gray-900">{point.title}</h2>
      {isNeedHelp ? (
        <div className="mt-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <p className="font-semibold">Información no verificada</p>
          <p>
            Este reporte fue publicado directamente por un usuario y no ha sido validado por un
            moderador. Si tienes información, contacta a las autoridades o canales oficiales antes
            de actuar.
          </p>
        </div>
      ) : point.helpType ? (
        <span className="inline-block mt-2 rounded-full bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 font-medium">
          {point.helpType}
        </span>
      ) : null}
      <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{point.description}</p>
      {locations.length > 0 && (
        <div className="mt-3">
          <h3 className="text-sm font-semibold text-gray-900">Ubicaciones</h3>
          <ul className="mt-1 flex flex-col gap-1">
            {locations.map((l, i) => {
              const label = locationLabel(l);
              return (
                <li key={i} className="text-xs text-gray-600">
                  <span className="font-medium text-gray-500">
                    {LOCATION_TYPE_LABELS[l.type]}:
                  </span>{" "}
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
      {point.photos.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {point.photos.map((src) => (
            <img key={src} src={src} alt={point.title} className="rounded-md object-cover h-28 w-full" />
          ))}
        </div>
      )}

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-gray-900">Novedades</h3>
        {user && (
          <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Añade una novedad (ej. ya llegó el agua, el refugio está lleno)…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="self-start rounded-md bg-brand text-white px-3 py-1.5 text-sm font-medium disabled:opacity-60"
            >
              {submitting ? "Publicando…" : "Publicar novedad"}
            </button>
          </form>
        )}
        {loading ? (
          <p className="mt-3 text-xs text-gray-500">Cargando novedades…</p>
        ) : error ? (
          <p className="mt-3 text-xs text-red-600">{error}</p>
        ) : updates.length === 0 ? (
          <p className="mt-3 text-xs text-gray-500">Aún no hay novedades.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {updates.map((u) => (
              <li key={u.id} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{u.message}</p>
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
