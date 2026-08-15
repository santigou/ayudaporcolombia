// Motor LLM local (WebLLM) como singleton de módulo.
//
// - Carga diferida: `import("@mlc-ai/web-llm")` se resuelve solo cuando se usa
//   el chat, así Vite lo separa en un chunk y el bundle inicial no crece.
// - El modelo se ejecuta íntegramente en el navegador con WebGPU; ningún
//   mensaje sale del dispositivo.
// - Solo un motor vivo a la vez: cambiar de modelo descarga el anterior.

import type { ChatCompletionMessageParam, MLCEngineInterface } from "@mlc-ai/web-llm";
import { findModelOption } from "./models";

// ¿El navegador soporta WebGPU? Es requisito para ejecutar el modelo local.
// (Chrome/Edge 113+, algunos Firefox; Safari aún no en todas las versiones.)
export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

// IDs de modelos precompilados que trae la versión instalada de WebLLM.
export async function getPrebuiltModelIds(): Promise<string[]> {
  const webllm = await import("@mlc-ai/web-llm");
  return webllm.prebuiltAppConfig.model_list.map((m) => m.model_id);
}

interface EngineState {
  engine: MLCEngineInterface | null;
  modelId: string | null;
  loading: boolean;
}

const state: EngineState = { engine: null, modelId: null, loading: false };

// Carga (o reutiliza) el motor para `modelId`. `onProgress` recibe el texto de
// progreso de WebLLM (descarga de pesos, compilación de shaders…).
export async function ensureEngine(
  modelId: string,
  onProgress: (text: string) => void,
): Promise<MLCEngineInterface> {
  if (state.engine && state.modelId === modelId) return state.engine;
  if (state.loading) throw new Error("Ya se está cargando un modelo");
  state.loading = true;
  try {
    // Cambio de modelo: libera la VRAM del anterior antes de cargar el nuevo.
    if (state.engine) {
      const old = state.engine;
      state.engine = null;
      state.modelId = null;
      try {
        await old.unload();
      } catch {
        /* si falla la descarga, seguimos igualmente */
      }
    }
    const webllm = await import("@mlc-ai/web-llm");
    // Parchea el ModelRecord del modelo elegido si el catálogo lo pide (ej.
    // gemma3-1b: su registro trae context_window_size=4096 y la config del
    // modelo sliding_window_size=512 → el runtime exige uno de los dos en -1).
    const patch = findModelOption(modelId).overrides;
    const base = webllm.prebuiltAppConfig;
    const appConfig = patch
      ? {
          ...base,
          model_list: base.model_list.map((m) =>
            m.model_id === modelId ? { ...m, overrides: { ...m.overrides, ...patch } } : m,
          ),
        }
      : base;
    const engine = await webllm.CreateMLCEngine(modelId, {
      appConfig,
      initProgressCallback: (report) => onProgress(report.text),
    });
    state.engine = engine;
    state.modelId = modelId;
    return engine;
  } finally {
    state.loading = false;
  }
}

export interface StreamChatOptions {
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  maxTokens?: number;
  onDelta: (delta: string) => void;
}

// Genera una respuesta en streaming (token a token) y devuelve el texto final.
export async function streamChat(opts: StreamChatOptions): Promise<string> {
  if (!state.engine) throw new Error("El modelo aún no está cargado");
  const stream = await state.engine.chat.completions.create({
    stream: true,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 400,
  });
  let full = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) {
      full += delta;
      opts.onDelta(delta);
    }
  }
  return full;
}

// Detiene la generación en curso (el stream en curso termina de forma limpia
// con lo que ya se generó). interruptGenerate() devuelve void en esta versión.
export function stopGeneration(): void {
  if (!state.engine) return;
  Promise.resolve(state.engine.interruptGenerate()).catch(() => undefined);
}
