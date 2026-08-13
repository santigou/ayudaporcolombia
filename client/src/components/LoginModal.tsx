import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";

interface LoginModalProps {
  // Texto opcional que explica por qué se pide login (ej. "para verificar este punto").
  reason?: string;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
}

// Modal de login reutilizable: overlay a pantalla completa + tarjeta centrada.
// Se abre vía useLoginModal() desde cualquier parte de la app (p. ej. al pulsar
// "Verificar" sin sesión). El login exitoso cierra el modal automáticamente.
export function LoginModal({ reason, onClose, onLogin }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onLogin(email, password);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-gray-900">Iniciar sesión</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        {reason && <p className="mt-1 text-sm text-gray-500">{reason}</p>}
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700">
            Correo
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
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
            className="mt-2 rounded-md bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-600">
          ¿No tienes cuenta?{" "}
          <Link to="/registro" onClick={onClose} className="font-medium text-brand-dark">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
