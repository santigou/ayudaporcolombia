import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { CONTACT_LABELS, locationLabel, type ContactInfo, type Point } from "../types";

// Punto pendiente: shape público del listado + datos extra para moderación.
interface ModeratorPoint extends Point {
  contacts: ContactInfo[];
  createdBy: { id: string; email: string } | null;
}

interface ModeratorRequestItem {
  id: string;
  createdAt: string;
  user: { id: string; email: string };
}

type Tab = "puntos" | "solicitudes";

export function ModeratorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("puntos");
  const [pendingPoints, setPendingPoints] = useState<ModeratorPoint[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ModeratorRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [points, requests] = await Promise.all([
        api.get<ModeratorPoint[]>("/moderator/points/pending"),
        api.get<ModeratorRequestItem[]>("/moderator/requests"),
      ]);
      setPendingPoints(points);
      setPendingRequests(requests);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos cargar el panel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === "moderator") loadAll();
  }, [user]);

  if (authLoading) return <p className="p-6 text-sm text-gray-500">Cargando…</p>;
  if (!user || user.role !== "moderator") {
    return <p className="p-6 text-sm text-gray-700">Solo los moderadores pueden ver esta página.</p>;
  }

  async function reviewPoint(id: string, action: "approve" | "reject") {
    await api.post(`/moderator/points/${id}/${action}`);
    setPendingPoints((prev) => prev.filter((p) => p.id !== id));
  }

  async function reviewRequest(id: string, action: "approve" | "reject") {
    await api.post(`/moderator/requests/${id}/${action}`);
    setPendingRequests((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-lg font-bold text-gray-900">Panel de moderación</h1>
      <div className="mt-3 flex gap-2 border-b border-gray-200">
        <button onClick={() => setTab("puntos")} className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === "puntos" ? "border-brand text-brand-dark" : "border-transparent text-gray-500"}`}>
          Puntos pendientes ({pendingPoints.length})
        </button>
        <button onClick={() => setTab("solicitudes")} className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === "solicitudes" ? "border-brand text-brand-dark" : "border-transparent text-gray-500"}`}>
          Solicitudes ({pendingRequests.length})
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Cargando…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : tab === "puntos" ? (
        <ul className="mt-4 flex flex-col gap-3">
          {pendingPoints.length === 0 && <p className="text-sm text-gray-500">No hay puntos pendientes.</p>}
          {pendingPoints.map((point) => {
            const address = locationLabel(point.location);
            return (
              <li key={point.id} className="rounded-md border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{point.title}</h3>
                  {point.helpType && <span className="rounded-full bg-emerald-100 text-emerald-700 text-[11px] px-2 py-0.5">{point.helpType}</span>}
                </div>
                <p className="mt-1 text-sm text-gray-600">{point.description}</p>
                {address && <p className="mt-1 text-xs text-gray-500">Ubicación: {address}</p>}
                {point.contacts.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Contacto:{" "}
                    {point.contacts.map((c) => `${CONTACT_LABELS[c.type]}: ${c.value}`).join(" · ")}
                  </p>
                )}
                <p className="text-xs text-gray-500">Creado por: {point.createdBy?.email ?? "anónimo"}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => reviewPoint(point.id, "approve")} className="rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium">Aprobar</button>
                  <button onClick={() => reviewPoint(point.id, "reject")} className="rounded-md bg-red-600 text-white px-3 py-1.5 text-sm font-medium">Rechazar</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {pendingRequests.length === 0 && <p className="text-sm text-gray-500">No hay solicitudes pendientes.</p>}
          {pendingRequests.map((req) => (
            <li key={req.id} className="rounded-md border border-gray-200 p-3">
              <p className="text-sm text-gray-600">{req.user.email}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => reviewRequest(req.id, "approve")} className="rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium">Aprobar</button>
                <button onClick={() => reviewRequest(req.id, "reject")} className="rounded-md bg-red-600 text-white px-3 py-1.5 text-sm font-medium">Rechazar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
