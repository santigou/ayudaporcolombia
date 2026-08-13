import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import type { PointType, VerificationStatus } from "../types";

interface VerifyBarProps {
  code: string;
  validationCount: number;
  userValidated: boolean;
  validating: boolean;
  onValidate: () => void;
  className?: string;
  // Verificación oficial de moderador (solo need_help pendientes).
  pointType: PointType;
  verificationStatus: VerificationStatus;
  onModeratorVerify?: () => void;
  moderatorVerifying?: boolean;
}

// Barra de verificación/compartir: muestra el código del punto (copiable), un
// botón para verificarlo (confirmación comunitaria) y otro para compartir el link.
// La verificación NO aprueba el punto; solo suma evidencia para el moderador.
// Si no hay sesión al pulsar "Verificar", abre el modal de login en vez de llamar
// al endpoint (mejor UX que navegar a /login o fallar silenciosamente).
// Además, si el usuario es moderador y el punto es need_help sin verificar, muestra
// un botón para verificación oficial (cambia el badge a "Verificado").
export function VerifyBar({
  code,
  validationCount,
  userValidated,
  validating,
  onValidate,
  className = "",
  pointType,
  verificationStatus,
  onModeratorVerify,
  moderatorVerifying = false,
}: VerifyBarProps) {
  const { user } = useAuth();
  const loginModal = useLoginModal();
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/p/${code}`;

  const isModerator = user?.role === "moderator";
  // El moderador solo puede verificar oficialmente need_help que aún no lo estén.
  const canModeratorVerify =
    isModerator && pointType === "need_help" && verificationStatus === "pending" && !!onModeratorVerify;

  function handleValidate() {
    if (!user) {
      loginModal.open("Inicia sesión para verificar este punto y ayudar a confirmarlo.");
      return;
    }
    onValidate();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible */
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Punto de ayuda", url: shareUrl });
      } catch {
        /* cancelado */
      }
    } else {
      copyLink();
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <code className="rounded bg-gray-100 px-2 py-1 text-[11px] font-mono font-semibold tracking-wide text-gray-700 select-all">
        {code}
      </code>
      <button
        type="button"
        onClick={handleValidate}
        disabled={userValidated || validating}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
          userValidated
            ? "bg-emerald-100 text-emerald-700"
            : "bg-brand/10 text-brand-dark hover:bg-brand/20"
        } disabled:opacity-70`}
        title={userValidated ? "Ya verificaste este punto" : "Confirmar que este punto es real"}
      >
        {userValidated ? "✓ Verificado" : validating ? "…" : "Verificar"} ({validationCount})
      </button>
      <button
        type="button"
        onClick={share}
        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition hover:bg-gray-200"
        title="Compartir enlace"
      >
        {copied ? "✓ Copiado" : "Compartir"}
      </button>
      {canModeratorVerify && (
        <button
          type="button"
          onClick={onModeratorVerify}
          disabled={moderatorVerifying}
          className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          title="Marcar este punto como verificado oficialmente"
        >
          {moderatorVerifying ? "…" : "✓ Verificar oficial"}
        </button>
      )}
    </div>
  );
}
