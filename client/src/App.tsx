import { useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import { BookOpen, ChevronDown, FileText, HelpCircle, LogOut, Moon, ShieldCheck, Sun } from "lucide-react";
import { TermsModal } from "./components/TermsModal";
import { Home } from "./pages/Home";
import { CreatePoint } from "./pages/CreatePoint";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ModeratorDashboard } from "./pages/ModeratorDashboard";
import { PointByCode } from "./pages/PointByCode";
import { Partners } from "./pages/Partners";
import { PartnersGuide } from "./pages/PartnersGuide";
import { PartnerDashboard } from "./pages/PartnerDashboard";
import { useAuth } from "./context/AuthContext";
import { useOnboarding } from "./context/OnboardingContext";
import { useLoginModal } from "./context/LoginModalContext";
import { useTheme } from "./hooks/useTheme";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow";

// Botones del nav de escritorio: pill con borde/fondo visibles siempre (no solo
// hover), para distinguirlos de texto informativo suelto (ver Navbar).
const navButton =
  "flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800";
// Variante circular para el botón de solo ícono (toggle de tema).
const navIconButton =
  "flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-base text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800";

function Navbar() {
  const { user, logout } = useAuth();
  const { reset } = useOnboarding();
  const { open } = useLoginModal();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  // Menú hamburguesa abierto/cerrado (solo móvil). En desktop se ignora.
  const [menuOpen, setMenuOpen] = useState(false);
  // Desplegable "Partners" del navbar de escritorio.
  const [partnersOpen, setPartnersOpen] = useState(false);
  useEffect(() => {
    if (!partnersOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPartnersOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [partnersOpen]);
  // Modal "Tus datos y esta app" (términos y uso de datos). Disponible para
  // cualquiera, con o sin sesión.
  const [termsOpen, setTermsOpen] = useState(false);

  // Cierra sesión y SIEMPRE vuelve al home: si estabas en /moderador o /crear,
  // esas páginas ya no tienen sentido para un usuario deslogueado.
  function handleLogout() {
    logout();
    navigate("/");
  }

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
    <header className="relative z-30 h-14 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 bg-white dark:bg-gray-900">
      <Link to="/" className="font-bold text-brand-dark dark:text-brand">
        Ayuda por Colombia
      </Link>

      {/* Nav de escritorio (≥md): horizontal. Los botones llevan borde/fondo
          visibles SIEMPRE (no solo en hover) para que se lean como controles a
          simple vista; el correo del usuario (solo informativo, no clicable)
          usa una "etiqueta" rellena sin borde para no confundirse con ellos. */}
      <nav className="hidden md:flex items-center gap-2 text-sm">
        <button onClick={toggle} aria-label="Cambiar tema" className={navIconButton}>
          {theme === "dark" ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
        </button>
        <button onClick={reset} className={navButton} title="Volver a ver el tutorial">
          <HelpCircle className="h-4 w-4" aria-hidden="true" /> ¿Cómo funciona?
        </button>
        <button onClick={() => setTermsOpen(true)} className={navButton}>
          <FileText className="h-4 w-4" aria-hidden="true" /> Privacidad
        </button>
        {/* Desplegable "Partners": portal (registro/gestión) y guía paso a paso.
            Se cierra al hacer clic fuera (backdrop) o con Escape, como el menú móvil. */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPartnersOpen((v) => !v)}
            aria-expanded={partnersOpen}
            aria-haspopup="menu"
            className={navButton}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Partners
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${partnersOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {partnersOpen && (
            <>
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setPartnersOpen(false)}
                className="fixed inset-0 z-20 cursor-default"
              />
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 w-60 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
              >
                <Link
                  to="/partners"
                  role="menuitem"
                  onClick={() => setPartnersOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>
                    Portal de partners
                    <span className="block text-xs text-gray-400">Registra tu app · API keys · mapeos</span>
                  </span>
                </Link>
                <Link
                  to="/partners/guia"
                  role="menuitem"
                  onClick={() => setPartnersOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  <span>
                    Cómo integrarse (guía)
                    <span className="block text-xs text-gray-400">Paso a paso con ejemplos de código</span>
                  </span>
                </Link>
              </div>
            </>
          )}
        </div>
        {user?.role === "moderator" && (
          <Link to="/moderador" className={navButton}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Moderación
          </Link>
        )}
        {user ? (
          <>
            <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
            <span
              className="hidden rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 sm:inline dark:bg-gray-800 dark:text-gray-400"
              title={user.email}
            >
              {user.email}
            </span>
            <button onClick={handleLogout} className={navButton}>
              <LogOut className="h-4 w-4" aria-hidden="true" /> Salir
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
        className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
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
          <div className="absolute right-0 top-14 z-30 w-60 origin-top-right rounded-b-lg border border-t-0 border-gray-200 bg-white py-1 shadow-lg md:hidden dark:border-gray-700 dark:bg-gray-900">
            {/* Toggle claro/oscuro: en escritorio vive en el nav (hidden md:flex),
                así que en móvil solo aparecía aquí — antes no aparecía en ningún
                lado. */}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                toggle();
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-4 w-4" aria-hidden="true" /> Modo claro
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" aria-hidden="true" /> Modo oscuro
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                reset();
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <HelpCircle className="h-4 w-4" aria-hidden="true" /> ¿Cómo funciona?
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setTermsOpen(true);
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <FileText className="h-4 w-4" aria-hidden="true" /> Privacidad
            </button>
            <Link
              to="/partners"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Portal de partners
            </Link>
            <Link
              to="/partners/guia"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" /> Cómo integrarse (guía)
            </Link>
            {user?.role === "moderator" && (
              <Link
                to="/moderador"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Moderación
              </Link>
            )}
            <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
            {user ? (
              <>
                <span className="block truncate px-4 py-1.5 text-xs text-gray-400 dark:text-gray-500" title={user.email}>
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" /> Salir
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  open();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-brand-dark hover:bg-gray-50 dark:text-brand dark:hover:bg-gray-800"
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

      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
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
          <Route path="/partners" element={<Partners />} />
          <Route path="/partners/guia" element={<PartnersGuide />} />
          <Route path="/partners/dashboard" element={<PartnerDashboard />} />
          <Route path="/p/:code" element={<PointByCode />} />
        </Routes>
      </div>
    </div>
  );
}
