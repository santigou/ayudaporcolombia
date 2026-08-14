import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { HELP_TYPES, type HelpTypeOption, type Point } from "../types";

interface PanicButtonProps {
  // Modo simulación (onboarding): NO llama al backend. Construye un punto mock y
  // avisa al padre vía onSimulated para añadirlo a la lista local del tutorial.
  simulate?: boolean;
  onSimulated?: (point: Point) => void;
  // Ubicación de respaldo si la geolocalización falla o se deniega (centro del
  // mapa / Medellín).
  fallbackLocation: { lat: number; lng: number };
  // Tras crear (modo real): el padre puede refrescar el mapa para mostrarlo.
  onCreated?: () => void;
  // Tras eliminar un punto creado por error (botón "Eliminar" en la pantalla de
  // éxito): el padre refresca el mapa / quita el punto.
  onDelete?: () => void;
  // Modo controlado: el padre decide cuándo abrir el modal (con su propio botón
  // personalizado, p. ej. un SOS grande en la bienvenida). Si NO se pasa, el
  // componente renderiza su botón flotante por defecto y gestiona su estado.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Botón de pánico (SOS): crea un punto "necesito ayuda" en la ubicación actual
// del usuario con los MÍNIMOS datos posibles y SIN contacto (es anónimo). Pensado
// para emergencias: 1 toque → elegir categoría → publicar. En el onboarding
// (simulate) no toca el backend: genera un mock y lo añade a la lista local.
export function PanicButton({
  simulate,
  onSimulated,
  fallbackLocation,
  onCreated,
  onDelete,
  open: controlledOpen,
  onOpenChange,
}: PanicButtonProps) {
  // Si el padre pasa `open`, operamos en modo controlado (no mostramos botón
  // propio). Si no, usamos estado interno + botón flotante por defecto.
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;

  const [category, setCategory] = useState<HelpTypeOption>("Otro");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; id?: string; deleteToken?: string } | null>(null);
  // Cuenta regresiva antes de crear el punto (segundos restantes). null = no hay
  // cuenta activa. Al pulsar "Pedir ayuda" arrancamos en 15; el usuario puede
  // cancelar antes de llegar a 0 para NO crear el punto por error.
  const [countdown, setCountdown] = useState<number | null>(null);

  // Al abrir el modal en modo controlado, reseteamos el formulario (para que no
  // quede el estado de un envío anterior, p. ej. la pantalla de "¡Ayuda pedida!").
  useEffect(() => {
    if (isControlled && controlledOpen) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledOpen, isControlled]);

