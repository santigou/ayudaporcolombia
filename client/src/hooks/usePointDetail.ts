import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { getSocket } from "../api/socket";
import type { ContactInfo, PointLocationEntry, PointStatusHistoryItem, PointUpdateItem, UpdateKind } from "../types";

interface UsePointDetailResult {
  updates: PointUpdateItem[];
  contacts: ContactInfo[];
  locations: PointLocationEntry[];
  createdByEmail: string | null;
  createdById: string | null;
  validationCount: number;
  userValidated: boolean;
  validating: boolean;
  // Verificación oficial de moderador (need_help).
  moderatorVerifying: boolean;
  moderatorVerify: () => Promise<void>;
  loading: boolean;
  error: string | null;
  message: string;
  setMessage: (v: string) => void;
  // Tipo/categoría de la novedad que se va a publicar (chat en tiempo real).
  kind: UpdateKind;
  setKind: (v: UpdateKind) => void;
  // Personas viendo este punto en tiempo real (presencia vía WebSocket).
  viewers: number;
  submitting: boolean;
  submitNovedad: () => Promise<void>;
  validate: () => Promise<void>;
  // Cambio de estado del ciclo de vida (creador o moderador) y solicitud de cambio.
  statusChanging: boolean;
  changeStatus: (status: "resolved" | "cancelled" | "active") => Promise<void>;
  statusRequesting: boolean;
  requestStatusChange: (status: "resolved" | "cancelled" | "active", reason?: string) => Promise<void>;
  // Historial de cambios de estado (tab "Estado").
  statusHistory: PointStatusHistoryItem[];
  reloadStatusHistory: () => Promise<void>;
}

