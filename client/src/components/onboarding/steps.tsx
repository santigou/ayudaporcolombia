import { useCallback, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { MapView } from "../MapView";
import { PanicButton } from "../PanicButton";
import { OnboardingPointDetail } from "./OnboardingPointDetail";
import { MEDELLIN, buildMockPoints } from "./mockData";
import type { BBox, Point, PointUpdateItem, UpdateKind } from "../../types";

/* ===================== UI compartida ===================== */

function ActionButton({
  children,
  onClick,
  variant = "primary",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        variant === "primary"
          ? "rounded-full bg-brand px-6 py-3 font-semibold text-white shadow-lg hover:bg-brand-dark"
          : "rounded-full bg-gray-100 px-5 py-3 font-medium text-gray-700 hover:bg-gray-200"
      }
    >
      {children}
    </button>
  );
}

function StepFooter({ children }: { children: ReactNode }) {
  return <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">{children}</div>;
}

/* ===================== Paso 0: Bienvenida ===================== */

export function WelcomeStep({
  onNext,
  onSkip,
  sosOpen,
  onSosOpenChange,
  onSosCreated,
}: {
  onNext: () => void;
  onSkip: () => void;
  // Estado controlado del modal SOS (lo abre el botón grande de abajo). El SOS
  // de la bienvenida es SIEMPRE en modo real (crea un punto de verdad): si
  // alguien entra con una urgencia, no debe pasar por el tutorial para pedir ayuda.
  sosOpen: boolean;
  onSosOpenChange: (open: boolean) => void;
  onSosCreated: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Contenido superior (scrollable): bienvenida + qué aprenderás + CTA
          del tutorial. */}
      <div className="flex-1 overflow-y-auto px-6 py-8 text-center">
        <div className="mx-auto w-full max-w-md">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-3xl">🤝</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bienvenido a Ayuda por Colombia</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Una red ciudadana para conectar a quien necesita ayuda con quien la ofrece. En menos de un minuto aprenderás
            a usar el mapa y los puntos.
          </p>
          <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm text-gray-700 dark:text-gray-300">
            <li>🗺️ Moverte por el <strong>mapa interactivo</strong> y explorar puntos.</li>
            <li>📍 Abrir un <strong>punto de interés</strong> y leer su información.</li>
            <li>💬 Publicar <strong>novedades</strong> para coordinar la ayuda.</li>
          </ul>
          <div className="mt-7 flex flex-col items-center gap-3">
            <ActionButton onClick={onNext}>Empezar tutorial</ActionButton>
            <button onClick={onSkip} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              Omitir por ahora
            </button>
          </div>
        </div>
      </div>

      {/* SOS de emergencia: FIJO al fondo de la pantalla. SIEMPRE visible y fácil
          de alcanzar (con el pulgar en móvil) aunque el contenido de arriba haga
          scroll. Si alguien entra con una urgencia real, lo tiene a un toque. */}
      <div className="shrink-0 border-t border-red-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-red-950 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => onSosOpenChange(true)}
          aria-label="Pedir ayuda urgente"
          className="relative flex w-full items-center justify-center gap-3 rounded-2xl bg-red-600 px-6 py-4 font-bold text-white shadow-lg transition hover:bg-red-700"
        >
          <span className="absolute inset-0 -z-10 animate-ping rounded-2xl bg-red-600 opacity-30" />
          <span className="text-2xl leading-none">🆘</span>
          <span className="text-left text-lg leading-tight">
            NECESITO AYUDA
            <br />
            URGENTE
          </span>
        </button>
        <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
          ¿Una emergencia? Pulsa aquí para pedir ayuda <strong>ahora mismo</strong>, sin registro.
        </p>
      </div>

      {/* SOS modal en modo REAL (sin simulate): crea un punto de verdad en el
          backend. Controlado por `sosOpen` desde el botón grande de abajo. */}
      <PanicButton
        open={sosOpen}
        onOpenChange={onSosOpenChange}
        fallbackLocation={MEDELLIN}
        onCreated={onSosCreated}
      />
    </div>
  );
}

/* ===================== Paso 1: Permiso de ubicación ===================== */

export function LocationStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl dark:bg-blue-900/40">📍</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Tu ubicación</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Para mostrarte los puntos cercanos pediremos permiso para usar tu ubicación. Puedes aceptar o rechazar:
          </p>
          <div className="mt-5 grid gap-3 text-left">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">✓ Si aceptas</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">El mapa se centra en tu zona y verás los puntos cercanos a ti.</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">✗ Si rechazas</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                El mapa se centra en <strong>Medellín</strong> y podrás moverte libremente.
              </p>
            </div>
          </div>
        </div>
      </div>
      <StepFooter>
        <div className="flex items-center justify-between">
          <button onClick={onSkip} className="text-sm text-gray-500 hover:text-gray-700">
            Omitir
          </button>
          <ActionButton onClick={onNext}>Continuar</ActionButton>
        </div>
      </StepFooter>
    </div>
  );
}
/* ===================== Paso 2: Mapa interactivo (mock) ===================== */

