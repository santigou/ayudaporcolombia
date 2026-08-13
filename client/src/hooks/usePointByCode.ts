import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { ContactInfo, Point, PointLocationEntry, PointUpdateItem } from "../types";

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
  submitting: boolean;
  submitNovedad: () => Promise<void>;
  validate: () => Promise<void>;
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
  const [message, setMessage] = useState("");
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

  // Cuando el punto ya cargó, trae su timeline de novedades (requiere el id).
  useEffect(() => {
    if (!point) return;
    let cancelled = false;
    api
      .get<PointUpdateItem[]>(`/points/${point.id}/updates`)
      .then((data) => {
        if (!cancelled) setUpdates(data);
      })
      .catch(() => {
        /* timeline opcional: no bloquea el detalle */
      });
    return () => {
      cancelled = true;
    };
  }, [point]);

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
      const created = await api.post<PointUpdateItem>(`/points/${point.id}/updates`, { message });
      setUpdates((prev) => [created, ...prev]);
      setMessage("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos publicar la novedad.");
    } finally {
      setSubmitting(false);
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
    submitting,
    submitNovedad,
    validate,
  };
}
