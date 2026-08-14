import { useState } from "react";
import { useOnboarding } from "../../context/OnboardingContext";
import { useLoginModal } from "../../context/LoginModalContext";
import { MEDELLIN, buildMockPoints, INITIAL_TUTORIAL_UPDATES, uid } from "./mockData";
import { WelcomeStep, LocationStep, MapStep, PointStep, DoneStep } from "./steps";
import type { Point, PointUpdateItem, UpdateKind } from "../../types";

const TOTAL_STEPS = 6;

// Flujo de onboarding a pantalla completa (z-50, tapando el navbar). Mientras
// está montado, App NO renderiza <Routes>, así que Home/Crear/etc. no se montan
// y no se hacen llamadas a /points, /points/:id ni se abre el socket: el tutorial
// es 100% local/mock. Termina con complete() (marca el flag en localStorage).
export function OnboardingFlow() {
  const { complete } = useOnboarding();
  const { open, openRegister } = useLoginModal();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Point | null>(null);
  // Estado compartido entre los pasos 3 y 4 (pestaña activa + novedades simuladas).
  const [tab, setTab] = useState<"info" | "novedades">("info");
  const [updates, setUpdates] = useState<PointUpdateItem[]>(INITIAL_TUTORIAL_UPDATES);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<UpdateKind>("message");
  const viewers = 3;

  // Estado del modal SOS de la bienvenida. El SOS es SIEMPRE en modo real (crea
  // un punto de verdad). Tras crearlo, el usuario ve la confirmación y, al
  // cerrarla, completamos el onboarding para que aterrice en el mapa real.
  const [sosOpen, setSosOpen] = useState(false);
  const [sosCreated, setSosCreated] = useState(false);

  // Punto a mostrar en el detalle: el que tocó el usuario, o el primero mock si
  // llegara aquí sin seleccionar (no debería ocurrir, pero evita null).
  const point: Point = selected ?? buildMockPoints(MEDELLIN)[0];

  function handleSelect(p: Point) {
    setSelected(p);
    setTab("info");
    setStep(3);
  }

  // Simula la publicación de una novedad: la añade al inicio de la lista local.
  // NO llama al backend ni exige sesión (se explica en el aviso del paso 4).
  function simulateNovedad() {
    const text = message.trim();
    if (!text) return;
    const item: PointUpdateItem = {
      id: uid(),
      message: text,
      kind,
      createdAt: new Date().toISOString(),
      createdByEmail: "tú (demo)",
    };
    setUpdates((prev) => [item, ...prev]);
    setMessage("");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900">
      {/* Barra de progreso (oculta en bienvenida y en el paso final). */}
      {step > 0 && step < 5 && (
        <div className="flex shrink-0 items-center gap-1.5 px-4 py-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? "bg-brand" : "bg-gray-200"}`}
            />
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {step === 0 && (
          <WelcomeStep
            onNext={() => setStep(1)}
            onSkip={complete}
            sosOpen={sosOpen}
            onSosOpenChange={(open) => {
              setSosOpen(open);
              // Si el usuario cerró el modal tras crear un punto real, salimos del
              // tutorial y aterrizamos en la Home real (donde verá su punto).
              if (!open && sosCreated) complete();
            }}
            onSosCreated={() => setSosCreated(true)}
          />
        )}
        {step === 1 && <LocationStep onNext={() => setStep(2)} onSkip={complete} />}
        {step === 2 && <MapStep onSelect={handleSelect} onSkip={complete} />}
        {step === 3 && (
          <PointStep
            point={point}
            tab={tab}
            onTabChange={setTab}
            updates={updates}
            message={message}
            onMessageChange={setMessage}
            kind={kind}
            onKindChange={setKind}
            onSubmitNovedad={simulateNovedad}
            viewers={viewers}
            banner={
              <>
                Este es el <strong>detalle de un punto</strong>. Revisa sus secciones: estado, galería, información (qué
                necesita/ofrece y contactos) y la pestaña <strong>Novedades</strong>.
              </>
            }
            onNext={() => {
              setTab("novedades");
              setStep(4);
            }}
            onSkip={complete}
          />
        )}
        {step === 4 && (
          <PointStep
            point={point}
            tab={tab}
            onTabChange={setTab}
            updates={updates}
            message={message}
            onMessageChange={setMessage}
            kind={kind}
            onKindChange={setKind}
            onSubmitNovedad={simulateNovedad}
            viewers={viewers}
            banner={
              <>
                En <strong>Novedades</strong> se coordina la ayuda en tiempo real. Como no tienes cuenta, lo{" "}
                <strong>simulamos</strong>: escribe y pulsa “Simular novedad”.
              </>
            }
            onNext={() => setStep(5)}
            onSkip={complete}
          />
        )}
        {/* Último paso: los CTAs de cuenta abren el POPUP (no navegan a /login).
            Tras abrirlo cerramos el onboarding (complete) para que el usuario
            aterrice en la Home real con el modal de auth encima. */}
        {step === 5 && (
          <DoneStep
            onComplete={complete}
            onRegister={() => { complete(); openRegister(); }}
            onLogin={() => { complete(); open(); }}
          />
        )}
      </div>
    </div>
  );
}