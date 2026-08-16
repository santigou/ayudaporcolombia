import { useCallback, useMemo, useRef, useState } from "react";
import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import {
  ensureEngine,
  isWebGPUSupported,
  stopGeneration,
  streamChat,
} from "../llm/engine";
import { loadSavedModelId, saveModelId } from "../llm/models";
import {
  searchAddress,
  expandMention,
  mergeResults,
  pairQueries,
  rankByQuery,
  similarQueries,
  type AddressResult,
} from "../components/AddressSearch";
import {
  AI_GREETING,
  buildAgentSystemPrompt,
  buildExtractionPrompt,
  buildLugarSystemPrompt,
  buildVerifierSystemPrompt,
  extractContactsFromText,
  isDraftComplete,
  mergeDrafts,
  inferHelpType,
  nextMissingField,
  nextQuestion,
  parseAgentObject,
  parsePointDraft,
  placeNotFoundQuestion,
  sanitizeDraftAgainstText,
  stripMarkers,
  summaryQuestion,
  type AiPointDraft,
  type MissingField,
} from "../llm/prompt";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  // true mientras se prepara esta respuesta (indicador de escritura).
  streaming?: boolean;
  // Notas de sistema / resultados de tools: van al CONTEXTO del LLM pero no se
  // pintan como burbujas ([sistema: …]).
  hidden?: boolean;
}

// Contexto de UI que la persona ve (la app lo usa para decidir el guion; el
// modelo no lo necesita porque las preguntas las escribe la app).
export interface ChatUiContext {
  hasLocation: boolean;
  // true cuando el texto lo generó la APP (ej. confirmación de ubicación con
  // la etiqueta larga del geocoder): se muestra y va al contexto del LLM, pero
  // NO cuenta como palabras de la persona para la anti-fabricación (evita que
  // nombres de regiones de OSM como «RAP del Agua» validen suministros).
  synthetic?: boolean;
}

export type LocalChatStatus =
  | "idle" // aún no se carga el modelo
  | "loading-model" // descargando/compilando
  | "ready" // listo para chatear
  | "generating" // generando respuesta
  | "error"; // fallo de carga o de generación

// Cuántos mensajes de historial (además del system prompt) se envían: evita
// desbordar la ventana de contexto de los modelos pequeños (4096 tokens).
const MAX_HISTORY = 16;

