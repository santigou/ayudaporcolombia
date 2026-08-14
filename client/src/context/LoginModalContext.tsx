import { createContext, useContext, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { AuthModal, type AuthMode } from "../components/AuthModal";

interface LoginModalContextValue {
  // Abre el modal en modo LOGIN. `reason` es un texto opcional que explica por
  // qué se pide iniciar sesión (p. ej. "para verificar este punto"). Se mantiene
  // como string por compatibilidad con los llamadores existentes (VerifyBar,
  // StatusControls).
  open: (reason?: string) => void;
  // Abre el modal directamente en modo REGISTRO (p. ej. CTA del navbar).
  openRegister: (reason?: string) => void;
  close: () => void;
}

const LoginModalContext = createContext<LoginModalContextValue | undefined>(undefined);

// Provider del modal de login global. Cualquier componente puede llamar
// useLoginModal().open() para pedir login sin navegar a /login (mejor UX: el
// usuario no pierde su contexto actual, p. ej. al verificar un punto).
export function LoginModalProvider({ children }: { children: ReactNode }) {
  const { login, register } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<AuthMode>("login");

  function open(reason?: string) {
    setReason(reason);
    setMode("login");
    setIsOpen(true);
  }
  function openRegister(reason?: string) {
    setReason(reason);
    setMode("register");
    setIsOpen(true);
  }
  function close() {
    setIsOpen(false);
    setReason(undefined);
  }

  return (
    <LoginModalContext.Provider value={{ open, openRegister, close }}>
      {children}
      {isOpen && (
        <AuthModal
          reason={reason}
          mode={mode}
          onModeChange={setMode}
          onClose={close}
          onLogin={login}
          onRegister={register}
        />
      )}
    </LoginModalContext.Provider>
  );
}

export function useLoginModal() {
  const ctx = useContext(LoginModalContext);
  if (!ctx) throw new Error("useLoginModal debe usarse dentro de LoginModalProvider");
  return ctx;
}
