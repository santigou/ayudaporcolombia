import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "apc-theme";

// Hook de tema (claro/oscuro). La clase `.dark` la pone un script inline en
// index.html antes del primer paint (evita destello). Este hook la lee al montar
// y expone `toggle` para que el usuario cambie a mano; persiste en localStorage y
// actualiza el meta theme-color de la barra del navegador.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) return "dark";
    return "light";
  });

  const apply = useCallback((t: Theme) => {
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* almacenamiento no disponible: no persistimos */
    }
    // Actualiza el color de la barra del navegador móvil.
    const meta = document.getElementById("meta-theme-color");
    if (meta) meta.setAttribute("content", t === "dark" ? "#0b1220" : "#ffffff");
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      apply(next);
      return next;
    });
  }, [apply]);

  // Si el usuario cambia la preferencia del SISTEMA y nunca ha tocado el toggle,
  // lo seguimos. (Solo mientras no haya preferencia explícita guardada.)
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== null) return;
    } catch {
      return;
    }
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      const next: Theme = e.matches ? "dark" : "light";
      apply(next);
      setTheme(next);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [apply]);

  return { theme, toggle };
}