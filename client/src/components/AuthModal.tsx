import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client";

export type AuthMode = "login" | "register";

interface AuthModalProps {
  // Texto opcional que explica por qué se pide iniciar sesión (ej. "para verificar este punto").
  reason?: string;
  // Modo actual (login o registro). Lo controla el contexto para poder abrir
  // directamente en registro desde un CTA.
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (input: { email: string; password: string; wantsModerator?: boolean }) => Promise<void>;
}

// Modal de autenticación UNIFICADO: en una sola tarjeta se puede iniciar sesión
// o crear cuenta (toggle de pestañas). Así el usuario no navega a /login ni a
// /registro: se queda en su página y abre el popup (mejor UX). El login/registro
// exitoso cierra el modal. Se abre vía useLoginModal() (open = login,
// openRegister = registro) desde cualquier parte de la app.
export function AuthModal({ reason, mode, onModeChange, onClose, onLogin, onRegister }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [wantsModerator, setWantsModerator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isLogin = mode === "login";

  function switchMode(next: AuthMode) {
    if (next === mode) return;
    setError(null);
    onModeChange(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isLogin) {
        await onLogin(email, password);
      } else {
        await onRegister({ email, password, wantsModerator });
      }
      onClose();
    } catch (err) {
      setError(
        isLogin
          ? err instanceof ApiError
            ? err.message
            : "No pudimos iniciar sesión."
          : err instanceof ApiError
            ? err.message
            : "No pudimos crear tu cuenta.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900 dark:ring-1 dark:ring-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{isLogin ? "Iniciar sesión" : "Crear cuenta"}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        {reason && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{reason}</p>}

        {/* Pestañas: cambiar entre iniciar sesión y registrarse en el MISMO modal. */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`rounded-md py-1.5 text-sm font-medium transition ${
              isLogin ? "bg-white text-brand-dark shadow-sm dark:bg-gray-700 dark:text-brand" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`rounded-md py-1.5 text-sm font-medium transition ${
              !isLogin ? "bg-white text-brand-dark shadow-sm dark:bg-gray-700 dark:text-brand" : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Correo
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Contraseña
            <input
              required
              minLength={isLogin ? undefined : 8}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          {!isLogin && (
            <>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={wantsModerator}
                  onChange={(e) => setWantsModerator(e.target.checked)}
                />
                Quiero postularme como moderador
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Un moderador verifica que los puntos de ayuda (refugios, centros de acopio, atención médica, etc.)
                sean reales antes de publicarse, y aprueba solicitudes de otras personas que quieran ser moderadoras.
                Márcalo solo si puedes dedicarle tiempo a esa verificación.
              </p>
              {wantsModerator && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tu solicitud quedará pendiente hasta que un moderador existente la apruebe.
                </p>
              )}
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-md bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {submitting ? (isLogin ? "Entrando…" : "Creando…") : isLogin ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}