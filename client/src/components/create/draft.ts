import type {
  ContactInfo,
  HelpTypeOption,
  LocationDraft,
  PointType,
  SupplyDraft,
} from "../../types";

// Persistencia del borrador del asistente de creación en `sessionStorage`.
// Se usa para que, si un usuario que crea un `offer_help` debe iniciar sesión,
// no pierda todo lo que ya rellenó: guardamos antes de ir a /login y restauramos
// al volver a /crear. session* (no localStorage) para que se limpie al cerrar
// la pestaña: es un borrador temporal, no datos guardados del usuario.

const DRAFT_KEY = "apc_createPointDraft";

export interface DraftPhoto {
  name: string;
  dataUrl: string;
}

export interface CreateDraft {
  type: PointType;
  title: string;
  description: string;
  helpType: HelpTypeOption;
  supplies: SupplyDraft[];
  contacts: ContactInfo[];
  locations: LocationDraft[];
  step: number;
  activeIndex: number;
  // Las fotos no son serializables: se guardan como data URLs (base64).
  photos: DraftPhoto[];
}

export function loadDraft(): CreateDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CreateDraft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: CreateDraft): void {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft(): void {
  sessionStorage.removeItem(DRAFT_KEY);
}

export function hasDraft(): boolean {
  return sessionStorage.getItem(DRAFT_KEY) !== null;
}

// File → data URL (async, vía FileReader). Para guardar las fotos en el borrador.
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// data URL → File (síncrono, vía atob). Para restaurar las fotos del borrador.
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}
