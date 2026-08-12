// Modelo de datos del cliente, alineado con el rediseño del backend
// (PointType need_help/offer_help, ubicación en tabla Location, HelpType por catálogo).

export type PointType = "need_help" | "offer_help";
export type PointStatus =
  | "pending"
  | "active"
  | "resolved"
  | "rejected"
  | "expired"
  | "cancelled";
export type VerificationStatus = "pending" | "approved" | "rejected";

// Tipos de contacto según el catálogo ContactType del backend.
export const CONTACT_TYPES = ["phone", "whatsapp", "instagram", "email", "other"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];
export const CONTACT_LABELS: Record<ContactType, string> = {
  phone: "Teléfono",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "Email",
  other: "Otro",
};

// Un contacto: lo envía el formulario (contacts JSON) y lo devuelve el detalle.
export interface ContactInfo {
  type: ContactType;
  value: string;
}

export interface PointLocation {
  lat: number;
  lng: number;
  address: string | null;
  city: string;
  neighborhood: string;
}

// Roles de ubicación según el catálogo PointLocationType del backend.
export const LOCATION_TYPES = ["location", "origin", "destination"] as const;
export type PointLocationType = (typeof LOCATION_TYPES)[number];
export const LOCATION_TYPE_LABELS: Record<PointLocationType, string> = {
  location: "Ubicación",
  origin: "Origen",
  destination: "Destino",
};

// Ubicación con tipo, tal como la devuelve el detalle (GET /:id → locations[]).
export interface PointLocationEntry extends PointLocation {
  type: PointLocationType;
}

// Entrada del formulario de creación: coords aún no marcadas → null.
export interface LocationDraft {
  type: PointLocationType;
  lat: number | null;
  lng: number | null;
  addressText: string;
  city: string;
  neighborhood: string;
}

// Shape público del listado (GET /api/points).
// Respuesta del listado público (GET /api/points) con bbox + cap de resultados.
export interface PointsResponse {
  points: Point[];
  truncated: boolean;
}

// Rectángulo visible del mapa: esquinas suroeste y noreste.
export interface BBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface Point {
  id: string;
  type: PointType;
  title: string;
  description: string;
  status: PointStatus;
  verificationStatus: VerificationStatus;
  createdAt: string;
  helpType: string | null;
  location: PointLocation | null;
  locations?: PointLocationEntry[];
  supplies?: { name: string; targetQuantity: number | null; receivedQuantity: number | null; unit: string | null }[];
  photos: string[];
  contacts?: ContactInfo[];
}

export interface ModeratorRequestSummary {
  id: string;
  status: VerificationStatus;
}

// Novedad/timeline de un punto (GET/POST /api/points/:id/updates).
export interface PointUpdateItem {
  id: string;
  message: string;
  createdAt: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: "user" | "moderator";
  moderatorRequest?: ModeratorRequestSummary | null;
}

// Catálogo fijo de tipos de ayuda que el formulario envía como `helpTypeName`.
// El listado público los devuelve en `helpType` (string).
export const HELP_TYPES = ["Refugio", "Alimentos", "Agua", "Médico", "Otro"] as const;
export type HelpTypeOption = (typeof HELP_TYPES)[number];

// Tope de fotos por punto en el formulario de creación. El backend sigue
// aceptando hasta 5, pero acotamos a 3 en la UI para no saturar.
export const MAX_PHOTOS = 3;

// Suministro del formulario: nombre (catálogo Supply) + cantidad "esperada"
// (targetQuantity) y unidad opcionales. Se envía como JSON `supplies` y el
// backend hace upsert del catálogo y crea filas PointSupply (M:N).
export interface SupplyDraft {
  name: string;
  targetQuantity?: number | null;
  unit?: string | null;
}

// Catálogo de suministros propuesto (no hay seed). El backend hace upsert por
// nombre, así que esto solo guía los checkboxes; el usuario puede añadir "Otro".
export const DEFAULT_SUPPLIES = [
  "Agua",
  "Alimentos no perecederos",
  "Ropa",
  "Medicamentos",
  "Artículos de higiene",
  "Colchones / Mantas",
  "Material de construcción",
  "Voluntarios",
] as const;

// Unidades comunes para la cantidad esperada de un suministro.
export const SUPPLY_UNITS = [
  "Unidades",
  "Kg",
  "Litros",
  "Cajas",
  "Personas",
  "Horas",
] as const;

// Texto legible de una ubicación (para tarjetas/detalle).
export function locationLabel(loc: PointLocation | null): string | null {
  if (!loc) return null;
  const parts = [loc.address, loc.neighborhood, loc.city].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
