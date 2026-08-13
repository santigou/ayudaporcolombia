import { useEffect, useState } from "react";

// Devuelve true si el viewport es >= md (768px), el mismo corte que el `md:`
// de Tailwind. Se usa para elegir entre el panel lateral (desktop) y el
// bottom-sheet overlay (móvil) del detalle de un punto.
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : true,
  );

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}
