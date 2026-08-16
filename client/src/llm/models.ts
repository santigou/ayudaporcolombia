// Catálogo de modelos locales para el asistente por chat (WebLLM).
//
// Los IDs corresponden a modelos precompilados de WebLLM (mlc-ai) que se
// descargan UNA vez a la caché del navegador y se ejecutan 100% en el
// dispositivo del usuario vía WebGPU. Ningún mensaje sale del equipo.
//
// Decisión: un ÚNICO modelo curado. Los más pequeños (0.5B/360M, probados)
// no seguían el guion del agente (varias preguntas a la vez, texto inventado,
// «publicando» prematuro) y el selector confundía; Qwen 2.5 1.5B es el mejor
// equilibrio calidad/tamaño para la entrevista con tool calls.

export interface LocalModelOption {
  // ID exacto en prebuiltAppConfig.model_list de WebLLM.
  id: string;
  // Nombre amigable para la UI.
  label: string;
  // Tamaño aproximado de descarga (pesos del modelo).
  size: string;
  // Descripción corta para ayudar a elegir.
  note: string;
}

// Único modelo soportado (y por defecto).
export const DEFAULT_MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

export const LOCAL_MODEL_CATALOG: LocalModelOption[] = [
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 · 1.5B",
    size: "~1,6 GB",
    note: "Recomendado: el mejor siguiendo el guion.",
  },
];

// Clave de localStorage para recordar el modelo elegido (no es dato sensible:
// es solo una preferencia de la UI). Versionada: v3 = catálogo de un solo
// modelo; cualquier valor guardado de versiones anteriores cae al default.
const MODEL_STORAGE_KEY = "apc-ai-model-v3";

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
