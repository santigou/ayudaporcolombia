import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { getSocket } from "../api/socket";
import type { ContactInfo, Point, PointLocationEntry, PointStatusHistoryItem, PointUpdateItem, UpdateKind } from "../types";

type PointByCodeData = Point & {
  validationCount: number;
  userValidated: boolean;
  createdByEmail: string | null;
  contacts: ContactInfo[];
  locations: PointLocationEntry[];
};

interface UsePointByCodeResult {
  point: PointByCodeData | null;
  notFound: boolean;
  loading: boolean;
  error: string | null;
  updates: PointUpdateItem[];
  validating: boolean;
  moderatorVerifying: boolean;
  moderatorVerify: () => Promise<void>;
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
  // Cambio de estado del ciclo de vida + solicitud.
  statusChanging: boolean;
  changeStatus: (status: "resolved" | "cancelled" | "active") => Promise<void>;
  statusRequesting: boolean;
  requestStatusChange: (status: "resolved" | "cancelled" | "active", reason?: string) => Promise<void>;
  // Historial de cambios de estado (tab "Estado").
  statusHistory: PointStatusHistoryItem[];
}

// Carga un punto por su CÓDIGO compartible (/p/:code) en una sola petición que
// ya trae todo lo que necesita PointDetailContent (contacts, locations,
// createdByEmail, validationCount). Lo usa la página pública PointByCode para
// reutilizar el MISMO componente de detalle que el mapa, en vez de duplicar la
// UI. El fetch por id (updates) y la verificación/validación van por endpoints
// aparte, igual que en usePointDetail.
export function usePointByCode(code: string): UsePointByCodeResult {
  const [point, setPoint] = useState<PointByCodeData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updates, setUpdates] = useState<PointUpdateItem[]>([]);
  const [validating, setValidating] = useState(false);
  const [moderatorVerifying, setModeratorVerifying] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [statusRequesting, setStatusRequesting] = useState(false);
  const [statusHistory, setStatusHistory] = useState<PointStatusHistoryItem[]>([]);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<UpdateKind>("message");
  const [viewers, setViewers] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Carga inicial: punto (por código) + timeline de novedades, en paralelo.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);
    setPoint(null);
    Promise.all([
      api.get<PointByCodeData>(`/points/code/${code.toUpperCase()}`),
      // Las novedades se piden por id; si el punto aún no cargó, se reintentan
      // abajo en el efecto dependiente de point.id.
      Promise.resolve<PointUpdateItem[]>([]),
    ])
      .then(([pointData]) => {
        if (cancelled) return;
        setPoint(pointData);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError(err instanceof ApiError ? err.message : "No pudimos cargar el punto.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Cuando el punto ya cargó, trae su timeline de novedades e historial de estado.
  useEffect(() => {
    if (!point) return;
    let cancelled = false;
    Promise.all([
      api.get<PointUpdateItem[]>(`/points/${point.id}/updates`).catch(() => [] as PointUpdateItem[]),
      api.get<PointStatusHistoryItem[]>(`/points/${point.id}/status-history`).catch(() => [] as PointStatusHistoryItem[]),
    ]).then(([data, history]) => {
      if (cancelled) return;
      setUpdates(data);
      setStatusHistory(history);
    });
    return () => {
      cancelled = true;
    };
  }, [point]);

  // Suscripción en tiempo real a la sala del punto (cuando ya cargó por código):
  // recibe novedades nuevas y el conteo de espectadores. Al (re)conectar hace un
  // re-fetch completo para no perder mensajes del intervalo de desconexión.
  useEffect(() => {
    const pointId = point?.id;
    if (!pointId) return;
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
    if (sock.connected) joinAndSync();
    return () => {
      sock.off("connect", joinAndSync);
      sock.off("update:new", onNew);
      sock.off("point:presence", onPresence);
      sock.emit("point:leave", { pointId });
      setViewers(0);
    };
  }, [point?.id]);

  async function validate() {
    if (!point || point.userValidated || validating) return;
    setValidating(true);
    try {
      const res = await api.post<{ validationCount: number }>(`/points/${point.id}/validate`);
      setPoint((prev) => (prev ? { ...prev, validationCount: res.validationCount, userValidated: true } : prev));
    } catch {
      /* el VerifyBar / useLoginModal manejan el 401 */
    } finally {
      setValidating(false);
    }
  }

  // Verificación oficial de moderador (need_help): actualiza el punto in-place.
  async function moderatorVerify() {
    if (!point) return;
    setModeratorVerifying(true);
    try {
      await api.post(`/moderator/points/${point.id}/verify`);
      setPoint((prev) => (prev ? { ...prev, verificationStatus: "approved" } : prev));
    } catch {
      /* error silencioso: el moderador puede reintentar */
    } finally {
      setModeratorVerifying(false);
    }
  }

  async function submitNovedad() {
    if (!point || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<PointUpdateItem>(`/points/${point.id}/updates`, { message, kind });
      // Dedup por id: el backend también difunde la novedad por WebSocket.
      setUpdates((prev) => (prev.some((x) => x.id === created.id) ? prev : [created, ...prev]));
      setMessage("");
      setKind("message");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos publicar la novedad.");
    } finally {
      setSubmitting(false);
    }
  }

  // Cambio de estado del ciclo de vida (creador o moderador). Actualiza el punto
  // in-place para reflejar el nuevo estado en la UI y recarga el historial.
  async function changeStatus(status: "resolved" | "cancelled" | "active") {
    if (!point) return;
    setStatusChanging(true);
    try {
      await api.post(`/points/${point.id}/status`, { status });
      setPoint((prev) => (prev ? { ...prev, status } : prev));
      try {
        const history = await api.get<PointStatusHistoryItem[]>(`/points/${point.id}/status-history`);
        setStatusHistory(history);
      } catch {
        /* historial secundario */
      }
    } catch {
      /* el error lo maneja el componente vía ApiError */
    } finally {
      setStatusChanging(false);
    }
  }

  // Solicitud de cambio de estado (usuario no creador ni moderador).
  async function requestStatusChange(status: "resolved" | "cancelled" | "active", reason?: string) {
    if (!point) return;
    setStatusRequesting(true);
    try {
      await api.post(`/points/${point.id}/status-requests`, { status, reason });
    } catch {
      /* error silencioso: el usuario puede reintentar */
    } finally {
      setStatusRequesting(false);
    }
  }

  return {
    point,
    notFound,
    loading,
    error,
    updates,
    validating,
    moderatorVerifying,
    moderatorVerify,
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
  };
}
