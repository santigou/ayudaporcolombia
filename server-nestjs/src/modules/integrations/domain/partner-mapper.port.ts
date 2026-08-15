// Puerto (interfaz hexagonal) de un mapper de partner: convierte entre el
// modelo de UNA app partner y el modelo CANÓNICO de Ayuda por Colombia, en
// ambas direcciones (inbound y outbound). Cada partner con un formato propio
// implementa esta interfaz y se registra con su slug en MapperRegistry.

export interface CanonicalLocationInput {
  type: 'location' | 'origin' | 'destination';
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  neighborhood?: string;
}

export interface CanonicalContactInput {
  type: string;
  value: string;
}

export interface CanonicalSupplyInput {
  name: string;
  targetQuantity?: number | null;
  unit?: string | null;
}

// Punto ya normalizado y validado en el modelo canónico de Ayuda por Colombia.
export interface CanonicalPointInput {
  // ID del punto EN EL SISTEMA DEL PARTNER (para dedup/idempotencia).
  externalId: string;
  type: 'need_help' | 'offer_help';
  title: string;
  description: string;
  helpTypeName: string;
  locations: CanonicalLocationInput[];
  contacts: CanonicalContactInput[];
  supplies: CanonicalSupplyInput[];
  expiresAt?: Date | null;
  // Provenance declarada por el partner (anti-eco: si dice app=ayudaporcolombia
  // es un punto nuestro que nos están devolviendo).
  source?: { app?: string; id?: string; code?: string; url?: string };
}

// Un punto nuestro con sus relaciones, listo para serializar outbound.
// Quien lo carga filtra los contactos NO públicos (privacidad).
export interface SerializablePoint {
  id: string;
  code: string;
  type: string;
  title: string;
  description: string;
  status: string;
  verificationStatus: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  helpType: { name: string } | null;
  locations: Array<{
    locationType: string;
    location: { latitude: number; longitude: number; address: string | null; city: string; neighborhood: string };
  }>;
  contacts: Array<{ type: string; value: string }>;
  supplies: Array<{ supply: { name: string }; targetQuantity: any; unit: string | null }>;
  attachments: Array<{ url: string; type: string }>;
}

export type SyncEventName = 'point_created' | 'point_updated';

export interface PartnerMapper {
  // Slug del partner al que aplica este mapper. El valor 'generic' es el
  // contrato JSON por defecto (documentado) que usan los partners sin formato propio.
  readonly slug: string;

  // Valida el payload inbound del partner y lo convierte al modelo canónico.
  // Debe lanzar BadRequestException con detalle si el payload es inválido.
  // Puede ser async (los declarativos evalúan expresiones en un worker).
  parseInbound(raw: unknown): CanonicalPointInput | Promise<CanonicalPointInput>;

  // Convierte un punto nuestro al payload que espera el partner (webhook).
  // Puede ser async (los declarativos evalúan expresiones en un worker).
  toOutbound(point: SerializablePoint, event: SyncEventName): unknown | Promise<unknown>;
}