  // Cierra el modal con Escape (accesibilidad).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    setCategory("Otro");
    setNote("");
    setSubmitting(false);
    setError(null);
    setDone(null);
  }
  function close() {
    if (isControlled) {
      reset();
      onOpenChange?.(false);
    } else {
      setInternalOpen(false);
      reset();
    }
  }

  // Obtiene la ubicación actual; si falla o se deniega, usa el centro del mapa.
  function getPosition(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve(fallbackLocation);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(fallbackLocation),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
      );
    });
  }

  // Al pulsar "Pedir ayuda" NO creamos de inmediato: arrancamos una cuenta
  // regresiva de 15s. Si el usuario cancela antes de 0, no se crea nada (evita
  // pulsos accidentales). Si llega a 0, se crea el punto.
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCountdown(15);
  }

  function cancelCountdown() {
    setCountdown(null);
  }

  // Crea el punto (real o mock). Lo llama el timer cuando la cuenta llega a 0.
  async function doCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const { lat, lng } = await getPosition();
      const description =
        "Solicitud de ayuda urgente enviada desde el botón de emergencia SOS." +
        (note.trim() ? ` ${note.trim()}` : "");

      if (simulate) {
        // Onboarding: mock, sin backend. Avisamos al padre para añadirlo al mapa.
        const mock: Point = {
          id: `sos-${Date.now()}`,
          code: `SOS-${Math.floor(Math.random() * 9000 + 1000)}`,
          type: "need_help",
          title: `Necesito ayuda: ${category}`,
          description,
          status: "active",
          verificationStatus: "pending",
          createdAt: new Date().toISOString(),
          helpType: category,
          location: { lat, lng, address: null, city: "Tu ubicación", neighborhood: "SOS" },
          photos: [],
          contacts: [],
          supplies: [],
          validationCount: 0,
        };
        onSimulated?.(mock);
        setDone({ code: mock.code, id: mock.id });
        return;
      }

      // App real: POST anónimo (need_help no requiere cuenta ni contacto). El
      // backend devuelve el punto + deleteToken para poder borrarlo tras crear.
      const created = await api.post<{ code: string; id: string; deleteToken: string }>("/points", {
        type: "need_help",
        title: `Necesito ayuda: ${category}`,
        description,
        helpTypeName: category,
        lat,
        lng,
        contacts: [],
        photoUrls: [],
      });
      onCreated?.();
      setDone({ code: created.code, id: created.id, deleteToken: created.deleteToken });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos crear el punto. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
      setCountdown(null);
    }
  }

  // Timer de la cuenta regresiva: decrementa cada segundo y, al llegar a 0,
  // dispara la creación. Se limpia al desmontar / cancelar.
  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) {
      doCreate();
      return;
    }
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // Borra el punto recién creado (si se pulsó por error). Usa el deleteToken que
  // devolvió el backend. Tras borrar, cierra el modal y avisa al padre.
  async function handleDelete() {
    if (!done?.id) return;
    try {
      if (!simulate && done.deleteToken) {
        await api.delete(`/points/${done.id}`, { deleteToken: done.deleteToken });
      }
      onDelete?.();
      close();
    } catch {
      setError("No pudimos eliminar el punto. Inténtalo más tarde.");
    }
  }
  return (
    <>
      {/* Botón flotante rojo (SOS). Solo se renderiza en modo no controlado
          (cuando el padre no pasa `open`). La posición exacta la define el
          contenedor del padre (absolute ...). El anillo ping lo hace muy visible. */}
      {!isControlled && (
        <button
          type="button"
          onClick={() => setInternalOpen(true)}
          aria-label="Pedir ayuda urgente (SOS)"
          className="group relative flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full bg-red-600 text-white shadow-xl ring-4 ring-white transition hover:bg-red-700 focus:outline-none focus:ring-red-300"
        >
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-red-600 opacity-40" />
          <SosIcon className="h-5 w-5" />
          <span className="text-[11px] font-extrabold leading-none tracking-wide">SOS</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={submitting ? undefined : close}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {done ? (
              <SuccessView code={done.code} onClose={close} onDelete={handleDelete} canDelete={!!done.id} />
            ) : countdown != null ? (
              <CountdownView
                seconds={countdown}
                category={category}
                onCancel={cancelCountdown}
                submitting={submitting}
              />
            ) : (
              <PanicForm
                category={category}
                onCategoryChange={setCategory}
                note={note}
                onNoteChange={setNote}
                submitting={submitting}
                error={error}
                onSubmit={handleSubmit}
                onCancel={close}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
function PanicForm({
  category,
  onCategoryChange,
  note,
  onNoteChange,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  category: HelpTypeOption;
  onCategoryChange: (t: HelpTypeOption) => void;
  note: string;
  onNoteChange: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white">
            <SosIcon className="h-4 w-4" />
          </span>
          Pedir ayuda urgente
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cerrar"
          className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
      <p className="text-sm text-gray-500">
        Se publicará un punto de <strong>necesito ayuda</strong> en tu ubicación actual. Es anónimo y no requiere datos
        de contacto.
      </p>
      <div>
        <span className="text-sm font-medium text-gray-700">¿Qué necesitas?</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {HELP_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onCategoryChange(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                category === t ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <label className="text-sm font-medium text-gray-700">
        Nota (opcional)
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Ej. necesitamos agua y atención médica…"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
        >
          {submitting ? "Enviando…" : "🆘 Pedir ayuda"}
        </button>
      </div>
    </form>
  );
}

function CountdownView({ seconds, category, onCancel, submitting }: { seconds: number; category: string; onCancel: () => void; submitting: boolean }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-gray-900">¿Necesitas ayuda con {category}?</p>
      <div className="relative mx-auto my-4 flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-30" />
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600 text-3xl font-extrabold text-white">
          {submitting ? "…" : seconds}
        </span>
      </div>
      <p className="text-sm text-gray-600">
        Se publicará tu punto de ayuda <strong>automáticamente en {seconds} segundo{seconds === 1 ? "" : "s"}</strong>.
      </p>
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="mt-4 w-full rounded-md bg-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-300 disabled:opacity-60"
      >
        ✕ Cancelar (no publicar)
      </button>
      <p className="mt-2 text-xs text-gray-400">
        {submitting ? "Creando punto…" : "Si fue un error, pulsa Cancelar antes de que termine."}
      </p>
    </div>
  );
}

function SuccessView({ code, onClose, onDelete, canDelete }: { code: string; onClose: () => void; onDelete: () => void; canDelete: boolean }) {
  const shareUrl = `${window.location.origin}/p/${code}`;
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl">✓</div>
      <h2 className="text-lg font-bold text-gray-900">¡Ayuda pedida!</h2>
      <p className="mt-1 text-sm text-gray-600">
        Tu punto <strong className="font-mono">{code}</strong> ya está visible en el mapa. Compártelo si puedes:
      </p>
      <code className="mt-3 block break-all rounded-md bg-gray-100 px-3 py-2 text-xs font-mono text-gray-700">{shareUrl}</code>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mt-2 w-full rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
        >
          🗑 Eliminar este punto (creado por error)
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Cerrar
      </button>
      {canDelete && (
        <p className="mt-2 text-xs text-gray-400">Si lo eliminaste por error, puedes volver a pedir ayuda cuando quieras.</p>
      )}
    </div>
  );
}

// Icono de alerta (triángulo con !) — señal universal de emergencia. Sin librería
// de iconos: SVG inline para no añadir dependencias.
function SosIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}