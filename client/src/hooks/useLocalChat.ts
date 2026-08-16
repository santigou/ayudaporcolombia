import { useCallback, useMemo, useRef, useState } from "react";
import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import {
  ensureEngine,
  isWebGPUSupported,
  stopGeneration,
  streamChat,
} from "../llm/engine";
import { loadSavedModelId, saveModelId } from "../llm/models";
import { searchAddress, type AddressResult } from "../components/AddressSearch";
import {
  AI_GREETING,
  buildAgentSystemPrompt,
  buildExtractionPrompt,
  extractContactsFromText,
  isDraftComplete,
  mergeDrafts,
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
  async function runTurn(text: string, hidden: boolean) {
    const trimmed = text.trim();
    if (!trimmed || statusRef.current !== "ready" || generatingRef.current) return;
    generatingRef.current = true;
    setError(null);
    const userMsg: ChatMessage = { role: "user", content: trimmed, hidden: hidden || undefined };
    if (!hidden) userTextRef.current += ` ${trimmed}`;
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
      // Fusiona los datos nuevos del modelo (conservando type/helpType si el
      // JSON los omitió) y aplica la ANTI-FABRICACIÓN: título/descripción con
      // palabras no rastreables al texto de la persona, contactos fabricados o
      // suministros no mencionados se descartan (se restaura el valor previo
      // de título/descripción si existía).
      if (obj?.datos) {
        const prev = draftRef.current;
        let merged = prev
          ? mergeDrafts(prev, obj.datos, {
              keepPrevType: obj.sinType,
              keepPrevHelpType: obj.sinHelpType,
            })
          : obj.datos;
        merged = sanitizeDraftAgainstText(merged, userTextRef.current);
        if (!merged.title && prev?.title) merged.title = prev.title;
        if (!merged.description && prev?.description) merged.description = prev.description;
        draftRef.current = merged;
        setDraft(merged);
      }
      const hasLocation = uiCtxRef.current.hasLocation;
      const d = draftRef.current;
      let bubble: string;
      if (obj?.lugar && !hasLocation) {
        // La persona mencionó un lugar: geocodificar y proponer candidatos.
        const results = await searchAddress(obj.lugar);
        if (results.length > 0) {
          setLocationCandidates(results);
          setAskLocation(true);
          bubble =
            results.length === 1
              ? `Encontré el lugar para «${obj.lugar}»: confírmalo para marcarlo en el mapa.`
              : `Encontré ${results.length} lugares para «${obj.lugar}»: elige el correcto para marcarlo en el mapa.`;
        } else {
          bubble = placeNotFoundQuestion(obj.lugar);
        }
      } else {
        // Guion: qué pasó → ubicación → contacto → tipo de ayuda → resumen.
        const field = nextMissingField(d, hasLocation);
        if (field && !(obj?.resumen && field === "ayuda")) {
          setMissing([field]);
          setAskLocation(field === "ubicacion");
          setConfirming(false);
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
  // elegida) para que el guion determinista decida el siguiente paso.
  const send = useCallback(async (text: string, ctx?: ChatUiContext) => {
    if (ctx) uiCtxRef.current = ctx;
    await runTurn(text, false);
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
