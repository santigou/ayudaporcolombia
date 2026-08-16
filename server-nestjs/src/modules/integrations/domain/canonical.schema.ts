import { z } from 'zod';
import { SerializablePoint, SyncEventName } from './partner-mapper.port';

// ============================================================================
// Sobre canónico de integraciones: el ÚNICO formato que entiende el dominio.
// Todos los mappers (genérico o configurable por JSONata) deben producir esto
// (inbound) o partir de esto (outbound). Centralizado aquí para que ambos
// mappers y los dry-runs compartan exactamente la misma validación.
// ============================================================================

const CONTACT_TYPES = ['phone', 'whatsapp', 'instagram', 'email', 'other'] as const;
const LOCATION_TYPES = ['location', 'origin', 'destination'] as const;

// Payload que espera el INBOUND (lo que produce el mapper antes de tocar dominio).
export const inboundPointSchema = z.object({
  // ID del punto en el sistema del partner: nos permite deduplicar (upsert).
  externalId: z.string().min(1).max(200),
  source: z
    .object({
      app: z.string().max(100).optional(),
      id: z.string().max(200).optional(),
      code: z.string().max(50).optional(),
      url: z.string().url().max(500).optional(),
    })
    .optional(),
  point: z.object({
    type: z.enum(['need_help', 'offer_help']),
    title: z.string().min(3).max(200),
    description: z.string().min(10).max(5000),
    helpTypeName: z.string().min(2).max(100),
    locations: z
      .array(
        z.object({
          type: z.enum(LOCATION_TYPES).default('location'),
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
          address: z.string().max(300).optional(),
          city: z.string().max(100).optional(),
          neighborhood: z.string().max(150).optional(),
        }),
      )
      .min(1)
      .max(5),
    contacts: z
      .array(z.object({ type: z.enum(CONTACT_TYPES), value: z.string().min(3).max(300) }))
      .max(10)
      .default([]),
    supplies: z
      .array(
        z.object({
          name: z.string().min(2).max(100),
          targetQuantity: z.number().int().positive().nullable().optional(),
          unit: z.string().max(50).nullable().optional(),
        }),
      )
      .max(30)
      .default([]),
    expiresAt: z.string().datetime().nullable().optional(),
  }),
});

// Formatea el primer error de Zod como mensaje legible (mismo estilo que
// ZodValidationPipe del resto de la app).
export function zodFirstError(error: z.ZodError): string {
  const first = error.errors?.[0];
  return first ? `${first.path.join('.')}: ${first.message}` : 'Payload inválido';
}

// Construye el sobre OUTBOUND canónico (lo que enviamos como webhook y el
// INPUT que reciben las plantillas JSONata de dirección outbound):
// { event, point: {...}, source: { app: 'ayudaporcolombia', ... } }.
export function buildOutboundEnvelope(point: SerializablePoint, event: SyncEventName, clientOrigin: string) {
  const origin = (clientOrigin || '').replace(/\/+$/, '');
  return {
    event, // 'point_created' | 'point_updated'
    point: {
      id: point.id,
      code: point.code,
      type: point.type,
      title: point.title,
      description: point.description,
      status: point.status,
      verificationStatus: point.verificationStatus,
      helpTypeName: point.helpType?.name ?? null,
      locations: point.locations.map((l) => ({
        type: l.locationType,
        lat: l.location.latitude,
        lng: l.location.longitude,
        address: l.location.address ?? undefined,
        city: l.location.city,
        neighborhood: l.location.neighborhood,
      })),
      // Solo contactos públicos (privacidad): quien carga el punto filtra.
      contacts: point.contacts.map((c) => ({ type: c.type, value: c.value })),
      supplies: point.supplies.map((s) => ({
        name: s.supply.name,
        targetQuantity: s.targetQuantity != null ? Number(s.targetQuantity) : null,
        unit: s.unit,
      })),
      photos: point.attachments.filter((a) => a.type === 'image').map((a) => a.url),
      expiresAt: point.expiresAt,
      createdAt: point.createdAt,
      updatedAt: point.updatedAt,
    },
    // Provenance: identifica QUE este punto viene de Ayuda por Colombia para
    // que el receptor detecte ecos y no nos lo devuelva (anti-bucle).
    source: {
      app: 'ayudaporcolombia',
      id: point.id,
      code: point.code,
      ...(origin ? { url: `${origin}/p/${point.code}` } : {}),
    },
  };
}