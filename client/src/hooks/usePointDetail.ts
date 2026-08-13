import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { ContactInfo, PointLocationEntry, PointUpdateItem } from "../types";

interface UsePointDetailResult {
  updates: PointUpdateItem[];
  contacts: ContactInfo[];
  locations: PointLocationEntry[];
  createdByEmail: string | null;
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
  submitting: boolean;
  submitNovedad: () => Promise<void>;
  validate: () => Promise<void>;
}

// Carga el detalle "pesado" de un punto (novedades, contactos, ubicaciones
// múltiples) y maneja la publicación de una novedad. Lo usan tanto el panel
// lateral (desktop) como el bottom-sheet (móvil) para no duplicar lógica.
export function usePointDetail(pointId: string): UsePointDetailResult {
  const [updates, setUpdates] = useState<PointUpdateItem[]>([]);
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [locations, setLocations] = useState<PointLocationEntry[]>([]);
  const [createdByEmail, setCreatedByEmail] = useState<string | null>(null);
  const [validationCount, setValidationCount] = useState(0);
  const [userValidated, setUserValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [moderatorVerifying, setModeratorVerifying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<PointUpdateItem[]>(`/points/${pointId}/updates`),
      api.get<{ contacts?: ContactInfo[]; locations?: PointLocationEntry[]; createdByEmail?: string | null; validationCount?: number; userValidated?: boolean }>(`/points/${pointId}`),
    ])
      .then(([updatesData, detailData]) => {
        if (cancelled) return;
        setUpdates(updatesData);
        setContacts(detailData.contacts ?? []);
        setLocations(detailData.locations ?? []);
        setCreatedByEmail(detailData.createdByEmail ?? null);
        setValidationCount(detailData.validationCount ?? 0);
        setUserValidated(detailData.userValidated ?? false);
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

  async function submitNovedad() {
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<PointUpdateItem>(`/points/${pointId}/updates`, { message });
      setUpdates((prev) => [created, ...prev]);
      setMessage("");
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

  return {
    updates,
    contacts,
    locations,
    createdByEmail,
    validationCount,
    userValidated,
    validating,
    moderatorVerifying,
    moderatorVerify,
    loading,
    error,
    message,
    setMessage,
    submitting,
    submitNovedad,
    validate,
  };
}
