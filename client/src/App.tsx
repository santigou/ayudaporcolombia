import { useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { CreatePoint } from "./pages/CreatePoint";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ModeratorDashboard } from "./pages/ModeratorDashboard";
import { PointByCode } from "./pages/PointByCode";
import { useAuth } from "./context/AuthContext";
import { useOnboarding } from "./context/OnboardingContext";
import { useLoginModal } from "./context/LoginModalContext";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow";

function Navbar() {
  const { user, logout } = useAuth();
  const { reset } = useOnboarding();
  const { open } = useLoginModal();
  // Menú hamburguesa abierto/cerrado (solo móvil). En desktop se ignora.
  const [menuOpen, setMenuOpen] = useState(false);

  // Cierra el panel con Escape (accesibilidad).
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="relative z-30 h-14 border-b border-gray-200 flex items-center justify-between px-4 bg-white">
      <Link to="/" className="font-bold text-brand-dark">
        Ayuda por Colombia
      </Link>

      {/* Nav de escritorio (≥md): horizontal, igual que antes. */}
      <nav className="hidden md:flex items-center gap-3 text-sm">
        <button onClick={reset} className="text-gray-500 hover:text-brand-dark" title="Volver a ver el tutorial">
          ¿Cómo funciona?
        </button>
        {user?.role === "moderator" && (
          <Link to="/moderador" className="text-gray-600 hover:text-brand-dark">
            Moderación
          </Link>
        )}
        {user ? (
          <>
            <span className="text-gray-500 hidden sm:inline">{user.email}</span>
            <button onClick={() => logout()} className="text-gray-600 hover:text-brand-dark">
              Salir
            </button>
          </>
        ) : (
          // Un solo botón: abre el popup de auth (login/registro unificado). Así
          // no se navega a /login ni a /registro; el usuario se queda en su página.
          // Resaltado en verde de marca para que destaque como CTA principal.
          <button
            onClick={() => open()}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
          >
            Ingresar / Registro
          </button>
        )}
      </nav>

      {/* Botón hamburguesa (solo móvil). */}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={menuOpen}
        className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
      >
        <span className="text-xl leading-none">{menuOpen ? "✕" : "☰"}</span>
      </button>

      {/* Panel desplegable (solo móvil): bajo la cabecera, con backdrop para
          cerrar al tocar fuera. Cada acción cierra el menú tras ejecutarse. */}
      {menuOpen && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 top-14 z-20 bg-black/20 md:hidden"
          />
          <div className="absolute right-0 top-14 z-30 w-60 origin-top-right rounded-b-lg border border-t-0 border-gray-200 bg-white py-1 shadow-lg md:hidden">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                reset();
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              ¿Cómo funciona?
            </button>
            {user?.role === "moderator" && (
              <Link
                to="/moderador"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Moderación
              </Link>
            )}
            <div className="my-1 border-t border-gray-100" />
            {user ? (
              <>
                <span className="block truncate px-4 py-1.5 text-xs text-gray-400" title={user.email}>
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Salir
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  open();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-brand-dark hover:bg-gray-50"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] text-white">
                  →
                </span>
                Ingresar / Registro
              </button>
            )}
          </div>
        </>
      )}
    </header>
  );
}

export function App() {
  const { active } = useOnboarding();
  // Mientras el onboarding está activo mostramos SOLO el flujo: así no se montan
  // Home/Crear/etc. y se garantiza cero llamadas a /points, /points/:id ni socket
  // durante el tutorial (todo es mockeado/local).
  if (active) return <OnboardingFlow />;
  return (
    <div className="flex flex-col h-full">
      <Navbar />
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/crear" element={<CreatePoint />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/moderador" element={<ModeratorDashboard />} />
          <Route path="/p/:code" element={<PointByCode />} />
        </Routes>
      </div>
    </div>
  );
}