// Carga el detalle "pesado" de un punto (novedades, contactos, ubicaciones
// múltiples) y maneja la publicación de una novedad. Lo usan tanto el panel
// lateral (desktop) como el bottom-sheet (móvil) para no duplicar lógica. Además
// se conecta por WebSocket a la sala del punto para recibir novedades nuevas en
// tiempo real y reflejar la presencia de otros espectadores.
export function usePointDetail(pointId: string): UsePointDetailResult {
  const [updates, setUpdates] = useState<PointUpdateItem[]>([]);
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [locations, setLocations] = useState<PointLocationEntry[]>([]);
  const [createdByEmail, setCreatedByEmail] = useState<string | null>(null);
  const [createdById, setCreatedById] = useState<string | null>(null);
  const [validationCount, setValidationCount] = useState(0);
  const [userValidated, setUserValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [moderatorVerifying, setModeratorVerifying] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [statusRequesting, setStatusRequesting] = useState(false);
  const [statusHistory, setStatusHistory] = useState<PointStatusHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<UpdateKind>("message");
  const [viewers, setViewers] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<PointUpdateItem[]>(`/points/${pointId}/updates`),
      api.get<{ contacts?: ContactInfo[]; locations?: PointLocationEntry[]; createdByEmail?: string | null; createdById?: string | null; validationCount?: number; userValidated?: boolean }>(`/points/${pointId}`),
      api.get<PointStatusHistoryItem[]>(`/points/${pointId}/status-history`).catch(() => [] as PointStatusHistoryItem[]),
    ])
      .then(([updatesData, detailData, historyData]) => {
        if (cancelled) return;
        setUpdates(updatesData);
        setContacts(detailData.contacts ?? []);
        setLocations(detailData.locations ?? []);
        setCreatedByEmail(detailData.createdByEmail ?? null);
        setCreatedById(detailData.createdById ?? null);
        setValidationCount(detailData.validationCount ?? 0);
        setUserValidated(detailData.userValidated ?? false);
        setStatusHistory(historyData);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "No pudimos cargar el detalle.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pointId]);

  // Recarga solo el historial de estado (tras un cambio aplicado).
  // Suscripción en tiempo real a la sala del punto: recibe novedades nuevas y el
  // conteo de espectadores. Al (re)conectar hace un re-fetch completo del timeline
  // para no perder mensajes del intervalo de desconexión.
  useEffect(() => {
    const sock = getSocket();
    const joinAndSync = () => {
      sock.emit("point:join", { pointId });
      api
        .get<PointUpdateItem[]>(`/points/${pointId}/updates`)
        .then(setUpdates)
        .catch(() => {});
    };
    const onNew = (u: PointUpdateItem) => {
      setUpdates((prev) => (prev.some((x) => x.id === u.id) ? prev : [u, ...prev]));
    };
    const onPresence = (p: { pointId: string; viewers: number }) => {
      if (p.pointId === pointId) setViewers(p.viewers);
    };
    sock.on("connect", joinAndSync);
    sock.on("update:new", onNew);
    sock.on("point:presence", onPresence);
    // Si ya está conectado (p. ej. al cambiar de punto), unimos de inmediato.
    if (sock.connected) joinAndSync();
    return () => {
      sock.off("connect", joinAndSync);
      sock.off("update:new", onNew);
      sock.off("point:presence", onPresence);
      sock.emit("point:leave", { pointId });
      setViewers(0);
    };
  }, [pointId]);

  async function reloadStatusHistory() {
    try {
      const data = await api.get<PointStatusHistoryItem[]>(`/points/${pointId}/status-history`);
      setStatusHistory(data);
    } catch {
      /* el historial es secundario: no bloquea la UI */
    }
  }

  async function submitNovedad() {
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<PointUpdateItem>(`/points/${pointId}/updates`, { message, kind });
      // Dedup por id: el backend también difunde la novedad por WebSocket, y
      // podría llegar antes/después de esta respuesta. Evita duplicados.
      setUpdates((prev) => (prev.some((x) => x.id === created.id) ? prev : [created, ...prev]));
      setMessage("");
      setKind("message");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos publicar la novedad.");
    } finally {
      setSubmitting(false);
    }
  }

  // Verificación comunitaria: el usuario confirma que el punto es real (1 por usuario).
  async function validate() {
    if (userValidated || validating) return;
    setValidating(true);
    setError(null);
    try {
      const res = await api.post<{ validationCount: number }>(`/points/${pointId}/validate`);
      setValidationCount(res.validationCount);
      setUserValidated(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos registrar tu verificación.");
    } finally {
      setValidating(false);
    }
  }

  // Verificación oficial de moderador (need_help): marca el punto como verificado.
  // Tras el éxito, recargamos el detalle para que el badge se actualice (el punto
  // viene del listado externo, así que no podemos mutar su verificationStatus aquí).
  async function moderatorVerify() {
    setModeratorVerifying(true);
    setError(null);
    try {
      await api.post(`/moderator/points/${pointId}/verify`);
      // Forzamos recarga del detalle para reflejar el nuevo verificationStatus.
      setLoading(true);
      const detailData = await api.get<{
        verificationStatus?: string;
        validationCount?: number;
        userValidated?: boolean;
      }>(`/points/${pointId}`);
      setValidationCount(detailData.validationCount ?? validationCount);
      setUserValidated(detailData.userValidated ?? userValidated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos verificar el punto.");
    } finally {
      setModeratorVerifying(false);
      setLoading(false);
    }
  }

  // Cambio de estado del ciclo de vida: lo usa el creador del punto o un moderador.
  // El backend valida permisos y la transición. Tras el éxito, recargamos el
  // historial para que el tab "Estado" refleje el nuevo cambio de inmediato.
  async function changeStatus(status: "resolved" | "cancelled" | "active") {
    setStatusChanging(true);
    setError(null);
    try {
      await api.post(`/points/${pointId}/status`, { status });
      await reloadStatusHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos cambiar el estado.");
      throw err;
    } finally {
      setStatusChanging(false);
    }
  }

  // Solicitud de cambio de estado: usuario que no es creador ni moderador propone
  // un estado objetivo + motivo. Queda pendiente hasta aprobación del moderador.
  async function requestStatusChange(status: "resolved" | "cancelled" | "active", reason?: string) {
    setStatusRequesting(true);
    setError(null);
    try {
      await api.post(`/points/${pointId}/status-requests`, { status, reason });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos enviar la solicitud.");
      throw err;
    } finally {
      setStatusRequesting(false);
    }
  }

  return {
    updates,
    contacts,
    locations,
    createdByEmail,
    createdById,
    validationCount,
    userValidated,
    validating,
    moderatorVerifying,
    moderatorVerify,
    loading,
    error,
    message,
    setMessage,
    kind,
    setKind,
    viewers,
    submitting,
    submitNovedad,
    validate,
    statusChanging,
    changeStatus,
    statusRequesting,
    requestStatusChange,
    statusHistory,
    reloadStatusHistory,
  };
}