// Estado + acciones del chat-agente con IA local (WebLLM). El modelo SOLO
// entrevista y emite tool calls (datos / buscar_lugar / pedir / resumen /
// listo); este hook las ejecuta: acumula el borrador, geocodifica con
// Nominatim, decide cuándo mostrar el resumen y JAMÁS publica (publicar es
// exclusivo de la UI, botón o atajo).
export function useLocalChat() {
  const [status, setStatus] = useState<LocalChatStatus>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string>(() => loadSavedModelId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Borrador acumulado en vivo con los deltas de las calls "datos".
  const [draft, setDraft] = useState<AiPointDraft | null>(null);
  const draftRef = useRef<AiPointDraft | null>(null);
  // Resumen listo para publicar (call "resumen" con borrador completo, o
  // extracción de respaldo). La UI muestra la tarjeta + botón/atajo.
  const [extracted, setExtracted] = useState<AiPointDraft | null>(null);
  // Señales para la UI:
  const [askLocation, setAskLocation] = useState(false); // pedir la ubicación
  const [confirming, setConfirming] = useState(false); // resumen en pantalla
  const [missing, setMissing] = useState<MissingField[]>([]); // campo pendiente
  const [extracting, setExtracting] = useState(false); // 2ª llamada de respaldo
  // Candidatos del geocoder: la UI los muestra para que la persona elija
  // (nunca se marca solo).
  const [locationCandidates, setLocationCandidates] = useState<AddressResult[] | null>(null);

  // Espejo de messages SIN dependencia del render: las auto-continuaciones
  // necesitan el historial ya actualizado en el mismo tick.
  const messagesRef = useRef<ChatMessage[]>([]);
  // TODO lo que la persona ha escrito (visible): base de la anti-fabricación
  // (solo se aceptan datos rastreables a este texto) y de la extracción
  // determinista de contactos.
  const userTextRef = useRef("");
  // Espejo de status: los callbacks con dependencias vacías (send) congelan el
  // closure del primer render (status "idle") y rechazarían todo envío. Con el
  // ref el guard siempre ve el status real.
  const statusRef = useRef<LocalChatStatus>("idle");
  // Guarda de re-entrada (un solo intercambio a la vez).
  const generatingRef = useRef(false);
  // Anti-bucle: «¿qué tipo de ayuda?» se pregunta UNA vez; si la respuesta no
  // es del catálogo, queda «Otro» (válido) y se avanza al resumen.
  const ayudaAskedRef = useRef(false);

  const webgpuSupported = useMemo(() => isWebGPUSupported(), []);

  // Commit único: actualiza espejo + estado juntos.
  function commit(update: (prev: ChatMessage[]) => ChatMessage[]) {
    messagesRef.current = update(messagesRef.current);
    setMessages(messagesRef.current);
  }

  // setStatus que mantiene el espejo sincronizado.
  function applyStatus(s: LocalChatStatus) {
    statusRef.current = s;
    setStatus(s);
  }

  // Carga el motor (descarga la primera vez).
  const start = useCallback(
    async (id?: string) => {
      const target = id ?? modelId;
      if (id) {
        setModelId(id);
        saveModelId(id);
      }
      setError(null);
      applyStatus("loading-model");
      setProgress("");
      try {
        await ensureEngine(target, setProgress);
        applyStatus("ready");
        commit((prev) =>
          prev.length > 0 ? prev : [{ role: "assistant", content: AI_GREETING }],
        );
      } catch (err) {
        applyStatus("error");
        setError(
          err instanceof Error
            ? `No se pudo cargar el modelo: ${err.message}`
            : "No se pudo cargar el modelo. Revisa tu conexión e intenta de nuevo.",
        );
      }
    },
    [modelId],
  );

  // Nota oculta de sistema: entra al contexto del LLM, no se pinta.
  function appendHiddenNote(note: string) {
    commit((prev) => [...prev, { role: "user", content: note, hidden: true }]);
  }

  // Contexto de UI del envío en curso (la app decide el guion con él).
  const uiCtxRef = useRef<ChatUiContext>({ hasLocation: false });

  // Un intercambio: mensaje (visible u oculto) → el modelo estructura en JSON
  // (nunca escribe prosa visible) → la app decide la pregunta/resumen según su
  // guion determinista. El chat no puede salirse del guion.
  async function runTurn(text: string, hidden: boolean, synthetic = false) {
    const trimmed = text.trim();
    if (!trimmed || statusRef.current !== "ready" || generatingRef.current) return;
    generatingRef.current = true;
    setError(null);
    const userMsg: ChatMessage = { role: "user", content: trimmed, hidden: hidden || undefined };
    // Solo las palabras REALES de la persona alimentan la anti-fabricación.
    if (!hidden && !synthetic) userTextRef.current += ` ${trimmed}`;
    commit((prev) => [...prev, userMsg, { role: "assistant", content: "", streaming: true }]);
    applyStatus("generating");
    try {
      // Historial para el LLM: system (contrato JSON) + últimos mensajes.
      const historyBase = messagesRef.current.slice(0, -1);
      const buildHistory = (): ChatCompletionMessageParam[] => [
        { role: "system", content: buildAgentSystemPrompt() },
        ...historyBase.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content })),
      ];
      // El JSON del modelo NO se muestra: se recoge entero y se parsea.
      const generate = (msgs: ChatCompletionMessageParam[]) =>
        streamChat({ messages: msgs, temperature: 0.1, maxTokens: 260, onDelta: () => undefined });
      let obj = parseAgentObject((await generate(buildHistory())).text);
      if (!obj) {
        // Un reintento correctivo; si también falla, el guion de la app sigue
        // igual (pregunta por lo que falte): el chat nunca se traba.
        obj = parseAgentObject(
          (
            await generate([
              ...buildHistory(),
              {
                role: "user",
                content: "Responde SOLO con el objeto JSON de una sola línea.",
              },
            ])
          ).text,
        );
      }
      // Contactos deterministas del mensaje de la persona (regex: @handle,
      // email, teléfono/whatsapp): entran aunque el modelo falle o invente.
      const found = extractContactsFromText(trimmed);
      if (found.length > 0) {
        const base =
          draftRef.current ??
          ({
            type: "need_help",
            title: "",
            description: "",
            helpType: "Otro",
            supplies: [],
            contacts: [],
            locationQuery: "",
          } as AiPointDraft);
        const seen = new Set(base.contacts.map((c) => `${c.type}:${c.value.toLowerCase()}`));
        const add = found.filter((c) => !seen.has(`${c.type}:${c.value.toLowerCase()}`));
        if (add.length > 0) {
          draftRef.current = { ...base, contacts: [...base.contacts, ...add].slice(0, 3) };
          setDraft(draftRef.current);
        }
      }
      // Aplica un delta "datos" al acumulado: merge (conservando type/helpType
      // que el JSON omitió) + ANTI-FABRICACIÓN contra el texto real de la
      // persona (título/descripción no rastreables, contactos fabricados o
      // suministros no mencionados se descartan; se restaura el valor previo
      // de título/descripción si existía).
      const applyDatos = (datos: AiPointDraft, sinType?: boolean, sinHelpType?: boolean) => {
        const prev = draftRef.current;
        let merged = prev
          ? mergeDrafts(prev, datos, { keepPrevType: sinType, keepPrevHelpType: sinHelpType })
          : datos;
        merged = sanitizeDraftAgainstText(merged, userTextRef.current);
        if (!merged.title && prev?.title) merged.title = prev.title;
        if (!merged.description && prev?.description) merged.description = prev.description;
        // Un delta no puede VACIAR contactos ya recopilados (evita re-preguntar
        // contacto tras respuestas que no lo mencionan).
        if (merged.contacts.length === 0 && prev?.contacts.length) {
          merged.contacts = prev.contacts;
        }
        // Tipo de ayuda determinista por keywords cuando el guion lo necesite
        // y el modelo no lo haya fijado (respuestas fuera de catálogo).
        if (merged.helpType === "Otro") {
          const t = inferHelpType(userTextRef.current);
          if (t) merged.helpType = t;
        }
        draftRef.current = merged;
        setDraft(merged);
      };
      if (obj?.datos) applyDatos(obj.datos, obj.sinType, obj.sinHelpType);
      const hasLocation = uiCtxRef.current.hasLocation;
      let d = draftRef.current;
      // Pasada ENFOCADA de lugar: el guion necesita la ubicación y el objeto
      // principal no la trajo → antes de preguntar "¿dónde?", una mini-tarea
      // dedicada SOLO a detectar el lugar (fiable incluso en modelos chicos).
      // Evita repetir una pregunta que la persona ya respondió en su mensaje.
      if (
        !hasLocation &&
        !obj?.lugar &&
        nextMissingField(d, false) === "ubicacion" &&
        draftRef.current?.locationQuery
      ) {
        obj = { ...obj, lugar: draftRef.current.locationQuery };
      }
      if (!hasLocation && !obj?.lugar && nextMissingField(d, false) === "ubicacion") {
        const focused = parseAgentObject(
          (
            await generate([
              { role: "system", content: buildLugarSystemPrompt() },
              ...historyBase.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content })),
            ])
          ).text,
        );
        if (focused?.lugar) obj = { ...obj, lugar: focused.lugar };
      }
      // VERIFICADOR (segunda opinión): si tras el pase principal (+ lugar
      // enfocado) todavía falta algún campo —o el pase falló del todo—, otra
      // llamada con framing de VERIFICACIÓN contra el borrador recupera lo
      // omitido antes de preguntar algo que la persona ya respondió. Su salida
      // pasa la misma anti-fabricación (applyDatos). Solo corre cuando hace
      // falta: si nada falta, no se paga la latencia extra.
      if (!obj || nextMissingField(draftRef.current, hasLocation) !== null) {
        const verified = parseAgentObject(
          (
            await generate([
              { role: "system", content: buildVerifierSystemPrompt(draftRef.current) },
              ...historyBase.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content })),
            ])
          ).text,
        );
        if (verified?.datos) applyDatos(verified.datos, verified.sinType, verified.sinHelpType);
        if (verified?.lugar && !hasLocation && !obj?.lugar) {
          obj = { ...obj, lugar: verified.lugar };
        }
        d = draftRef.current;
      }
      let bubble: string;
      if (obj?.lugar && !hasLocation) {
        // La persona mencionó un lugar. FASE 1: la frase completa de su texto
        // (ej. «casd de castilla en medellin») + PARES clave (ej. «casd
        // medellin»: Nominatim hace fuzzy casd→CAD y la frase larga devuelve
        // 0) — todas se buscan y sus resultados se FUSIONAN y rankean juntos:
        // si el POI exacto existe, aparece en la tarjeta aunque otra consulta
        // también devuelva la comuna genérica. FASE 2 (solo si todo vacío):
        // mención del modelo → consultas similares hasta el primer resultado.
        const full = expandMention(userTextRef.current, obj.lugar);
        const pairs = pairQueries(full);
        const primary = [...new Set([full, ...pairs])];
        let collected: AddressResult[] = [];
        for (const q of primary) {
          collected = mergeResults(collected, await searchAddress(q));
        }
        let ranked = rankByQuery(collected, full).slice(0, 5);
        if (ranked.length === 0) {
          for (const q of [...new Set([obj.lugar, ...similarQueries(full)])]) {
            if (primary.includes(q)) continue;
            const r = await searchAddress(q);
            if (r.length > 0) {
              ranked = rankByQuery(r, full).slice(0, 5);
              break;
            }
          }
        }
        if (ranked.length > 0) {
          setLocationCandidates(ranked);
          setAskLocation(true);
          bubble =
            ranked.length === 1
              ? `Encontré el lugar para «${full}»: confírmalo para marcarlo en el mapa.`
              : `Encontré ${ranked.length} lugares para «${full}»: elige el correcto para marcarlo en el mapa.`;
        } else {
          bubble = placeNotFoundQuestion(full);
        }
      } else {
        // Guion: qué pasó → ubicación → contacto → tipo de ayuda → resumen.
        // «Tipo de ayuda» solo se pregunta una vez (anti-bucle con respuestas
        // fuera de catálogo como «solo necesito que me ayuden»).
        let field = nextMissingField(d, hasLocation);
        if (field === "ayuda" && ayudaAskedRef.current) field = null;
        if (field && !(obj?.resumen && field === "ayuda")) {
          setMissing([field]);
          setAskLocation(field === "ubicacion");
          setConfirming(false);
          if (field === "ayuda") ayudaAskedRef.current = true;
          bubble = nextQuestion(field, d);
        } else {
          setMissing([]);
          setConfirming(true);
          if (isDraftComplete(d)) setExtracted(d);
          bubble = summaryQuestion();
        }
      }
      // La burbuja del asistente es SIEMPRE texto de la app (determinista).
      commit((prev) => {
        const copy = [...prev];
        const last = copy.length - 1;
        if (last >= 0) copy[last] = { role: "assistant", content: bubble };
        return copy;
      });
      if (obj?.lugar) {
        appendHiddenNote(
          `[sistema: se geocodificó "${obj.lugar}" y la persona elegirá el lugar en la app.]`,
        );
      }
      applyStatus("ready");
    } catch (err) {
      // Descarta la burbuja en preparación si falló todo y desbloquea.
      commit((prev) => {
        const cleaned = prev.filter((m) => !(m.streaming && !m.content));
        return cleaned.map((m) => ({ ...m, streaming: false }));
      });
      applyStatus("ready");
      setError(
        err instanceof Error ? err.message : "La generación falló. Intenta de nuevo.",
      );
    } finally {
      generatingRef.current = false;
    }
  }

  // Respaldo: 2ª llamada dedicada de extracción desde la transcripción (para
  // cuando el acumulado de "datos" no alcance). La invoca la UI si hace falta.
  const extractFromTranscript = useCallback(async () => {
    const transcript = messagesRef.current
      .filter((m) => !m.hidden)
      .map((m) => {
        const body = m.role === "user" ? m.content : stripMarkers(m.content);
        return `${m.role === "user" ? "Persona" : "Asistente"}: ${body}`;
      })
      .filter((line) => !line.endsWith(":"))
      .join("\n");
    setExtracting(true);
    try {
      let out = parsePointDraft(
        (
          await streamChat({
            messages: [{ role: "system", content: buildExtractionPrompt(transcript) }],
            temperature: 0.1,
            maxTokens: 500,
            onDelta: () => undefined,
          })
        ).text,
      );
      if (!out) {
        out = parsePointDraft(
          (
            await streamChat({
              messages: [
                { role: "system", content: buildExtractionPrompt(transcript) },
                { role: "user", content: "Responde SOLO con el objeto JSON válido." },
              ],
              temperature: 0.1,
              maxTokens: 500,
              onDelta: () => undefined,
            })
          ).text,
        );
      }
      if (out) {
        draftRef.current = draftRef.current ? mergeDrafts(draftRef.current, out) : out;
        setDraft(draftRef.current);
        setExtracted(draftRef.current);
      } else {
        setError("No pude estructurar los datos. Cuéntalo de nuevo o usa el formulario.");
      }
    } finally {
      setExtracting(false);
    }
  }, []);

  // Envío visible de la persona. `ctx` lleva el estado de la UI (ubicación
  // elegida; `synthetic` si el texto lo escribió la app) para el guion.
  const send = useCallback(async (text: string, ctx?: ChatUiContext) => {
    if (ctx) {
      uiCtxRef.current = { hasLocation: ctx.hasLocation };
      await runTurn(text, false, ctx.synthetic === true);
    } else {
      await runTurn(text, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detiene la generación en curso (conserva lo ya generado).
  const stop = useCallback(() => {
    stopGeneration();
  }, []);

  // Reinicia la conversación (el motor sigue cargado).
  const resetConversation = useCallback(() => {
    commit(() => [{ role: "assistant", content: AI_GREETING }]);
    setExtracted(null);
    setError(null);
    setAskLocation(false);
    setConfirming(false);
    setMissing([]);
    setExtracting(false);
    draftRef.current = null;
    setDraft(null);
    setLocationCandidates(null);
    uiCtxRef.current = { hasLocation: false };
    userTextRef.current = "";
    ayudaAskedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissExtracted = useCallback(() => setExtracted(null), []);
  const clearLocationCandidates = useCallback(() => setLocationCandidates(null), []);

  return {
    status,
    progress,
    error,
    modelId,
    messages,
    // Borrador acumulado en vivo (calls "datos") y resumen final.
    draft,
    extracted,
    askLocation,
    confirming,
    missing,
    extracting,
    locationCandidates,
    webgpuSupported,
    start,
    send,
    stop,
    resetConversation,
    dismissExtracted,
    clearLocationCandidates,
    extractFromTranscript,
  };
}
