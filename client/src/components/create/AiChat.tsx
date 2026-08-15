// Vista de chat con IA local (WebLLM) para crear puntos. Se monta dentro del
// BottomSheet del asistente (/crear) cuando mode === "chat".
//
// Flujo: selector de modelo (descarga una vez) → chat estilo burbujas con
// streaming → al terminar, tarjeta editable con lo recopilado → "Continuar"
// devuelve el borrador al wizard, que salta al paso de ubicación en el mapa.
//
// Todo el procesamiento del LLM ocurre en el dispositivo del usuario (WebGPU);
// ningún mensaje sale de él.

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Cpu, ImagePlus, MapPin, Send, ShieldCheck, Sparkles, Square, X } from "lucide-react";
import { useLocalChat } from "../../hooks/useLocalChat";
import { findModelOption, type LocalModelOption } from "../../llm/models";
import {
  MISSING_FIELDS,
  MISSING_LABELS,
  isLowQuality,
  stripMarkers,
  type AiPointDraft,
  type MissingField,
} from "../../llm/prompt";
import { searchAddress, type AddressResult } from "../AddressSearch";
import {
  CONTACT_LABELS,
  CONTACT_TYPES,
  HELP_TYPES,
  MAX_PHOTOS,
  type ContactInfo,
  type HelpTypeOption,
  type PointType,
} from "../../types";

interface AiChatExtras {
  // Ubicación elegida en el chat (buscador o mapa); null si no se marcó.
  location: AddressResult | null;
  // Fotos adjuntadas en el chat (pasan al asistente al aplicar).
  photos: File[];
}

interface AiChatProps {
  // Aplica el borrador recopilado + extras (ubicación y fotos). Si hay
  // ubicación, el wizard salta directo al paso de revisión.
  onApply: (draft: AiPointDraft, extras: AiChatExtras) => void;
  // Vuelve al formulario manual (sin aplicar datos).
  onExit: () => void;
  // Cierra el asistente por completo (mismo comportamiento que la × del wizard).
  onClose: () => void;
  // Pide al asistente (wizard) activar el modo "tocar el mapa": colapsa la
  // hoja y el próximo tap en el mapa llama a onPicked con la ubicación
  // geocodificada (el control vuelve al chat).
  requestMapPick: (onPicked: (r: AddressResult) => void) => void;
}

// Cabecera compartida: volver, título y cerrar.
function ChatHeader({
  showBack,
  subtitle,
  onBack,
  onClose,
}: {
  showBack: boolean;
  subtitle: string;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
      <div className="flex min-w-0 items-center gap-1.5">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <div className="min-w-0">
          <p className="truncate text-[11px] uppercase tracking-wide text-gray-400">{subtitle}</p>
          <h2 className="text-base font-semibold text-gray-900">Cuéntalo por chat</h2>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="rounded-md px-2 text-2xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      >
        ×
      </button>
    </header>
  );
}

