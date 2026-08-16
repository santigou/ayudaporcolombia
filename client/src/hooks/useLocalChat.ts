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
  MISSING_LABELS,
  buildExtractionPrompt,
  buildSystemPrompt,
  interpretTurn,
  isDraftComplete,
  isLowQuality,
  mergeDrafts,
  parsePointDraft,
  stripMarkers,
  type AgentCall,
  type AiPointDraft,
  type MissingField,
  type TurnAction,
} from "../llm/prompt";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  // true mientras el modelo está generando esta respuesta (streaming).
  streaming?: boolean;
  // Notas de sistema / resultados de tools: van al CONTEXTO del LLM pero no se
  // pintan como burbujas ([sistema: …]).
  hidden?: boolean;
  // Tool calls interpretadas de esta respuesta del asistente (para render y
  // texto derivado si no hubo frase visible).
  calls?: AgentCall[];
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
  const [turnAction, setTurnAction] = useState<TurnAction>("chat"); // "listo" = aprobado
  const [missing, setMissing] = useState<MissingField[]>([]); // campo pendiente
  const [extracting, setExtracting] = useState(false); // 2ª llamada de respaldo
  // Candidatos del geocoder tras una call "buscar_lugar": la UI los muestra
  // para que la persona elija (nunca se marca solo).
  const [locationCandidates, setLocationCandidates] = useState<AddressResult[] | null>(null);

  // Espejo de messages SIN dependencia del render: las auto-continuaciones
  // necesitan el historial ya actualizado en el mismo tick.
  const messagesRef = useRef<ChatMessage[]>([]);
  // Guarda de re-entrada y de auto-continuación (máx. 1 por intercambio).
  const generatingRef = useRef(false);
  const autoContinuedRef = useRef(false);

  const webgpuSupported = useMemo(() => isWebGPUSupported(), []);

  // Commit único: actualiza espejo + estado juntos.
  function commit(update: (prev: ChatMessage[]) => ChatMessage[]) {
    messagesRef.current = update(messagesRef.current);
    setMessages(messagesRef.current);
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
      setStatus("loading-model");
      setProgress("");
      try {
        await ensureEngine(target, setProgress);
        setStatus("ready");
        commit((prev) =>
          prev.length > 0 ? prev : [{ role: "assistant", content: AI_GREETING }],
        );
      } catch (err) {
        setStatus("error");
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

  // Auto-continuación (máx. 1 por intercambio): el modelo reacciona al
  // resultado de una tool sin que la persona escriba de nuevo.
  async function autoContinue(note: string) {
    if (generatingRef.current || autoContinuedRef.current) return;
    autoContinuedRef.current = true;
    await runTurn(note, true);
  }

  // Ejecuta en orden las tool calls del turno. El modelo nunca publica:
  // "listo" solo marca aprobación; publicar es exclusivo de la UI.
  async function executeCalls(calls: AgentCall[]) {
    for (const call of calls) {
      switch (call.tool) {
        case "datos": {
          draftRef.current = draftRef.current
            ? mergeDrafts(draftRef.current, call.p)
            : call.p;
          setDraft(draftRef.current);
          break;
        }
        case "pedir": {
          setMissing([call.falta]);
          if (call.falta === "ubicacion") setAskLocation(true);
          break;
        }
        case "buscar_lugar": {
          const results = await searchAddress(call.q);
          if (results.length > 0) {
            setLocationCandidates(results);
            appendHiddenNote(
              `[sistema: buscar_lugar "${call.q}" devolvió ${results.length} resultado(s); la persona elegirá uno en la app y te avisará. Pregunta otra cosa mientras tanto.]`,
            );
          } else {
            await autoContinue(
              `[sistema: buscar_lugar no encontró "${call.q}". Pide un barrio, comuna o ciudad de Colombia y vuelve a intentarlo.]`,
            );
          }
          break;
        }
        case "resumen": {
          if (isDraftComplete(draftRef.current)) {
            setExtracted(draftRef.current);
            setConfirming(true);
          } else {
            const tiene = draftRef.current;
            const falta: string[] = [];
            if (!tiene || tiene.title.trim().length < 3 || tiene.description.trim().length < 10)
              falta.push(MISSING_LABELS.que_paso);
            if (!tiene || tiene.contacts.length === 0) falta.push(MISSING_LABELS.contacto);
            await autoContinue(
              `[sistema: todavía falta ${falta.join(" y ")}. Pídeselo a la persona antes del resumen.]`,
            );
          }
          break;
        }
        case "listo": {
          if (isDraftComplete(draftRef.current)) {
            setConfirming(false);
            setTurnAction("listo");
          } else {
            await autoContinue(
              "[sistema: falta información para publicar. Pide lo que falte y luego pide el resumen.]",
            );
          }
          break;
        }
      }
    }
  }
  // Un intercambio completo: mensaje (visible u oculto) → streaming →
  // interpretación del turno → ejecución de tools.
  async function runTurn(text: string, hidden: boolean) {
    const trimmed = text.trim();
    if (!trimmed || status !== "ready" || generatingRef.current) return;
    generatingRef.current = true;
    setError(null);
    const userMsg: ChatMessage = { role: "user", content: trimmed, hidden: hidden || undefined };
    commit((prev) => [...prev, userMsg, { role: "assistant", content: "", streaming: true }]);
    setStatus("generating");
    try {
      // Historial para el LLM: system + últimos mensajes (sin el placeholder).
      const historyBase = messagesRef.current.slice(0, -1);
      const buildHistory = (): ChatCompletionMessageParam[] => [
        { role: "system", content: buildSystemPrompt() },
        ...historyBase.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content })),
      ];
      const streamIntoBubble = (onDelta2: (d: string) => void) =>
        streamChat({
          messages: buildHistory(),
          temperature: 0.4,
          maxTokens: 700,
          onDelta: onDelta2,
        });
      let full = await streamIntoBubble((delta) => {
        commit((prev) => {
          const copy = [...prev];
          const last = copy.length - 1;
          if (last >= 0) copy[last] = { ...copy[last], content: copy[last].content + delta };
          return copy;
        });
      });
      // Respuesta sin texto útil NI tool calls (basura o nada): un reintento
      // con corrección explícita del formato.
      if (isLowQuality(full) && interpretTurn(full).length === 0) {
        console.debug("[ai-chat] respuesta sin texto ni tools, reintentando. Crudo:", full);
        commit((prev) => {
          const copy = [...prev];
          const last = copy.length - 1;
          if (last >= 0) copy[last] = { ...copy[last], content: "" };
          return copy;
        });
        full = await streamChat({
          messages: [
            ...buildHistory(),
            { role: "assistant", content: full || "(sin respuesta)" },
            {
              role: "user",
              content:
                'Corrección: tu respuesta anterior no tuvo texto visible. Responde de nuevo: PRIMERO una frase breve y cálida en español (reconoce + UNA pregunta) y DESPUÉS, en la última línea, la llamada a herramienta {"tool":…}.',
            },
          ],
          temperature: 0.4,
          maxTokens: 700,
          onDelta: (delta) => {
            commit((prev) => {
              const copy = [...prev];
              const last = copy.length - 1;
              if (last >= 0) copy[last] = { ...copy[last], content: copy[last].content + delta };
              return copy;
            });
          },
        });
      }
      // Fin de la generación: burbuja completa + tool calls interpretadas.
      const calls = interpretTurn(full);
      commit((prev) => {
        const copy = [...prev];
        const last = copy.length - 1;
        if (last >= 0) copy[last] = { ...copy[last], streaming: false, calls };
        return copy;
      });
      setStatus("ready");
      setTurnAction("chat");
      await executeCalls(calls);
    } catch (err) {
      // Descarta la burbuja del asistente si no llegó nada y desbloquea.
      commit((prev) => {
        const cleaned = prev.filter((m) => !(m.streaming && !m.content));
        return cleaned.map((m) => ({ ...m, streaming: false }));
      });
      setStatus("ready");
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
        await streamChat({
          messages: [{ role: "system", content: buildExtractionPrompt(transcript) }],
          temperature: 0.1,
          maxTokens: 500,
          onDelta: () => undefined,
        }),
      );
      if (!out) {
        out = parsePointDraft(
          await streamChat({
            messages: [
              { role: "system", content: buildExtractionPrompt(transcript) },
              { role: "user", content: "Responde SOLO con el objeto JSON válido." },
            ],
            temperature: 0.1,
            maxTokens: 500,
            onDelta: () => undefined,
          }),
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

  // Envío visible de la persona: habilita una nueva auto-continuación.
  const send = useCallback(async (text: string) => {
    autoContinuedRef.current = false;
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
    setTurnAction("chat");
    setLocationCandidates(null);
    autoContinuedRef.current = false;
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
    turnAction,
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
