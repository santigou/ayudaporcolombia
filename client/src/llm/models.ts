// Catálogo curado de modelos locales para el asistente por chat (WebLLM).
//
// Los IDs corresponden a modelos precompilados de WebLLM (mlc-ai) que se
// descargan UNA vez a la caché del navegador y se ejecutan 100% en el
// dispositivo del usuario vía WebGPU. Ningún mensaje sale del equipo.
//
// La disponibilidad real depende de la versión instalada de @mlc-ai/web-llm:
// `availableModels()` filtra este catálogo contra `prebuiltAppConfig` en
// runtime para no ofrecer nunca un ID inexistente.

export interface LocalModelOption {
  // ID exacto en prebuiltAppConfig.model_list de WebLLM.
  id: string;
  // Nombre amigable para la UI.
  label: string;
  // Tamaño aproximado de descarga (pesos del modelo).
  size: string;
  // Descripción corta para ayudar a elegir.
  note: string;
  // Parches al ModelRecord de WebLLM (overrides) para modelos con configs
  // conflictivas. Se aplican en engine.ts al construir el appConfig.
  overrides?: { context_window_size?: number; sliding_window_size?: number };
}

// Por defecto: Qwen 2.5 1.5B — el mejor de los livianos siguiendo instrucciones
// (clave para el guion del chat); cabe en ~1,6 GB de VRAM. Gemma 3 1B queda
// como opción "ultra ligera" (necesita parche, ver overrides).
export const DEFAULT_MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

export const LOCAL_MODEL_CATALOG: LocalModelOption[] = [
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 · 1.5B",
    size: "~1,6 GB",
    note: "Recomendado: el mejor siguiendo el guion.",
  },
  {
    id: "gemma3-1b-it-q4f16_1-MLC",
    label: "Gemma 3 · 1B",
    size: "~0,7 GB",
    note: "Ultra ligero (con parche de compatibilidad).",
    // Bug de web-llm 0.2.84: el registro trae context_window_size=4096 y la
    // config del modelo sliding_window_size=512; el runtime exige que solo uno
    // sea positivo. Con sliding=-1 deja 4096 de contexto completo.
    overrides: { context_window_size: 4096, sliding_window_size: -1 },
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 · 1B",
    size: "~0,9 GB",
    note: "Alternativa simple y estable.",
  },
  {
    id: "gemma-2-2b-it-q4f16_1-MLC",
    label: "Gemma 2 · 2B",
    size: "~1,9 GB",
    note: "Más preciso, pero más pesado.",
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 · 0.5B",
    size: "~0,9 GB",
    note: "Muy ligero y rápido.",
  },
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    label: "SmolLM2 · 360M",
    size: "~0,4 GB",
    note: "El más pequeño; puede equivocarse más.",
  },
];

// Clave de localStorage para recordar el modelo elegido (no es dato sensible:
// es solo una preferencia de la UI). Versionada: al cambiar el default se
// reinicia una vez para que todos prueben el modelo recomendado.
const MODEL_STORAGE_KEY = "apc-ai-model-v2";

// Filtra el catálogo contra los IDs disponibles en la versión instalada.
export function availableModels(prebuiltIds: readonly string[]): LocalModelOption[] {
  const set = new Set(prebuiltIds);
  return LOCAL_MODEL_CATALOG.filter((m) => set.has(m.id));
}

// Opción por id con fallback al primero del catálogo (nunca undefined).
export function findModelOption(id: string): LocalModelOption {
  return LOCAL_MODEL_CATALOG.find((m) => m.id === id) ?? LOCAL_MODEL_CATALOG[0];
}

// Lee el modelo guardado (si sigue en el catálogo); si no, el por defecto.
export function loadSavedModelId(): string {
  try {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    if (saved && LOCAL_MODEL_CATALOG.some((m) => m.id === saved)) return saved;
  } catch {
    /* almacenamiento no disponible */
  }
  return DEFAULT_MODEL_ID;
}

export function saveModelId(id: string): void {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, id);
  } catch {
    /* almacenamiento no disponible */
  }
}
