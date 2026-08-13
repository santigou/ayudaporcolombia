import { createContext, useContext, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { LoginModal } from "../components/LoginModal";

interface LoginModalContextValue {
  // Abre el modal de login. `reason` es un texto opcional que explica por qué
  // se pide iniciar sesión (p. ej. "para verificar este punto").
  open: (reason?: string) => void;
  close: () => void;
}

const LoginModalContext = createContext<LoginModalContextValue | undefined>(undefined);

// Provider del modal de login global. Cualquier componente puede llamar
// useLoginModal().open() para pedir login sin navegar a /login (mejor UX: el
// usuario no pierde su contexto actual, p. ej. al verificar un punto).
export function LoginModalProvider({ children }: { children: ReactNode }) {
  const { login } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>(undefined);

  function open(reason?: string) {
    setReason(reason);
    setIsOpen(true);
  }
  function close() {
    setIsOpen(false);
    setReason(undefined);
  }

  return (
    <LoginModalContext.Provider value={{ open, close }}>
      {children}
      {isOpen && <LoginModal reason={reason} onClose={close} onLogin={login} />}
    </LoginModalContext.Provider>
  );
}

export function useLoginModal() {
  const ctx = useContext(LoginModalContext);
  if (!ctx) throw new Error("useLoginModal debe usarse dentro de LoginModalProvider");
  return ctx;
}
