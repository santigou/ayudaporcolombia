import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapView } from "../components/MapView";
import { AddressSearch } from "../components/AddressSearch";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { CATEGORY_LABELS } from "../types";
import type { Point, PointCategory, PointType } from "../types";

export function CreatePoint() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [type, setType] = useState<PointType>("ayuda");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [addressText, setAddressText] = useState("");
  const [category, setCategory] = useState<PointCategory>("refugio");
  const [contactInfo, setContactInfo] = useState(user?.contactInfo ?? "");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Point | null>(null);

  if (authLoading) {
    return <p className="p-6 text-sm text-gray-500">Cargando…</p>;
  }

  if (!user) {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <p className="text-gray-700">Debes iniciar sesión para crear un punto.</p>
        <button
          onClick={() => navigate("/login")}
          className="mt-4 rounded-md bg-brand text-white px-4 py-2 font-medium"
        >
          Ir a iniciar sesión
        </button>
      </div>
    );
  }

  if (created) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <h1 className="text-lg font-bold text-gray-900">¡Listo!</h1>
        {created.type === "ayuda" ? (
          <div className="mt-3 rounded-md bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
            <p>
              Tu punto fue enviado a revisión. Tu código de verificación es{" "}
              <span className="font-mono font-bold">{created.verificationCode}</span>.
            </p>
            <p className="mt-2">
              Un moderador te contactará por Instagram o el canal autorizado usando este código
              para confirmar tu identidad antes de publicarlo en el mapa.
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-md bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
            <p>Tu reporte ya está visible en el mapa, marcado como no verificado.</p>
          </div>
        )}
        <button
          onClick={() => navigate("/")}
          className="mt-4 rounded-md bg-brand text-white px-4 py-2 font-medium"
        >
          Volver al mapa
        </button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!location) {
      setError("Toca el mapa para marcar la ubicación.");
      return;
    }
    if (!contactInfo.trim()) {
      setError("Indica un contacto (Instagram, teléfono, etc.).");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("type", type);
      form.set("title", title);
      form.set("description", description);
      form.set("lat", String(location.lat));
      form.set("lng", String(location.lng));
      form.set("addressText", addressText);
      form.set("contactInfo", contactInfo);
      if (type === "ayuda") form.set("category", category);
      photos.forEach((file) => form.append("photos", file));

      const point = await api.post<Point>("/points", form);
      setCreated(point);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos crear el punto.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-56px)]">
      <div className="h-[40vh] md:h-auto md:flex-1">
        <MapView
          points={[]}
          pickerMode
          pickedLocation={location}
          onPickLocation={(lat, lng) => setLocation({ lat, lng })}
          flyTo={flyTo}
        />
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex-1 md:w-96 md:flex-none overflow-y-auto p-4 flex flex-col gap-3"
      >
        <h1 className="text-lg font-bold text-gray-900">Crear punto</h1>

        <AddressSearch
          onSelect={(result) => {
            setLocation({ lat: result.lat, lng: result.lng });
            setFlyTo({ lat: result.lat, lng: result.lng });
            setAddressText(result.label);
          }}
        />

        <p className="text-xs text-gray-500">
          Busca una dirección o toca el mapa a la izquierda para marcar la ubicación exacta.
          {location && (
            <span className="block text-emerald-700 mt-1">
              Ubicación marcada ({location.lat.toFixed(4)}, {location.lng.toFixed(4)})
            </span>
          )}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType("ayuda")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
              type === "ayuda" ? "border-brand bg-brand/10 text-brand-dark" : "border-gray-200"
            }`}
          >
            Punto de ayuda
          </button>
          <button
            type="button"
            onClick={() => setType("necesita_ayuda")}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
              type === "necesita_ayuda" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200"
            }`}
          >
            Persona no ubicada
          </button>
        </div>

        {type === "necesita_ayuda" && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
            Este reporte se publicará de inmediato sin validación. Recomienda a quien lo lea
            contactar canales oficiales antes de actuar.
          </p>
        )}

        <label className="text-sm font-medium text-gray-700">
          Título
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder={type === "ayuda" ? "Albergue Parque Central" : "Última vez visto en..."}
          />
        </label>

        <label className="text-sm font-medium text-gray-700">
          Descripción
          <textarea
            required
            minLength={10}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        {type === "ayuda" && (
          <label className="text-sm font-medium text-gray-700">
            Categoría
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PointCategory)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="text-sm font-medium text-gray-700">
          Dirección o referencia (opcional)
          <input
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm font-medium text-gray-700">
          Contacto (Instagram, teléfono, etc.)
          <input
            required
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="@usuario o número"
          />
        </label>

        <label className="text-sm font-medium text-gray-700">
          Fotos (opcional, máx 5)
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 5))}
            className="mt-1 w-full text-sm"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-md bg-brand text-white px-4 py-2 font-semibold disabled:opacity-60"
        >
          {submitting ? "Enviando…" : "Publicar"}
        </button>
      </form>
    </div>
  );
}