// Selector de modelo local. Se muestra la primera vez (antes de descargar) y
// también desde "cambiar modelo" cuando ya hay un chat activo.
function ModelPicker({
  models,
  selected,
  busy,
  onStart,
  onChoose,
  onSecondary,
  secondaryLabel,
}: {
  models: LocalModelOption[];
  selected: string;
  busy: boolean;
  onStart: () => void;
  onChoose: (id: string) => void;
  onSecondary: () => void;
  secondaryLabel: string;
}) {
  const list = models.length > 0 ? models : [findModelOption(selected)];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Crear punto con IA</h2>
          <p className="text-xs text-gray-500">Cuéntalo por chat y lo estructuro por ti</p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          El modelo se ejecuta <strong>100% en tu dispositivo</strong> (WebGPU): tus mensajes
          nunca salen de él. La descarga es solo la primera vez y queda en la caché del
          navegador.
        </p>
      </div>

      <p className="mt-4 text-sm font-medium text-gray-700">Elige un modelo</p>
      <div className="mt-2 flex flex-col gap-2">
        {list.map((m) => (
          <label
            key={m.id}
            className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 ${
              selected === m.id ? "border-brand bg-brand/5" : "border-gray-200"
            }`}
          >
            <input
              type="radio"
              name="ai-model"
              checked={selected === m.id}
              onChange={() => onChoose(m.id)}
              className="mt-0.5 accent-emerald-600"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-800">
                {m.label} <span className="font-normal text-gray-500">· {m.size}</span>
              </span>
              <span className="block text-xs text-gray-500">{m.note}</span>
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={busy}
        className="mt-4 w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        Descargar modelo y empezar
      </button>
      <button
        type="button"
        onClick={onSecondary}
        className="mt-2 w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        {secondaryLabel}
      </button>
    </div>
  );
}

// Pantalla de descarga del modelo (primera vez) con el progreso de WebLLM,
// o de error con reintento.
function LoadingModel({
  label,
  progress,
  error,
  onRetry,
  onExit,
}: {
  label: string;
  progress: string;
  error: string | null;
  onRetry: () => void;
  onExit: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      {error ? (
        <>
          <p className="text-sm font-semibold text-red-600">{error}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={onExit}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Usar el formulario
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="flex h-10 w-10 animate-pulse items-center justify-center rounded-full bg-brand/10 text-brand-dark">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-gray-900">Descargando {label}…</h2>
          <p className="text-xs text-gray-500">
            Solo la primera vez; después queda en la caché del navegador.
          </p>
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-100">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-brand" />
          </div>
          {progress && (
            <p className="max-w-xs break-words text-[11px] text-gray-400">{progress}</p>
          )}
        </>
      )}
    </div>
  );
}

// Chips de progreso: qué ya se tiene (✓) y qué falta (○). Al tocar "ubicación"
// se abre la tarjeta de ubicación; los demás solo informan.
function MissingChips({
  missing,
  hasLocation,
  onOpenLocation,
}: {
  missing: MissingField[];
  hasLocation: boolean;
  onOpenLocation: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 px-4 py-2">
      {MISSING_FIELDS.map((f) => {
        const done = !missing.includes(f) || (f === "ubicacion" && hasLocation);
        const clickable = f === "ubicacion" && !done;
        return (
          <button
            key={f}
            type="button"
            onClick={clickable ? onOpenLocation : undefined}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              done
                ? "bg-emerald-100 text-emerald-700"
                : clickable
                  ? "bg-gray-100 text-gray-600 underline hover:bg-gray-200"
                  : "bg-gray-100 text-gray-500"
            }`}
          >
            {done ? "✓" : "○"} {MISSING_LABELS[f]}
          </button>
        );
      })}
    </div>
  );
}

// Tira de fotos adjuntadas en el chat (mismo patrón que PhotoInput, en miniatura).
function PhotoStrip({
  photos,
  onChange,
  max,
}: {
  photos: File[];
  onChange: (files: File[]) => void;
  max: number;
}) {
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);
  if (photos.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-2">
      {previews.map((src, i) => (
        <div key={i} className="relative h-12 w-12 overflow-hidden rounded border border-gray-200">
          <img src={src} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(photos.filter((_, j) => j !== i))}
            aria-label="Quitar foto"
            className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl bg-black/60 text-[10px] text-white"
          >
            ×
          </button>
        </div>
      ))}
      <span className="self-center text-[11px] text-gray-400">
        {photos.length}/{max}
      </span>
    </div>
  );
}

