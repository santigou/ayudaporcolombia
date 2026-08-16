// Esquemas OpenAPI compartidos de las integraciones: enums canónicos y el
// sobre que enviamos por webhook. Se inyectan en components.schemas (main.ts)
// para que Swagger los muestre como tipos reutilizables ($ref) y aparezcan en
// la sección "Schemas" de /api/docs — única fuente de verdad del contrato.

export const PointTypeSchema = {
  type: 'string',
  enum: ['need_help', 'offer_help'],
  description: '`need_help` = alguien NECESITA ayuda (SOS) · `offer_help` = alguien OFRECE ayuda',
};

export const LocationTypeSchema = {
  type: 'string',
  enum: ['location', 'origin', 'destination'],
  description:
    '`location` = punto único en el mapa · `origin` = punto de partida (ruta) · `destination` = destino (ruta)',
};

export const ContactTypeSchema = {
  type: 'string',
  enum: ['phone', 'whatsapp', 'instagram', 'email', 'other'],
  description: 'Canal de contacto del punto',
};

export const PointStatusSchema = {
  type: 'string',
  enum: ['pending', 'active', 'resolved', 'cancelled', 'expired', 'rejected'],
  description:
    'Ciclo de vida: `pending` en moderación · `active` visible · `resolved` resuelto (visible) · los demás ya no se muestran',
};

export const VerificationStatusSchema = {
  type: 'string',
  enum: ['pending', 'approved', 'rejected'],
  description: 'Sello de verificación oficial de moderación',
};

export const SyncEventSchema = {
  type: 'string',
  enum: ['point_created', 'point_updated'],
  description: '`point_created` = punto nuevo o recién publicado · `point_updated` = cambió (estado/datos)',
};

const canonicalLocation = {
  type: 'object',
  required: ['type', 'lat', 'lng'],
  properties: {
    type: { $ref: '#/components/schemas/LocationType' },
    lat: { type: 'number', format: 'double', example: 4.711, minimum: -90, maximum: 90 },
    lng: { type: 'number', format: 'double', example: -74.0721, minimum: -180, maximum: 180 },
    address: { type: 'string', example: 'Cra 7 #71-21' },
    city: { type: 'string', example: 'Bogotá' },
    neighborhood: { type: 'string', example: 'Chapinero' },
  },
};

const canonicalContact = {
  type: 'object',
  required: ['type', 'value'],
  properties: {
    type: { $ref: '#/components/schemas/ContactType' },
    value: { type: 'string', example: '3001234567' },
  },
};

export const INTEGRATION_SCHEMAS: Record<string, object> = {
  PointType: PointTypeSchema,
  LocationType: LocationTypeSchema,
  ContactType: ContactTypeSchema,
  PointStatus: PointStatusSchema,
  VerificationStatus: VerificationStatusSchema,
  SyncEvent: SyncEventSchema,

  CanonicalPointInput: {
    type: 'object',
    description:
      'Contrato INBOUND: lo que debe producir tu mapeo (o tu integración directa) para crear un punto en nuestro sistema.',
    required: ['externalId', 'point'],
    properties: {
      externalId: { type: 'string', description: 'ID del punto EN TU sistema (dedup/idempotencia)', example: 'punto-123' },
      source: {
        type: 'object',
        description: 'Provenance opcional (anti-eco). Si app=ayudaporcolombia el envío se ignora.',
        properties: {
          app: { type: 'string', example: 'mi-app' },
          id: { type: 'string' },
          code: { type: 'string' },
          url: { type: 'string', format: 'uri' },
        },
      },
      point: {
        type: 'object',
        required: ['type', 'title', 'description', 'helpTypeName', 'locations'],
        properties: {
          type: { $ref: '#/components/schemas/PointType' },
          title: { type: 'string', minLength: 3, maxLength: 200, example: 'Centro de acopio norte' },
          description: { type: 'string', minLength: 10, maxLength: 5000, example: 'Recibimos comida no perecedera y agua.' },
          helpTypeName: { type: 'string', minLength: 2, maxLength: 100, example: 'Donaciones' },
          locations: { type: 'array', minItems: 1, maxItems: 5, items: canonicalLocation },
          contacts: { type: 'array', maxItems: 10, description: 'offer_help exige al menos 1', items: canonicalContact },
          supplies: {
            type: 'array',
            maxItems: 30,
            items: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string', example: 'Agua' },
                targetQuantity: { type: 'integer', example: 100 },
                unit: { type: 'string', example: 'litros' },
              },
            },
          },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  },
};

// Sobre que enviamos al webhook del partner (outbound). Es el INPUT de las
// plantillas de mapeo outbound (jsonata: point.*, event, source.*).
INTEGRATION_SCHEMAS.CanonicalEnvelope = {
  type: 'object',
  description:
    'Payload que enviamos a TU webhook (outbound). Este objeto es el input de tu plantilla de mapeo outbound.',
  properties: {
    event: { $ref: '#/components/schemas/SyncEvent' },
    point: {
      type: 'object',
      description: 'El punto (solo datos públicos; nunca email del creador ni contactos privados).',
      properties: {
        id: { type: 'string', format: 'uuid' },
        code: { type: 'string', example: 'AB12CD34', description: 'Código público compartible (/p/CODE)' },
        type: { $ref: '#/components/schemas/PointType' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { $ref: '#/components/schemas/PointStatus' },
        verificationStatus: { $ref: '#/components/schemas/VerificationStatus' },
        helpTypeName: { type: 'string', nullable: true, example: 'Donaciones' },
        locations: { type: 'array', items: canonicalLocation },
        contacts: { type: 'array', items: canonicalContact },
        supplies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              targetQuantity: { type: 'integer', nullable: true },
              unit: { type: 'string', nullable: true },
            },
          },
        },
        photos: { type: 'array', items: { type: 'string', format: 'uri' } },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    source: {
      type: 'object',
      description: 'Provenance: identifica que viene de Ayuda por Colombia (anti-eco en tu lado).',
      properties: {
        app: { type: 'string', example: 'ayudaporcolombia' },
        id: { type: 'string', format: 'uuid' },
        code: { type: 'string', example: 'AB12CD34' },
        url: { type: 'string', format: 'uri', example: 'https://ayuda.tudominio.com/p/AB12CD34' },
      },
    },
  },
} as object;

// Inyecta los esquemas en el documento OpenAPI (llamar tras createDocument).
export function applyIntegrationSchemas(document: Record<string, any>): void {
  document.components = document.components ?? {};
  document.components.schemas = {
    ...(document.components.schemas ?? {}),
    ...INTEGRATION_SCHEMAS,
  };
}