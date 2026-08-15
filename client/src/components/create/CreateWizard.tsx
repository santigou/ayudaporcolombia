import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { MapView } from "../MapView";
import { reverseGeocode, type AddressResult } from "../AddressSearch";
import { api, ApiError, uploadFile } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useLoginModal } from "../../context/LoginModalContext";
import {
  HELP_TYPES,
  MAX_PHOTOS,
  type ContactInfo,
  type ContactType,
  type HelpTypeOption,
  type LocationDraft,
  type PointType,
  type SupplyDraft,
} from "../../types";
import { BottomSheet } from "./BottomSheet";
import { AiChat } from "./AiChat";
import type { AiPointDraft } from "../../llm/prompt";
import { ContactChips } from "./ContactChips";
import { LocationAccordion } from "./LocationAccordion";
import { PhotoInput } from "./PhotoInput";
import { ReviewStep } from "./ReviewStep";
import { SupplyPicker } from "./SupplyPicker";
import { clearDraft, dataUrlToFile, loadDraft } from "./draft";

const STEPS = [
  { title: "¿Qué vas a publicar?" },
  { title: "Cuéntanos más" },
  { title: "Ubicación" },
  { title: "Contacto y fotos" },
  { title: "Revisa y publica" },
] as const;
const LOCATION_STEP = 2;

function emptyLocation(): LocationDraft {
  return { type: "location", lat: null, lng: null, addressText: "", city: "", neighborhood: "" };
}

