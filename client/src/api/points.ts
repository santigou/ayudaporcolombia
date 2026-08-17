// Publicación de puntos compartida por el formulario (CreateWizard) y el chat
// con IA (AiChat): sube las fotos directo al almacenamiento (presign + PUT) y
// crea el punto con un único POST /points (JSON, sin multipart). Centralizarlo
// aquí garantiza que ambos flujos validen y reporten errores igual.

import { api, uploadFile } from "./client";
import {
  MAX_PHOTOS,
  type ContactInfo,
  type HelpTypeOption,
  type PointLocationType,
  type PointType,
  type SupplyDraft,
} from "../types";

// Ubicación lista para enviar (coords ya marcadas en el mapa).
export interface PublishLocation {
  // "location" es lo normal; el wizard permite origin/destination.
  type: PointLocationType;
  lat: number;
  lng: number;
  addressText: string;
  city: string;
  neighborhood: string;
}

export interface PublishPointInput {
  type: PointType;
  title: string;
  description: string;
  // Obligatorio para ambos tipos de punto (catálogo del backend).
  helpTypeName: HelpTypeOption;
  locations: PublishLocation[];
  contacts: ContactInfo[];
  supplies?: SupplyDraft[];
  photos: File[];
}

export interface PublishPointResult {
  code: string;
  type: PointType;
  // "approved" cuando el creador es moderador: el punto nace verificado.
  verificationStatus?: "pending" | "approved" | "rejected";
}

export async function publishPoint(input: PublishPointInput): Promise<PublishPointResult> {
  // 1) Subir fotos directamente al almacenamiento (presign + PUT).
  //    Los bytes no pasan por el backend: van al CDN de SeaweedFS (prod)
  //    o a disco (dev).
  const photoUrls = await Promise.all(
    input.photos.slice(0, MAX_PHOTOS).map(async (f) => {
      const { uploadUrl, publicUrl, headers } = await api.presignUpload(f.name, f.type);
      await uploadFile(uploadUrl, f, headers);
      return publicUrl;
    }),
  );
  // 2) Crear el punto con JSON (sin multipart).
  const validSupplies = (input.supplies ?? [])
    .map((s) => ({
      name: s.name.trim(),
      targetQuantity: s.targetQuantity ?? undefined,
      unit: s.unit ?? undefined,
    }))
    .filter((s) => s.name.length >= 2);
  const validContacts = input.contacts
    .map((c) => ({ type: c.type, value: c.value.trim() }))
    .filter((c) => c.value);
  const created = await api.post<{ code: string; verificationStatus?: "pending" | "approved" | "rejected" }>("/points", {
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    locations: input.locations,
    helpTypeName: input.helpTypeName,
    contacts: validContacts,
    ...(validSupplies.length > 0 ? { supplies: validSupplies } : {}),
    photoUrls,
  });
  return { code: created.code, type: input.type, verificationStatus: created.verificationStatus };
}