// Tarjeta de ubicación dentro del chat: busca el lugar (Nominatim, Colombia),
// muestra resultados para elegir, o deja marcarlo tocando el mapa (el asistente
// colapsa la hoja y devuelve el control con la ubicación geocodificada).
function LocationCard({
  initialQuery,
  chosen,
  onChoose,
  onMarkMap,
  onChangeRequest,
  onClose,
}: {
  initialQuery: string;
  chosen: AddressResult | null;
  onChoose: (r: AddressResult) => void;
  onMarkMap: () => void;
  // Pide al padre limpiar la ubicación elegida y volver al formulario de búsqueda.
  onChangeRequest: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    const r = await searchAddress(q);
    setResults(r);
    setLoading(false);
  }

  // Búsqueda automática si llega un lugar desde el JSON del modelo.
  useEffect(() => {
    if (initialQuery) void runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (chosen) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
        <p className="flex items-start gap-1.5 text-sm text-emerald-800">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{chosen.label}</span>
        </p>
        <button
          type="button"
          onClick={onChangeRequest}
          className="mt-1 text-xs text-emerald-700 underline"
        >
          cambiar ubicación
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">¿Dónde?</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar tarjeta de ubicación"
          className="rounded p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runSearch(query);
            }
          }}
          placeholder="Barrio, parque o dirección (ej. Laureles, Medellín)"
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => void runSearch(query)}
          disabled={loading}
          className="shrink-0 rounded-md bg-gray-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "…" : "Buscar"}
        </button>
      </div>
      <button
        type="button"
        onClick={onMarkMap}
        className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
      >
        <MapPin className="mr-1 inline h-4 w-4" aria-hidden="true" /> Prefiero marcarlo en el mapa
      </button>
      {searched && !loading && results.length === 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Sin resultados. Prueba otra palabra o márcalo en el mapa.
        </p>
      )}
      {results.length > 0 && (
        <ul className="mt-2 max-h-40 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200 bg-white">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onChoose(r)}
                className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Tarjeta editable con lo que el asistente recopiló. Se confirma (o corrige)
// antes de pasar los datos al wizard.
function DraftCard({
  draft,
  locationLabel,
  photosCount,
  onChange,
  onApply,
  onDismiss,
}: {
  draft: AiPointDraft;
  // Ubicación elegida en el chat (solo informativa aquí; se aplica al confirmar).
  locationLabel: string | null;
  photosCount: number;
  onChange: (d: AiPointDraft) => void;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const valid = draft.title.trim().length >= 3 && draft.description.trim().length >= 10;

  function setContact(i: number, patch: Partial<ContactInfo>) {
    onChange({
      ...draft,
      contacts: draft.contacts.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    });
  }
  function removeContact(i: number) {
    onChange({ ...draft, contacts: draft.contacts.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">Listo para publicar</p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-gray-500 underline hover:text-gray-700"
        >
          seguir chateando
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <select
          value={draft.type}
          onChange={(e) => onChange({ ...draft, type: e.target.value as PointType })}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs"
          title="Tipo de punto"
        >
          <option value="need_help">Necesitamos ayuda</option>
          <option value="offer_help">Punto de ayuda</option>
        </select>
        <select
          value={draft.helpType}
          onChange={(e) => onChange({ ...draft, helpType: e.target.value as HelpTypeOption })}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs"
          title="Tipo de ayuda"
        >
          {HELP_TYPES.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>

      <input
        value={draft.title}
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
        maxLength={150}
        placeholder="Título (mín. 3 caracteres)"
        className="mt-2 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
      />
      <textarea
        value={draft.description}
        onChange={(e) => onChange({ ...draft, description: e.target.value })}
        maxLength={2000}
        rows={3}
        placeholder="Descripción (mín. 10 caracteres)"
        className="mt-2 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
      />

      {draft.supplies.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {draft.supplies.map((s, i) => (
            <span
              key={`${s.name}-${i}`}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600"
            >
              {s.name}
              {s.targetQuantity ? ` ×${s.targetQuantity}${s.unit ? ` ${s.unit}` : ""}` : ""}
            </span>
          ))}
        </div>
      )}

      {/* Ubicación y fotos recopiladas en el chat (se aplican al confirmar). */}
      {locationLabel && (
        <p className="mt-2 flex items-start gap-1 text-xs text-gray-600">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span className="min-w-0 break-words">{locationLabel}</span>
        </p>
      )}
      {photosCount > 0 && (
        <p className="mt-1 text-xs text-gray-500">
          📎 {photosCount} {photosCount === 1 ? "foto adjuntada" : "fotos adjuntadas"}
        </p>
      )}

      {draft.contacts.map((c, i) => (
        <div key={i} className="mt-2 flex items-center gap-1.5">
          <select
            value={c.type}
            onChange={(e) => setContact(i, { type: e.target.value as ContactInfo["type"] })}
            className="rounded-md border border-gray-300 bg-white px-1.5 py-1 text-xs"
            title="Tipo de contacto"
          >
            {CONTACT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTACT_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            value={c.value}
            onChange={(e) => setContact(i, { value: e.target.value })}
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
            placeholder="valor del contacto"
          />
          <button
            type="button"
            onClick={() => removeContact(i)}
            aria-label="Quitar contacto"
            className="rounded p-1 text-gray-400 hover:text-red-500"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({ ...draft, contacts: [...draft.contacts, { type: "phone", value: "" }] })
        }
        className="mt-2 text-xs font-medium text-brand-dark underline"
      >
        + añadir contacto
      </button>

      <button
        type="button"
        onClick={onApply}
        disabled={!valid}
        className="mt-3 w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        Publicar en el mapa
      </button>
      {!valid && (
        <p className="mt-1 text-center text-[11px] text-gray-400">
          Completa el título (3+) y la descripción (10+)
        </p>
      )}
      <p className="mt-1 text-center text-[11px] text-gray-400">
        {locationLabel
          ? "Todo listo: confirmarás la ubicación y el punto en el último paso."
          : "Primero marcamos el punto en el mapa, luego confirmas y se publica."}
      </p>
    </div>
  );
}

export function AiChat({ onApply, onExit, onClose, requestMapPick }: AiChatProps) {
  const chat = useLocalChat();
  // "chat" = conversación; "settings" = cambiar de modelo (con motor ya listo).
  const [view, setView] = useState<"chat" | "settings">("chat");
  const [input, setInput] = useState("");
  // Copia editable de lo extraído (la tarjeta puede corregirlo antes de aplicar).
  const [draft, setDraft] = useState<AiPointDraft | null>(null);
  // Extras recopilados en la UI (no pasan por el modelo): ubicación y fotos.
  const [location, setLocation] = useState<AddressResult | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  // Tarjeta de ubicación: abierta/cerrada (se autoabre cuando el modelo la pide
  // o cuando el JSON trae un locationQuery sin ubicación elegida aún).
  const [locOpen, setLocOpen] = useState(false);
  const [locQuery, setLocQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // El borrador extraído pasa a la copia editable de la tarjeta.
  useEffect(() => {
    if (chat.extracted) setDraft(chat.extracted);
  }, [chat.extracted]);

  // El modelo pidió la ubicación (marcador [[UBICACION]]) → abre la tarjeta.
  useEffect(() => {
    if (chat.askLocation && !location) setLocOpen(true);
  }, [chat.askLocation, location]);

  // El JSON trae un lugar mencionado y aún no hay ubicación → abre la tarjeta
  // con la búsqueda automática ya hecha (ej. "Parque de Laureles, Medellín").
  useEffect(() => {
    const q = chat.extracted?.locationQuery;
    if (q && !location) {
      setLocQuery(q);
      setLocOpen(true);
    }
  }, [chat.extracted, location]);

  // Salvaguarda determinista: si el modelo pide aprobación sin que haya una
  // ubicación marcada (se saltó el paso del mapa), forzamos la tarjeta de
  // ubicación — no se publica un punto sin su lugar en el mapa.
  useEffect(() => {
    if (chat.confirming && !location) setLocOpen(true);
  }, [chat.confirming, location]);

  // Auto-scroll al último mensaje (estilo chat).
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.status]);

  const modelLabel = findModelOption(chat.modelId).label;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t) return;
    setInput("");
    void chat.send(t);
  }

  // Ubicación elegida (buscador o mapa): se guarda, se cierra la tarjeta y se
  // avisa al modelo para que continúe con lo que falte (él no ve la UI).
  function applyLocation(r: AddressResult) {
    setLocation(r);
    setLocOpen(false);
    void chat.send(`Ya definí la ubicación: ${r.label}. Sigue con lo que falte.`);
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    setPhotos((prev) =>
      [...prev, ...Array.from(files).filter((f) => f.type.startsWith("image/"))].slice(
        0,
        MAX_PHOTOS,
      ),
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Reenvía el último mensaje del usuario (cuando el modelo no contestó nada).
  function retryLast() {
    const lastUser = [...chat.messages].reverse().find((m) => m.role === "user");
    if (lastUser) void chat.send(lastUser.content);
  }

  // Sin WebGPU: explicación y vuelta al formulario manual (que sigue intacto).
  if (!chat.webgpuSupported) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <Cpu className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold text-gray-900">IA local no disponible</h2>
        <p className="max-w-xs text-sm text-gray-600">
          Tu navegador no soporta WebGPU, necesario para ejecutar el modelo en tu
          dispositivo. Prueba con Chrome o Edge actualizados, o usa el formulario:
          funciona igual de bien.
        </p>
        <button
          type="button"
          onClick={onExit}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          Usar el formulario
        </button>
      </div>
    );
  }

  // Selector de modelo: antes de la primera carga, o desde "cambiar modelo".
  if (view === "settings" || chat.status === "idle") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatHeader
          showBack={chat.status === "ready"}
          subtitle="IA local"
          onBack={() => setView("chat")}
          onClose={onClose}
        />
        <ModelPicker
          models={chat.models}
          selected={chat.modelId}
          busy={chat.status === "loading-model"}
          onStart={() => {
            void chat.start();
            setView("chat");
          }}
          onChoose={chat.choose}
          onSecondary={chat.status === "ready" ? () => setView("chat") : onExit}
          secondaryLabel={chat.status === "ready" ? "Volver al chat" : "Prefiero el formulario"}
        />
      </div>
    );
  }

  // Descarga en curso o fallo de carga del modelo.
  if (chat.status === "loading-model" || chat.status === "error") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatHeader
          showBack
          subtitle={`IA local · ${modelLabel}`}
          onBack={onExit}
          onClose={onClose}
        />
        <LoadingModel
          label={modelLabel}
          progress={chat.progress}
          error={chat.error}
          onRetry={() => void chat.start()}
          onExit={onExit}
        />
      </div>
    );
  }

  // Chat.
  const generating = chat.status === "generating";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader
        showBack
        subtitle={`IA local · ${modelLabel}`}
        onBack={onExit}
        onClose={onClose}
      />

      {/* Progreso: qué ya se tiene y qué falta (según [[FALTA]] del modelo). */}
      {chat.messages.length > 0 && (
        <div className="shrink-0 border-b border-gray-100">
          <MissingChips
            missing={chat.missing}
            hasLocation={location !== null}
            onOpenLocation={() => setLocOpen(true)}
          />
        </div>
      )}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <ul className="flex flex-col gap-2">
          {chat.messages.map((m, i) => {
            const isUser = m.role === "user";
            // Oculta el marcado de control ([[PUNTO]], [[FALTA]]…) al usuario.
            const text = isUser ? m.content : stripMarkers(m.content);
            // Mientras genera y aún no hay texto útil: se omite (indicador aparte).
            if (!isUser && m.streaming && isLowQuality(m.content)) return null;
            // Terminó sin texto útil (vacío o basura como `"` o `{`): burbuja de
            // respaldo con reintento — nunca ocultamos la respuesta.
            const useless = !isUser && !m.streaming && isLowQuality(m.content);
            return (
              <li key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    isUser
                      ? "rounded-br-md bg-brand text-white"
                      : "rounded-bl-md border border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  {!useless ? (
                    <p className="whitespace-pre-wrap break-words">
                      {text}
                      {m.streaming && <span className="animate-blink">▍</span>}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="italic text-gray-400">
                        (el asistente no respondió nada útil)
                      </p>
                      <button
                        type="button"
                        onClick={retryLast}
                        className="rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Reintentar
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
          {generating && (
            <li className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400">
                <span className="animate-blink">● ● ●</span>
              </div>
            </li>
          )}
        </ul>
      </div>

      {/* Respuestas rápidas cuando el modelo pide aprobación del resumen. */}
      {chat.confirming && !generating && !chat.extracting && (
        <div className="flex shrink-0 gap-2 px-4 pt-2">
          <button
            type="button"
            onClick={() => void chat.send("Sí, apruebo. Publícalo así.")}
            className="flex-1 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white"
          >
            ✓ Sí, publícalo
          </button>
          <button
            type="button"
            onClick={() => setInput("Quiero corregir algo: ")}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            ✏️ Corregir algo
          </button>
        </div>
      )}

      {/* Tarjeta editable con lo recopilado (cuando el modelo la emitió). */}
      {draft && (
        <div className="max-h-[55%] shrink-0 overflow-y-auto border-t border-gray-100 px-4 py-3">
          <DraftCard
            draft={draft}
            locationLabel={location?.label ?? null}
            photosCount={photos.length}
            onChange={setDraft}
            onApply={() => onApply(draft, { location, photos })}
            onDismiss={() => {
              chat.dismissExtracted();
              setDraft(null);
            }}
          />
        </div>
      )}

      {/* Tarjeta de ubicación: abierta (buscando) o compacta (ya elegida). */}
      {(locOpen || location) && (
        <div className="shrink-0 px-4 pb-2">
          <LocationCard
            initialQuery={locQuery}
            chosen={location}
            onChoose={applyLocation}
            onMarkMap={() => requestMapPick(applyLocation)}
            onChangeRequest={() => {
              setLocation(null);
              setLocOpen(true);
            }}
            onClose={() => setLocOpen(false)}
          />
        </div>
      )}

      {chat.error && <p className="shrink-0 px-4 pt-2 text-xs text-red-600">{chat.error}</p>}

      {/* Segunda etapa: extrayendo el punto tras aprobar el resumen. */}
      {chat.extracting && (
        <p className="shrink-0 px-4 pt-2 text-xs font-medium text-gray-500">
          Preparando tu punto…
        </p>
      )}

      {/* Fotos adjuntadas (no pasan por el modelo; viajan directo al punto). */}
      <div className="shrink-0 px-4">
        <PhotoStrip photos={photos} onChange={setPhotos} max={MAX_PHOTOS} />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 items-end gap-2 border-t border-gray-100 px-4 py-3"
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={photos.length >= MAX_PHOTOS || chat.extracting}
          aria-label="Adjuntar fotos"
          title={`Adjuntar fotos (${photos.length}/${MAX_PHOTOS})`}
          className="shrink-0 rounded-md border border-gray-300 px-2.5 py-2 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
        >
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter envía; Shift+Enter salta línea.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          maxLength={500}
          placeholder="Escribe tu respuesta…"
          className="max-h-24 min-h-[38px] flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {generating ? (
          <button
            type="button"
            onClick={chat.stop}
            aria-label="Detener generación"
            title="Detener"
            className="rounded-md border border-gray-300 px-3 py-2 text-gray-600 hover:bg-gray-50"
          >
            <Square className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || chat.extracting}
            aria-label="Enviar"
            className="rounded-md bg-brand px-3 py-2 text-white disabled:opacity-60"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </form>
      <p className="flex shrink-0 items-center gap-1 px-4 pb-2 text-[10px] text-gray-400">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        Se procesa 100% en tu dispositivo; tus mensajes no salen de él.
      </p>
    </div>
  );
}