// Asistente (wizard) de creación: mapa a pantalla completa de fondo + drawer
// inferior (móvil) / panel lateral derecho (desktop) con pasos.
export function CreateWizard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const loginModal = useLoginModal();
  // ?chat=1 (ej. desde el menú hamburguesa) arranca directo en modo chat IA.
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<"manual" | "chat">(() =>
    searchParams.get("chat") === "1" ? "chat" : "manual",
  );

  const restored = useMemo(() => loadDraft(), []);

  const [step, setStep] = useState<number>(() => restored?.step ?? 0);
  const [type, setType] = useState<PointType>(() => restored?.type ?? "offer_help");
  const [title, setTitle] = useState(() => restored?.title ?? "");
  const [description, setDescription] = useState(() => restored?.description ?? "");
  const [helpType, setHelpType] = useState<HelpTypeOption>(() => restored?.helpType ?? "Refugio");
  const [supplies, setSupplies] = useState<SupplyDraft[]>(() => restored?.supplies ?? []);
  const [contacts, setContacts] = useState<ContactInfo[]>(() => restored?.contacts ?? []);
  const [locations, setLocations] = useState<LocationDraft[]>(() =>
    restored?.locations && restored.locations.length > 0 ? restored.locations : [emptyLocation()],
  );
  const [activeIndex, setActiveIndex] = useState<number>(() => restored?.activeIndex ?? 0);
  // Si volvemos al paso de ubicación, dejamos abierta la caja activa; si no, ninguna.
  const [openIndex, setOpenIndex] = useState<number | null>(() =>
    restored ? (restored.step === LOCATION_STEP ? restored.activeIndex : null) : 0,
  );
  const [geoLoading, setGeoLoading] = useState(false);
  const reverseIdRef = useRef(0);
  const [photos, setPhotos] = useState<File[]>(
    () => restored?.photos?.map((p) => dataUrlToFile(p.dataUrl, p.name)) ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ type: PointType; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const needsLogin = type === "offer_help" && !user;

  function updateLocation(i: number, patch: Partial<LocationDraft>) {
    setLocations((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLocation() {
    setLocations((prev) => [...prev, emptyLocation()]);
    const ni = locations.length;
    setActiveIndex(ni);
    setOpenIndex(ni);
  }
  function removeLocation(i: number) {
    setLocations((prev) => prev.filter((_, idx) => idx !== i));
    setActiveIndex((prev) => Math.max(0, prev >= i ? prev - 1 : prev));
    setOpenIndex((prev) => (prev === i ? null : prev !== null && prev > i ? prev - 1 : prev));
  }
  function openLocation(i: number) {
    setActiveIndex(i);
    setOpenIndex(i);
  }
  function closeLocation() {
    setOpenIndex(null);
  }
  // Click en el mapa: si el CHAT pidió la ubicación, geocodifica y devuelve el
  // control al chat; si no, marca la ubicación activa del wizard (flujo normal).
  async function handlePick(lat: number, lng: number) {
    const chatCb = chatPickRef.current;
    if (chatCb) {
      chatPickRef.current = null;
      setChatPicking(false);
      setGeoLoading(true);
      const r = await reverseGeocode(lat, lng);
      setGeoLoading(false);
      chatCb(
        r ?? {
          lat,
          lng,
          label: `Punto marcado en el mapa (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        },
      );
      return;
    }
    const i = activeIndex;
    updateLocation(i, { lat, lng });
    setGeoLoading(true);
    const myId = ++reverseIdRef.current;
    const r = await reverseGeocode(lat, lng);
    if (reverseIdRef.current !== myId) return;
    setGeoLoading(false);
    if (r)
      updateLocation(i, {
        addressText: r.label,
        city: r.city ?? "",
        neighborhood: r.neighborhood ?? "",
      });
    setOpenIndex(i);
  }
  function handleSearchSelect(i: number, result: AddressResult) {
    updateLocation(i, {
      lat: result.lat,
      lng: result.lng,
      addressText: result.label,
      city: result.city ?? "",
      neighborhood: result.neighborhood ?? "",
    });
    setActiveIndex(i);
    // El MapView auto-encuadra todas las ubicaciones marcadas (ver MapView),
    // así que no hace falta volar a un punto concreto.
  }
  function addContact(t: ContactType, v: string) {
    setContacts((prev) => [...prev, { type: t, value: v }]);
  }
  function removeContact(i: number) {
    setContacts((prev) => prev.filter((_, idx) => idx !== i));
  }

  // --- Modo chat con IA local (WebLLM) ---
  // Entra al chat; si venimos de ?chat=1 limpiamos el parámetro para que un
  // refresh posterior no reabra el chat si el usuario ya volvió al formulario.
  function enterChat() {
    if (searchParams.get("chat") === "1") setSearchParams({}, { replace: true });
    setMode("chat");
  }
  function exitChat() {
    setMode("manual");
  }

  // El chat pide que el usuario marque la ubicación tocando el mapa: guardamos
  // el callback, colapsamos la hoja (peek) y el próximo tap del mapa lo llama
  // con la ubicación geocodificada (el control vuelve al chat).
  const chatPickRef = useRef<((r: AddressResult) => void) | null>(null);
  const [chatPicking, setChatPicking] = useState(false);
  function requestMapPick(onPicked: (r: AddressResult) => void) {
    chatPickRef.current = onPicked;
    setChatPicking(true);
  }

  // Aplica lo recopilado por el chat: rellena los pasos y salta al mapa (si no
  // hay ubicación) o directo a la revisión final (si ya se marcó en el chat).
  function applyAiDraft(
    d: AiPointDraft,
    extras: { location: AddressResult | null; photos: File[] },
  ) {
    setType(d.type);
    setTitle(d.title);
    setDescription(d.description);
    setHelpType(d.helpType);
    setSupplies(d.supplies);
    setContacts(d.contacts);
    setPhotos(extras.photos.slice(0, MAX_PHOTOS));
    if (extras.location) {
      updateLocation(0, {
        lat: extras.location.lat,
        lng: extras.location.lng,
        addressText: extras.location.label,
        city: extras.location.city ?? "",
        neighborhood: extras.location.neighborhood ?? "",
      });
    }
    setStepError(null);
    setMode("manual");
    // Con ubicación ya marcada todo está completo → revisión final; si no,
    // al paso del mapa para que la marque (único dato que el chat no da).
    setStep(extras.location ? STEPS.length - 1 : LOCATION_STEP);
    setActiveIndex(0);
    // Sin caja abierta la hoja colapsa (peek) y el mapa queda tocable.
    setOpenIndex(null);
  }

  // Validación por paso (bloquea Continuar si no cumple).
  function validate(s: number): string | null {
    switch (s) {
      case 0:
        return title.trim().length < 3 ? "Escribe un título (mínimo 3 caracteres)" : null;
      case 1:
        return description.trim().length < 10
          ? "La descripción es muy corta (mínimo 10 caracteres)"
          : null;
      case 2:
        return locations.some((l) => l.lat != null && l.lng != null)
          ? null
          : "Marca al menos una ubicación en el mapa";
      case 3:
        return contacts.some((c) => c.value.trim()) ? null : "Añade al menos un contacto";
      default:
        return null;
    }
  }
  function next() {
    const e = validate(step);
    if (e) {
      setStepError(e);
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setStepError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setError(null);
    if (validate(2)) {
      setStep(LOCATION_STEP);
      return;
    }
    if (validate(3)) {
      setStep(3);
      return;
    }
    if (needsLogin) {
      setError("Para publicar un punto de ayuda necesitas iniciar sesión.");
      return;
    }
    const validLocations = locations.filter((l) => l.lat != null && l.lng != null) as Array<{
      type: LocationDraft["type"];
      lat: number;
      lng: number;
      addressText: string;
      city: string;
      neighborhood: string;
    }>;
    const validContacts = contacts
      .map((c) => ({ type: c.type, value: c.value.trim() }))
      .filter((c) => c.value);

    // Suministros válidos: nombre no vacío y no duplicado (case-insensitive).
    const validSupplies = supplies
      .map((s) => ({ name: s.name.trim(), targetQuantity: s.targetQuantity ?? undefined, unit: s.unit ?? undefined }))
      .filter((s) => s.name.length >= 2);

    setSubmitting(true);
    try {
      // 1) Subir fotos directamente al almacenamiento (presign + PUT).
      //    Los bytes no pasan por el backend: van al CDN de SeaweedFS (prod)
      //    o a disco (dev).
      const photoUrls = await Promise.all(
        photos.slice(0, MAX_PHOTOS).map(async (f) => {
          const { uploadUrl, publicUrl, headers } = await api.presignUpload(f.name, f.type);
          await uploadFile(uploadUrl, f, headers);
          return publicUrl;
        }),
      );
      // 2) Crear el punto con JSON (sin multipart).
      const created = await api.post<{ code: string }>("/points", {
        type,
        title: title.trim(),
        description: description.trim(),
        locations: validLocations,
        helpTypeName: helpType, // obligatorio para ambos tipos
        contacts: validContacts,
        ...(validSupplies.length > 0 ? { supplies: validSupplies } : {}),
        photoUrls,
      });
      setCreated({ type, code: created.code });
      clearDraft(); // publicado con éxito: ya no hace falta el borrador
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No pudimos crear el punto.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return <div className="apc-dark h-full"><p className="p-6 text-sm text-gray-500">Cargando…</p></div>;
  }

  if (created) {
    const shareUrl = `${window.location.origin}/p/${created.code}`;
    const copyLink = async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* clipboard no disponible */
      }
    };
    return (
      <div className="apc-dark mx-auto max-w-md p-6">
        <h1 className="text-lg font-bold text-gray-900">¡Listo!</h1>
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p>
            {created.type === "offer_help"
              ? "Tu punto fue enviado a revisión. Un moderador lo verificará antes de publicarlo en el mapa."
              : "Tu reporte ya está visible en el mapa, marcado como no verificado."}
          </p>
        </div>

        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">Código de verificación</p>
          <p className="mt-1 text-xs text-gray-500">
            Compártelo para que otras personas puedan encontrar y verificar este punto.
          </p>
          <code className="mt-3 block rounded bg-white px-3 py-2.5 text-center font-mono text-xl font-bold tracking-[0.3em] text-gray-900 ring-1 ring-gray-200 select-all">
            {created.code}
          </code>
          <div className="mt-3 flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 truncate rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white"
            >
              {copied ? "✓ Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        <button
          onClick={() => navigate("/")}
          className="mt-4 rounded-md bg-brand px-4 py-2 font-medium text-white"
        >
          Volver al mapa
        </button>
      </div>
    );
  }

  // En el paso de ubicación, si ninguna caja está abierta la hoja colapsa (peek)
  // para que se vea y se pueda tocar el mapa. En el resto de pasos va expandida.
  const expanded = !(step === LOCATION_STEP && openIndex === null);
  const isLast = step === STEPS.length - 1;

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* Mapa a pantalla completa de fondo (nunca se reduce de tamaño) */}
      <div className="relative min-w-0 flex-1">
        <MapView
          pickerMode
          pickedLocations={locations}
          activeIndex={activeIndex}
          onPickLocation={handlePick}
          points={[]}
        />
        {mode === "manual" && step === LOCATION_STEP && openIndex === null && (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-xs text-gray-700 shadow md:hidden">
            Toca el mapa para marcar la ubicación
          </div>
        )}
        {/* El chat de IA pidió la ubicación: hoja colapsada y el próximo tap
            del mapa vuelve al chat con el punto geocodificado. */}
        {chatPicking && (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white shadow">
            {geoLoading ? "Identificando el lugar…" : "Toca el mapa donde lo viste por última vez"}
          </div>
        )}
      </div>

      <BottomSheet expanded={mode === "chat" ? !chatPicking : expanded}>
        {mode === "chat" ? (
          <AiChat
            onApply={applyAiDraft}
            onExit={exitChat}
            requestMapPick={requestMapPick}
            onClose={() => {
              clearDraft();
              navigate("/");
            }}
          />
        ) : (
        <>
        {/* Encabezado: título dinámico + progreso + cerrar */}
        <header className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-400">
              Paso {step + 1} de {STEPS.length}
            </p>
            <h2 className="text-base font-semibold text-gray-900">{STEPS[step].title}</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              clearDraft();
              navigate("/");
            }}
            aria-label="Cerrar"
            className="rounded-md px-2 text-2xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ×
          </button>
        </header>

        {/* Cuerpo según el paso */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("offer_help")}
                  className={`flex flex-col items-start gap-1 rounded-md border px-3 py-3 text-left ${
                    type === "offer_help"
                      ? "border-brand bg-brand/5 text-brand-dark"
                      : "border-gray-200 text-gray-700"
                  }`}
                >
                  <span className="text-sm font-semibold">Punto de ayuda</span>
                  <span className="text-xs text-gray-500">Ofrezco un recurso</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType("need_help")}
                  className={`flex flex-col items-start gap-1 rounded-md border px-3 py-3 text-left ${
                    type === "need_help"
                      ? "border-brand bg-brand/5 text-brand-dark"
                      : "border-gray-200 text-gray-700"
                  }`}
                >
                  <span className="text-sm font-semibold">Necesitamos ayuda</span>
                  <span className="text-xs text-gray-500">Busco a alguien o algo</span>
                </button>
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Título
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={150}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal"
                  placeholder="Ej. Refugio disponible en el centro"
                />
              </label>

              {/* Alternativa al formulario: contarlo por chat con una IA que se
                  ejecuta localmente en el dispositivo (privada, sin servidor). */}
              <button
                type="button"
                onClick={enterChat}
                className="flex items-center justify-center gap-2 rounded-md border border-dashed border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Prefiero contarlo por chat (IA local)
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Descripción
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-normal"
                  placeholder="Detalles: qué, cuándo, para quién, condiciones…"
                />
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">Tipo de ayuda</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {HELP_TYPES.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHelpType(h)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                        helpType === h
                          ? "bg-brand-dark text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">
                  ¿Qué aceptas u ofreces? <span className="font-normal text-gray-400">(opcional)</span>
                </span>
                <div className="mt-1">
                  <SupplyPicker supplies={supplies} onChange={setSupplies} />
                </div>
              </div>
            </div>
          )}

          {step === LOCATION_STEP && (
            <LocationAccordion
              locations={locations}
              activeIndex={activeIndex}
              openIndex={openIndex}
              geoLoading={geoLoading}
              onOpen={openLocation}
              onClose={closeLocation}
              onChange={updateLocation}
              onAdd={addLocation}
              onRemove={removeLocation}
              onSearchSelect={handleSearchSelect}
            />
          )}

          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">Contacto(s)</span>
                <div className="mt-1">
                  <ContactChips contacts={contacts} onAdd={addContact} onRemove={removeContact} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">Fotos (opcional)</span>
                <div className="mt-1">
                  <PhotoInput photos={photos} onChange={setPhotos} max={MAX_PHOTOS} />
                </div>
              </div>
            </div>
          )}

          {isLast && (
            <ReviewStep
              type={type}
              title={title}
              description={description}
              helpType={helpType}
              supplies={supplies}
              locations={locations}
              contacts={contacts}
              photosCount={photos.length}
              needsLogin={needsLogin}
              submitting={submitting}
              error={error}
              onLogin={() => loginModal.open("Inicia sesión para publicar tu punto de ayuda.")}
            />
          )}
        </div>

        {(stepError || error) && (
          <div className="px-4 py-1 text-xs text-red-600">{stepError ?? error}</div>
        )}

        {/* Pie: Atrás / Continuar / Publicar */}
        <footer className="flex items-center gap-2 border-t border-gray-100 px-4 py-3">
          {step > 0 && (
            <button
              type="button"
              onClick={back}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Atrás
            </button>
          )}
          <div className="flex-1" />
          {isLast ? (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || needsLogin}
              className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? "Enviando…" : "Publicar"}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white"
            >
              Continuar
            </button>
          )}
        </footer>
        </>
        )}
      </BottomSheet>
    </div>
  );
}
