import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { CONTACT_LABELS, locationLabel, type Point } from "../types";
import { VerifyBar } from "../components/VerifyBar";

type PointByCodeData = Point & { validationCount: number; userValidated: boolean };

// Página pública compartible (/p/:code): abre un punto por su código corto.
// Muestra la info esencial y permite verificarlo / compartirlo.
export function PointByCode() {
  const { code = "" } = useParams<{ code: string }>();
  const { user } = useAuth();
  const [point, setPoint] = useState<PointByCodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<PointByCodeData>(`/points/code/${code.toUpperCase()}`)
      .then((data) => {
        if (!cancelled) setPoint(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "No encontrado.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function validate() {
    if (!point || point.userValidated || verifying) return;
    setVerifying(true);
    try {
      const res = await api.post<{ validationCount: number }>(`/points/${point.id}/validate`);
      setPoint((prev) => (prev ? { ...prev, validationCount: res.validationCount, userValidated: true } : prev));
    } catch {
      /* ignore */
    } finally {
      setVerifying(false);
    }
  }

  if (loading) return <div className="p-6 text-center text-sm text-gray-500">Cargando…</div>;
  if (error || !point)
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-red-600">{error ?? "Punto no encontrado."}</p>
        <Link to="/" className="mt-3 inline-block text-sm font-medium text-brand-dark">
          Volver al mapa
        </Link>
      </div>
    );

  const address = locationLabel(point.location);
  const isNeedHelp = point.type === "need_help";

  return (
    <div className="mx-auto max-w-md p-4">
      <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
        ← Ver en el mapa
      </Link>
      <div className="mt-3">
        <h1 className="text-xl font-bold text-gray-900">{point.title}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {isNeedHelp ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">No verificado</span>
          ) : point.helpType ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{point.helpType}</span>
          ) : null}
          {address && <span className="text-xs text-gray-400">{address}</span>}
        </div>

        <VerifyBar
          code={point.code}
          validationCount={point.validationCount}
          userValidated={point.userValidated}
          validating={verifying}
          onValidate={validate}
          className="mt-3"
        />

        {point.photos.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {point.photos.map((src, i) => (
              <img key={i} src={src} alt="" className="h-32 w-48 shrink-0 rounded-lg object-cover" />
            ))}
          </div>
        )}

        <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{point.description}</p>

        {point.contacts && point.contacts.length > 0 && (
          <div className="mt-3">
            <h2 className="text-sm font-semibold text-gray-900">Contacto</h2>
            <ul className="mt-1 flex flex-col gap-1">
              {point.contacts.map((c, i) => (
                <li key={i} className="text-sm text-gray-700">
                  <span className="text-gray-500">{CONTACT_LABELS[c.type]}:</span> {c.value}
                </li>
              ))}
            </ul>
          </div>
        )}

        {point.location && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${point.location.lat},${point.location.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-dark"
          >
            Cómo llegar
          </a>
        )}

        {!user && !point.userValidated && (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            <Link to="/login" className="font-semibold underline">
              Inicia sesión
            </Link>{" "}
            para verificar este punto y ayudar a confirmarlo.
          </p>
        )}
      </div>
    </div>
  );
}
