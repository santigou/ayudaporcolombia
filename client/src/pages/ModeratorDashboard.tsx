import { useEffect, useState } from "react";
import { CheckCircle2, Mail, Star } from "lucide-react";
import { api, ApiError } from "../api/client";
import type { PartnerView } from "../api/partner";
import { useAuth } from "../context/AuthContext";
import { CONTACT_LABELS, STATUS_LABELS, locationLabel, type ContactInfo, type Point, type PointStatusRequestItem } from "../types";

// Punto pendiente: shape público del listado + datos extra para moderación.
interface ModeratorPoint extends Point {
  contacts: ContactInfo[];
  createdBy: { id: string; email: string } | null;
  validationCount: number;
}

interface ModeratorRequestItem {
  id: string;
  createdAt: string;
  user: { id: string; email: string };
}

type Tab = "puntos" | "solicitudes" | "estados" | "partners";

export function ModeratorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("puntos");
  const [pendingPoints, setPendingPoints] = useState<ModeratorPoint[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ModeratorRequestItem[]>([]);
  const [pendingStatusRequests, setPendingStatusRequests] = useState<PointStatusRequestItem[]>([]);
  const [partners, setPartners] = useState<PartnerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [points, requests, statusRequests, partnerList] = await Promise.all([
        api.get<ModeratorPoint[]>("/moderator/points/pending"),
        api.get<ModeratorRequestItem[]>("/moderator/requests"),
        api.get<PointStatusRequestItem[]>("/moderator/status-requests"),
        api.get<PartnerView[]>("/admin/partners").catch(() => [] as PartnerView[]),
      ]);
      setPendingPoints(points);
      setPendingRequests(requests);
      setPendingStatusRequests(statusRequests);
      setPartners(partnerList);
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
    return <p className="p-6 text-sm text-gray-700 dark:text-gray-300">Solo los moderadores pueden ver esta página.</p>;
  }

  async function reviewPoint(id: string, action: "approve" | "reject") {
    await api.post(`/moderator/points/${id}/${action}`);
    setPendingPoints((prev) => prev.filter((p) => p.id !== id));
  }

  async function reviewRequest(id: string, action: "approve" | "reject") {
    await api.post(`/moderator/requests/${id}/${action}`);
    setPendingRequests((prev) => prev.filter((r) => r.id !== id));
  }

  async function reviewStatusRequest(id: string, action: "approve" | "reject") {
    await api.post(`/moderator/status-requests/${id}/${action}`);
    setPendingStatusRequests((prev) => prev.filter((r) => r.id !== id));
  }

  // Aprueba un partner auto-registrado: su API key pasa a poder enviar puntos.
  async function approvePartner(id: string) {
    const updated = await api.post<PartnerView>(`/admin/partners/${id}/approve`);
    setPartners((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }

  // Marca/desmarca trusted (publicación inmediata sin cola de moderación).
  async function toggleTrusted(p: PartnerView) {
    const updated = await api.patch<PartnerView>(`/admin/partners/${p.id}`, { trusted: !p.trusted });
    setPartners((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
  }

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto p-4">
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Panel de moderación</h1>
      <div className="mt-3 flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setTab("puntos")} className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === "puntos" ? "border-brand text-brand-dark dark:text-brand" : "border-transparent text-gray-500 dark:text-gray-400"}`}>
          Puntos pendientes ({pendingPoints.length})
        </button>
        <button onClick={() => setTab("solicitudes")} className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === "solicitudes" ? "border-brand text-brand-dark dark:text-brand" : "border-transparent text-gray-500 dark:text-gray-400"}`}>
          Solicitudes ({pendingRequests.length})
        </button>
        <button onClick={() => setTab("estados")} className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === "estados" ? "border-brand text-brand-dark dark:text-brand" : "border-transparent text-gray-500 dark:text-gray-400"}`}>
          Cambios de estado ({pendingStatusRequests.length})
        </button>
        <button onClick={() => setTab("partners")} className={`px-3 py-2 text-sm font-medium border-b-2 ${tab === "partners" ? "border-brand text-brand-dark dark:text-brand" : "border-transparent text-gray-500 dark:text-gray-400"}`}>
          Partners ({partners.filter((p) => !p.approvedAt).length})
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Cargando…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : tab === "partners" ? (
        <ul className="mt-4 flex flex-col gap-3">
          {partners.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No hay partners registrados. Las apps se registran solas en{" "}
              <a href="/partners" className="underline">
                /partners
              </a>
              .
            </p>
          )}
          {/* Pendientes primero, luego aprobados */}
          {[...partners]
            .sort((a, b) => Number(!!a.approvedAt) - Number(!!b.approvedAt))
            .map((p) => (
              <li key={p.id} className={`rounded-md border p-3 ${p.approvedAt ? "border-gray-200 dark:border-gray-700" : "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                      {p.name} <span className="font-mono text-xs font-normal text-gray-400">@{p.slug}</span>
                    </h3>
                    <p className="flex items-center gap-1 text-xs text-gray-500">
                      {p.contactEmail && (
                        <>
                          <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{p.contactEmail}</span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span>registrado {new Date(p.createdAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                  {p.approvedAt ? (
                    <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
                      Aprobado
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                      Pendiente
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {!p.approvedAt && (
                    <button
                      onClick={() => approvePartner(p.id)}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
                    >
                      Aprobar partnership
                    </button>
                  )}
                  <button
                    onClick={() => toggleTrusted(p)}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium ${
                      p.trusted
                        ? "border-emerald-300 text-emerald-700 dark:border-emerald-700"
                        : "border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300"
                    }`}
                    title="trusted = sus puntos se publican directo, sin cola de moderación"
                  >
                    <Star className={`h-3.5 w-3.5 ${p.trusted ? "fill-current" : ""}`} aria-hidden="true" />
                    {p.trusted ? "trusted" : "marcar trusted"}
                  </button>
                </div>
                {p.approvedAt && !p.trusted && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    Sus puntos entran a la cola de "Puntos pendientes" como cualquier usuario.
                  </p>
                )}
              </li>
            ))}
        </ul>
      ) : tab === "puntos" ? (
        <ul className="mt-4 flex flex-col gap-3">
          {pendingPoints.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No hay puntos pendientes.</p>}
          {pendingPoints.map((point) => {
            const address = locationLabel(point.location);
            return (
              <li key={point.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{point.title}</h3>
                  {point.helpType && <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200 text-[11px] px-2 py-0.5">{point.helpType}</span>}
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{point.description}</p>
                {address && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Ubicación: {address}</p>}
                {point.contacts.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Contacto:{" "}
                    {point.contacts.map((c) => `${CONTACT_LABELS[c.type]}: ${c.value}`).join(" · ")}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {point.code}
                  </code>
                  {point.validationCount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {point.validationCount} verificación{point.validationCount !== 1 ? "es" : ""}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {point.createdBy ? (
                    <>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                        {point.createdBy.email.charAt(0)}
                      </span>
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {point.createdBy.email}
                      </span>
                    </>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      Anónimo
                    </span>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => reviewPoint(point.id, "approve")} className="rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium">Aprobar</button>
                  <button onClick={() => reviewPoint(point.id, "reject")} className="rounded-md bg-red-600 text-white px-3 py-1.5 text-sm font-medium">Rechazar</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : tab === "solicitudes" ? (
        <ul className="mt-4 flex flex-col gap-3">
          {pendingRequests.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No hay solicitudes pendientes.</p>}
          {pendingRequests.map((req) => (
            <li key={req.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-base font-bold uppercase text-brand">
                  {req.user.email.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    Solicitante
                  </p>
                  <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{req.user.email}</p>
                  <p className="text-xs text-gray-400">
                    Solicita el {new Date(req.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => reviewRequest(req.id, "approve")} className="rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium">Aprobar</button>
                <button onClick={() => reviewRequest(req.id, "reject")} className="rounded-md bg-red-600 text-white px-3 py-1.5 text-sm font-medium">Rechazar</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {pendingStatusRequests.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No hay solicitudes de cambio de estado.</p>}
          {pendingStatusRequests.map((req) => (
            <li key={req.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{req.point.title}</h3>
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {req.point.code}
                </code>
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Estado actual:{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">{STATUS_LABELS[req.point.status]}</span>
                {" → "}
                <span className="font-medium text-blue-700 dark:text-blue-300">{STATUS_LABELS[req.targetStatus]}</span>
              </p>
              {req.reason && (
                <p className="mt-1 rounded-md bg-gray-50 p-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <span className="font-medium">Motivo:</span> {req.reason}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-200">
                  {req.user.email.charAt(0)}
                </span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{req.user.email}</span>
                <span className="text-xs text-gray-400">
                  · {new Date(req.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => reviewStatusRequest(req.id, "approve")}
                  className="rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium"
                >
                  Aprobar cambio
                </button>
                <button
                  onClick={() => reviewStatusRequest(req.id, "reject")}
                  className="rounded-md bg-red-600 text-white px-3 py-1.5 text-sm font-medium"
                >
                  Rechazar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
