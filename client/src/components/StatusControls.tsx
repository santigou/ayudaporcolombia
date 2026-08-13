import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import type { PointStatus } from "../types";

// Acciones de cambio de estado disponibles según el estado actual del punto.
// Resuelto/Cancelado se ofrecen como salida de "active"; Reactivar vuelve a active.
// (pending → cancelled se usa para retirar un offer_help en revisión.)
function actionsFor(status: PointStatus): { value: "resolved" | "cancelled" | "active"; label: string; tone: string }[] {
  if (status === "active") {
    return [
      { value: "resolved", label: "Marcar resuelto", tone: "bg-blue-600 hover:bg-blue-700" },
      { value: "cancelled", label: "Cancelar punto", tone: "bg-gray-500 hover:bg-gray-600" },
    ];
  }
  if (status === "resolved" || status === "cancelled") {
    return [{ value: "active", label: "Reactivar", tone: "bg-emerald-600 hover:bg-emerald-700" }];
  }
  if (status === "pending") {
    return [{ value: "cancelled", label: "Retirar de revisión", tone: "bg-gray-500 hover:bg-gray-600" }];
  }
  return [];
}

interface StatusControlsProps {
  pointId: string;
  status: PointStatus;
  createdById?: string | null;
  className?: string;
  // Cambio directo (creador o moderador). Devuelve el nuevo estado o lanza.
  onChangeStatus?: (status: "resolved" | "cancelled" | "active") => Promise<void>;
  changing?: boolean;
  // Solicitud de cambio (usuario no dueño). Devuelve void o lanza.
  onRequestStatusChange?: (status: "resolved" | "cancelled" | "active", reason?: string) => Promise<void>;
  requesting?: boolean;
}

// Controles de ciclo de vida de un Punto (resolved/cancelled/reactivar).
// - Creador del punto o moderador → acciones directas (onChangeStatus).
// - Otro usuario autenticado → formulario para SOLICITAR el cambio (motivo).
// - Sin sesión → abre el modal de login.
export function StatusControls({
  pointId: _pointId,
  status,
  createdById = null,
  className = "",
  onChangeStatus,
  changing = false,
  onRequestStatusChange,
  requesting = false,
}: StatusControlsProps) {
  const { user } = useAuth();
  const loginModal = useLoginModal();
  const [showRequest, setShowRequest] = useState(false);
  const [target, setTarget] = useState<"resolved" | "cancelled" | "active">("resolved");
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const isModerator = user?.role === "moderator";
  const isOwner = !!createdById && !!user && createdById === user.id;
  const canDirectChange = !!onChangeStatus && (isModerator || isOwner);
  const canRequest = !canDirectChange;

  const actions = actionsFor(status);

  function requireLogin() {
    loginModal.open("Inicia sesión para gestionar el estado de este punto.");
  }

  async function handleDirect(value: "resolved" | "cancelled" | "active") {
    setLocalError(null);
    setDone(null);
    try {
      await onChangeStatus!(value);
      setDone("Estado actualizado.");
      setTimeout(() => setDone(null), 2500);
    } catch {
      setLocalError("No pudimos cambiar el estado.");
    }
  }

  async function handleRequest() {
    setLocalError(null);
    setDone(null);
    try {
      await onRequestStatusChange!(target, reason.trim() || undefined);
      setDone("Solicitud enviada. Un moderador la revisará.");
      setShowRequest(false);
      setReason("");
      setTimeout(() => setDone(null), 4000);
    } catch {
      setLocalError("No pudimos enviar la solicitud.");
    }
  }

  if (actions.length === 0) return null;

  if (!user) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={requireLogin}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
        >
          Gestionar estado
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="rounded-md border border-gray-200 bg-gray-50 p-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Estado del punto</p>

        {canDirectChange ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {actions.map((a) => (
              <button
                key={a.value}
                type="button"
                disabled={changing}
                onClick={() => handleDirect(a.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold text-white transition disabled:opacity-60 ${a.tone}`}
              >
                {changing ? "…" : a.label}
              </button>
            ))}
          </div>
        ) : canRequest && onRequestStatusChange ? (
          <div className="mt-1.5">
            {showRequest ? (
              <div className="space-y-1.5">
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value as typeof target)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                >
                  {actions.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo (opcional)"
                  rows={2}
                  maxLength={500}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={requesting}
                    onClick={handleRequest}
                    className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
                  >
                    {requesting ? "Enviando…" : "Enviar solicitud"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequest(false);
                      setReason("");
                    }}
                    className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTarget(actions[0].value);
                  setShowRequest(true);
                }}
                className="rounded-md bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand-dark transition hover:bg-brand/20"
              >
                Solicitar cambio de estado
              </button>
            )}
          </div>
        ) : null}

        {localError && <p className="mt-1.5 text-xs text-red-600">{localError}</p>}
        {done && <p className="mt-1.5 text-xs font-medium text-emerald-700">{done}</p>}
      </div>
    </div>
  );
}
