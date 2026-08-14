import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

// Clave VERSIONADA en localStorage. Si en el futuro cambiamos el contenido del
// tutorial, subimos la versión (v2, v3…) y el onboarding volverá a mostrarse a
// todos los usuarios. Usar localStorage aquí (no cookies) es correcto porque NO
// es un dato sensible: es solo un flag "ya vio el tutorial". Los tokens de
// sesión siguen yendo a cookies httpOnly, como dicta la arquitectura de auth.
const STORAGE_KEY = "ayuda:onboarding:v1";

interface OnboardingContextValue {
  // true si el usuario ya completó el tutorial (flag persistido).
  isComplete: boolean;
  // true mientras el flujo de onboarding está visible. Al arrancar la app, si
  // NO está marcado como completo → activo.
  active: boolean;
  // Marca el onboarding como completado (persiste + oculta el flujo).
  complete: () => void;
  // Vuelve a mostrar el tutorial (lo usa el botón "¿Cómo funciona?" del navbar).
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isComplete, setIsComplete] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  // Al montar: si ya completó, no mostramos el flujo.
  const [active, setActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "1";
    } catch {
      return true;
    }
  });

  const complete = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* localStorage puede fallar en modo privado: no persistimos, pero el flag
         en memoria evita que el tutorial vuelva a aparecer en esta sesión. */
    }
    setIsComplete(true);
    setActive(false);
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignorar */
    }
    setIsComplete(false);
    setActive(true);
  }, []);

  return (
    <OnboardingContext.Provider value={{ isComplete, active, complete, reset }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding debe usarse dentro de OnboardingProvider");
  return ctx;
}