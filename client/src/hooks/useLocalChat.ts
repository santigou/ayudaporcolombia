import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import {
  ensureEngine,
  getPrebuiltModelIds,
  isWebGPUSupported,
  stopGeneration,
  streamChat,
} from "../llm/engine";
import {
  availableModels,
  loadSavedModelId,
  saveModelId,
  type LocalModelOption,
} from "../llm/models";
import {
  AI_GREETING,
  asksConfirmation,
  asksDone,
  asksLocation,
  buildExtractionPrompt,
  buildSystemPrompt,
  isDraftComplete,
  isLowQuality,
  mergeDrafts,
  parseMissing,
  parsePointDraft,
  parseTurnState,
  stripMarkers,
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

// Estado + acciones del chat con IA local (WebLLM). Todo el trabajo pesado
// vive en llm/engine.ts; este hook solo orquesta React.
export function useLocalChat() {
  const [status, setStatus] = useState<LocalChatStatus>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string>(() => loadSavedModelId());
  const [models, setModels] = useState<LocalModelOption[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [extracted, setExtracted] = useState<AiPointDraft | null>(null);
  // Señales derivadas de los marcadores de control del modelo:
  const [askLocation, setAskLocation] = useState(false); // pide la ubicación
  const [confirming, setConfirming] = useState(false); // pide aprobación del resumen
  const [missing, setMissing] = useState<MissingField[]>([]); // campos pendientes
  // Segunda etapa en curso: extrayendo el JSON del punto tras el [[LISTO]].
  const [extracting, setExtracting] = useState(false);
  // Longitud del chat (en mensajes) de la última extracción exitosa: evita
  // re-extraer (y pisar ediciones de la tarjeta) si el modelo repite [[LISTO]]
  // sin que haya mensajes nuevos.
  const extractedAtRef = useRef(0);
  // Borrador acumulado en vivo a partir de los JSON {"p"} de cada turno: la
  // tarjeta editable puede mostrarse antes de terminar la entrevista.
  const [draft, setDraft] = useState<AiPointDraft | null>(null);
  const draftRef = useRef<AiPointDraft | null>(null);
  // Acción del último turno (JSON "a"): guía la UI (abrir el mapa, botón de
  // publicar, auto-publicar).
  const [turnAction, setTurnAction] = useState<TurnAction>("chat");

  const webgpuSupported = useMemo(() => isWebGPUSupported(), []);
  // Guarda de re-entrada: evita dobles envíos en el mismo tick.
  const generatingRef = useRef(false);

  // Catálogo de modelos disponibles en la versión instalada (para el selector).
  useEffect(() => {
    let cancelled = false;
    getPrebuiltModelIds()
      .then((ids) => {
        if (!cancelled) setModels(availableModels(ids));
      })
      .catch(() => undefined); // sin catálogo: la UI usa findModelOption como fallback
    return () => {
      cancelled = true;
    };
  }, []);

  // Carga el motor (descarga la primera vez). `id` opcional para cambiar de
  // modelo: lo persiste y sustituye el motor activo.
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
        setMessages((prev) =>
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

  // Selecciona un modelo en el selector sin cargarlo aún.
  const choose = useCallback((id: string) => {
    setModelId(id);
    saveModelId(id);
  }, []);

  // Envía un mensaje del usuario y transmite la respuesta del modelo.
  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status !== "ready" || generatingRef.current) return;
      generatingRef.current = true;
      setError(null);
      const userMsg: ChatMessage = { role: "user", content: trimmed };
      setMessages((prev) => [
        ...prev,
        userMsg,
        { role: "assistant", content: "", streaming: true },
      ]);
      setStatus("generating");
      try {
        // Historial completo (system + últimos mensajes) para esta generación.
        const buildHistory = (): ChatCompletionMessageParam[] => [
          { role: "system", content: buildSystemPrompt() },
          ...[...messages, userMsg]
            .slice(-MAX_HISTORY)
            .map((m) => ({ role: m.role, content: m.content })),
        ];
        const streamIntoBubble = (onDelta2: (d: string) => void) =>
          streamChat({ messages: buildHistory(), onDelta: onDelta2 });
        let full = await streamIntoBubble((delta) => {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy.length - 1;
            if (last >= 0) copy[last] = { ...copy[last], content: copy[last].content + delta };
            return copy;
          });
        });
        // Los modelos de 1B a veces responden solo con marcadores, basura
        // (una comilla o llave suelta) o nada. Reintentamos una vez con un
        // recordatorio; la burbuja se limpia y la 2ª generación la ocupa.
        if (isLowQuality(full)) {
          console.debug("[ai-chat] respuesta sin texto visible, reintentando. Crudo:", full);
          setMessages((prev) => {
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
                  "Recordatorio: responde con una frase visible para la persona (reconoce + pregunta) y solo DESPUÉS añade los marcadores.",
              },
            ],
            onDelta: (delta) => {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy.length - 1;
                if (last >= 0) copy[last] = { ...copy[last], content: copy[last].content + delta };
                return copy;
              });
            },
          });
        }
        // Fin de la generación: marca la burbuja como completa y extrae el
        // punto si el modelo emitió el bloque final.
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy.length - 1;
          if (last >= 0) copy[last] = { ...copy[last], streaming: false };
          return copy;
        });
        setStatus("ready");
        // Estado del turno: JSON {"a","f","p"} (primario) con fallback a los
        // marcadores legacy [[…]] si el modelo no emitió un JSON válido.
        const ts = parseTurnState(full);
        const action: TurnAction = ts
          ? ts.action
          : asksLocation(full)
            ? "ubicacion"
            : asksConfirmation(full)
              ? "confirmar"
              : asksDone(full)
                ? "listo"
                : "chat";
        // Acumula el borrador en vivo con lo que reportó este turno (clave "p").
        if (ts?.draft) {
          draftRef.current = draftRef.current
            ? mergeDrafts(draftRef.current, ts.draft)
            : ts.draft;
          setDraft(draftRef.current);
        }
        setTurnAction(action);
        setAskLocation(action === "ubicacion");
        setConfirming(action === "confirmar");
        const miss = ts?.missing ?? parseMissing(full);
        if (miss) setMissing(miss);
        // Resumen listo: exponemos el borrador acumulado para la tarjeta
        // editable y su botón "Publicar ahora" (la persona aprueba publicando).
        if (action === "confirmar" && draftRef.current) {
          setExtracted(draftRef.current);
        }
        // Cierre aprobado ("listo"): publicamos con lo acumulado si ya está
        // completo; si no, la 2ª llamada de extracción actúa de respaldo (ver
        // buildExtractionPrompt).
        const totalMsgs = messages.length + 2; // + mensaje del usuario + respuesta
        if (action === "listo" && extractedAtRef.current !== totalMsgs) {
          setConfirming(false);
          if (isDraftComplete(draftRef.current)) {
            setExtracted(draftRef.current);
            extractedAtRef.current = totalMsgs;
          } else {
          // Transcripción limpia (sin marcadores ni JSON) para el extractor.
          const transcript = [...messages, userMsg, { role: "assistant" as const, content: full }]
            .map((m) => {
              const body = m.role === "user" ? m.content : stripMarkers(m.content);
              return `${m.role === "user" ? "Persona" : "Asistente"}: ${body}`;
            })
            .filter((line) => !line.endsWith(":"))
            .join("\n");
          setExtracting(true);
          try {
            let draft = parsePointDraft(
              await streamChat({
                messages: [{ role: "system", content: buildExtractionPrompt(transcript) }],
                temperature: 0.1,
                maxTokens: 500,
                onDelta: () => undefined,
              }),
            );
            // Un reintento con instrucción explícita si el JSON no fue válido.
            if (!draft) {
              draft = parsePointDraft(
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
            if (draft) {
              setExtracted(draft);
              extractedAtRef.current = totalMsgs;
            } else {
              setError(
                "No pude estructurar los datos. Escribe «publícalo» de nuevo, o continúa y edítalo manualmente.",
              );
            }
          } finally {
            setExtracting(false);
          }
          }
        }
      } catch (err) {
        // Descarta la burbuja del asistente si no llegó nada y desbloquea.
        setMessages((prev) => {
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
    },
    [messages, status],
  );

  // Detiene la generación en curso (conserva lo ya generado).
  const stop = useCallback(() => {
    stopGeneration();
  }, []);

  // Reinicia la conversación (el motor sigue cargado).
  const resetConversation = useCallback(() => {
    setMessages([{ role: "assistant", content: AI_GREETING }]);
    setExtracted(null);
    setError(null);
    setAskLocation(false);
    setConfirming(false);
    setMissing([]);
    setExtracting(false);
    draftRef.current = null;
    setDraft(null);
    setTurnAction("chat");
  }, []);

  const dismissExtracted = useCallback(() => setExtracted(null), []);

  return {
    status,
    progress,
    error,
    modelId,
    models,
    messages,
    // Borrador acumulado en vivo (JSON "p" de cada turno) y extracción final.
    draft,
    extracted,
    askLocation,
    confirming,
    turnAction,
    missing,
    extracting,
    webgpuSupported,
    start,
    choose,
    send,
    stop,
    resetConversation,
    dismissExtracted,
  };
}
