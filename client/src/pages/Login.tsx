import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { hasDraft } from "../components/create/draft";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // Si venía creando un punto y fue a iniciar sesión, lo devolvemos al asistente
      // (su progreso quedó guardado en sessionStorage).
      navigate(hasDraft() ? "/crear" : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-lg font-bold text-gray-900">Iniciar sesión</h1>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
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
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-md bg-brand text-white px-4 py-2 font-semibold disabled:opacity-60"
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        ¿No tienes cuenta?{" "}
        <Link to="/registro" className="text-brand font-medium">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
