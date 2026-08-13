import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { ContactInfo, PointLocationEntry, PointUpdateItem } from "../types";

interface UsePointDetailResult {
  updates: PointUpdateItem[];
  contacts: ContactInfo[];
  locations: PointLocationEntry[];
  createdByEmail: string | null;
  loading: boolean;
  error: string | null;
  message: string;
  setMessage: (v: string) => void;
  submitting: boolean;
  submitNovedad: () => Promise<void>;
}

// Carga el detalle "pesado" de un punto (novedades, contactos, ubicaciones
// múltiples) y maneja la publicación de una novedad. Lo usan tanto el panel
// lateral (desktop) como el bottom-sheet (móvil) para no duplicar lógica.
export function usePointDetail(pointId: string): UsePointDetailResult {
  const [updates, setUpdates] = useState<PointUpdateItem[]>([]);
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [locations, setLocations] = useState<PointLocationEntry[]>([]);
  const [createdByEmail, setCreatedByEmail] = useState<string | null>(null);
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
      api.get<{ contacts?: ContactInfo[]; locations?: PointLocationEntry[]; createdByEmail?: string | null }>(`/points/${pointId}`),
    ])
      .then(([updatesData, detailData]) => {
        if (cancelled) return;
        setUpdates(updatesData);
        setContacts(detailData.contacts ?? []);
        setLocations(detailData.locations ?? []);
        setCreatedByEmail(detailData.createdByEmail ?? null);
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

  return {
    updates,
    contacts,
    locations,
    createdByEmail,
    loading,
    error,
    message,
    setMessage,
    submitting,
    submitNovedad,
  };
}