export function MapStep({ onSelect, onSkip }: { onSelect: (p: Point) => void; onSkip: () => void }) {
  // Pre-sembramos los puntos alrededor de Medellín para que aparezcan enseguida;
  // en cuanto el mapa reporte su zona visible real (con la ubicación concedida),
  // regeneramos alrededor del nuevo centro.
  const [points, setPoints] = useState<Point[]>(() => buildMockPoints(MEDELLIN));
  const cellRef = useRef<string | null>(null);

  const onBounds = useCallback((bbox: BBox) => {
    const center = {
      lat: (bbox.minLat + bbox.maxLat) / 2,
      lng: (bbox.minLng + bbox.maxLng) / 2,
    };
    // Celda de ~2 km: si el centro no cambió de celda, no regeneramos (los puntos
    // son estables al hacer pan pequeño). Al aceptar/rechazar ubicación el mapa
    // vuela a otra zona → cambia de celda → regeneramos alrededor del nuevo centro.
    const cell = `${Math.round(center.lat / 0.02)},${Math.round(center.lng / 0.02)}`;
    if (cellRef.current === cell) return;
    cellRef.current = cell;
    setPoints(buildMockPoints(center));
  }, []);

  return (
    <div className="relative h-full w-full">
      <MapView points={points} onSelectPoint={onSelect} onBoundsChange={onBounds} />
      {/* Botón de pánico en modo simulación: añade un punto de "necesito ayuda"
          mock a la lista local del tutorial (no llama al backend). */}
      <div className="absolute left-4 top-1/2 z-10 -translate-y-1/2">
        <PanicButton
          simulate
          fallbackLocation={MEDELLIN}
          onSimulated={(p) => setPoints((prev) => [p, ...prev])}
        />
      </div>
      {/* Banner superior explicativo. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
        <div className="pointer-events-auto max-w-md rounded-lg bg-white/95 px-4 py-2 text-center text-sm shadow-md dark:bg-gray-900/95">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Explora el mapa</p>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Arrastra para moverte y usa +/− para acercar. <strong>Toca un punto</strong> para ver su detalle.
          </p>
        </div>
      </div>
      {/* Nota + omitir. */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-medium text-gray-600 shadow dark:bg-gray-900/90 dark:text-gray-300">
          Puntos de ejemplo (no reales)
        </span>
        <button onClick={onSkip} className="rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-gray-700 shadow hover:bg-white dark:bg-gray-900/90 dark:text-gray-200 dark:hover:bg-gray-800">
          Omitir
        </button>
      </div>
    </div>
  );
}

/* ===================== Pasos 3 y 4: detalle (info / novedades) ===================== */

export function PointStep({
  point,
  tab,
  onTabChange,
  updates,
  message,
  onMessageChange,
  kind,
  onKindChange,
  onSubmitNovedad,
  viewers,
  banner,
  onNext,
  onSkip,
}: {
  point: Point;
  tab: "info" | "novedades";
  onTabChange: (t: "info" | "novedades") => void;
  updates: PointUpdateItem[];
  message: string;
  onMessageChange: (v: string) => void;
  kind: UpdateKind;
  onKindChange: (v: UpdateKind) => void;
  onSubmitNovedad: () => void;
  viewers: number;
  banner: ReactNode;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">{banner}</div>
      <div className="min-h-0 flex-1">
        <OnboardingPointDetail
          point={point}
          tab={tab}
          onTabChange={onTabChange}
          updates={updates}
          message={message}
          onMessageChange={onMessageChange}
          kind={kind}
          onKindChange={onKindChange}
          onSubmitNovedad={onSubmitNovedad}
          viewers={viewers}
        />
      </div>
      <StepFooter>
        <div className="flex items-center justify-between">
          <button onClick={onSkip} className="text-sm text-gray-500 hover:text-gray-700">
            Omitir
          </button>
          <ActionButton onClick={onNext}>Continuar</ActionButton>
        </div>
      </StepFooter>
    </div>
  );
}

/* ===================== Paso 5: Listo ===================== */

export function DoneStep({ onComplete, onRegister, onLogin }: { onComplete: () => void; onRegister: () => void; onLogin: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mx-auto max-w-md">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl dark:bg-emerald-900/40">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">¡Listo!</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Ya sabes moverte por el mapa, abrir puntos y publicar novedades. Para crear puntos y verificarlos, crea una
          cuenta gratuita.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3">
          {/* Los CTAs abren el POPUP de auth (login/registro unificado) en vez de
              navegar a /registro o /login: el usuario no sale de la app. */}
          <button onClick={onRegister} className="rounded-full bg-brand px-6 py-3 font-semibold text-white shadow-lg hover:bg-brand-dark">
            Crear cuenta
          </button>
          <button onClick={onLogin} className="text-sm font-medium text-brand-dark hover:underline dark:text-brand">
            Ya tengo cuenta — iniciar sesión
          </button>
          <button onClick={onComplete} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            Explorar sin cuenta
          </button>
        </div>
      </div>
    </div>
  );
}