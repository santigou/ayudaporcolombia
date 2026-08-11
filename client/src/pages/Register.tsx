import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [wantsModerator, setWantsModerator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ name, email, password, contactInfo, wantsModerator });
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos crear tu cuenta.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-lg font-bold text-gray-900">Crear cuenta</h1>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <label className="text-sm font-medium text-gray-700">
          Nombre
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Correo
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Contraseña
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Contacto (Instagram, teléfono) — opcional
          <input
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={wantsModerator}
            onChange={(e) => setWantsModerator(e.target.checked)}
          />
          Quiero postularme como moderador
        </label>
        {wantsModerator && (
          <p className="text-xs text-gray-500">
            Tu solicitud quedará pendiente hasta que un moderador existente la apruebe.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-md bg-brand text-white px-4 py-2 font-semibold disabled:opacity-60"
        >
          {submitting ? "Creando…" : "Crear cuenta"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="text-brand font-medium">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
