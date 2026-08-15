# Integraciones partner (federación de puntos)

> Módulo `server-nestjs/src/modules/integrations/` — permite que **otras apps de ayuda**
> nos envíen sus puntos (inbound) y reciban los nuestros (outbound), convirtiendo
> entre su modelo y el nuestro con **mappers por partner** (genérico o declarativo
> JSONata autogestionado).

## Onboarding de un partner (2 vías)

**Vía self-service (portal web)** — `/partners` en el cliente:
1. La app se registra (nombre, slug, contacto) y recibe su **primera API key**
   (visible una sola vez).
2. El partnership queda **pendiente**: un moderador lo aprueba con
   `POST /api/admin/partners/:id/approve` (o `GET /api/admin/partners?pending=true`
   para ver la cola) y la key cobra vida.
3. Con la key entran al **dashboard** (`/partners/dashboard`): estado, gestión de
   keys propias (`/api/integrations/v1/keys`), editor de mapeos con playground
   dry-run y sus entregas (`/api/integrations/v1/deliveries`).

**Vía manual (moderador)** — `POST /api/admin/partners` + emitir key (como antes).

## Documentación interactiva

**Swagger UI público en `/api/docs`** (también en producción): todos los
endpoints con sus auth (`ApiKeyAuth` para partners, `bearerJWT` para
usuarios/moderadores), payload de ejemplo del contrato genérico y try-it-out.
El JSON OpenAPI crudo: `GET /api/docs-json`.

## Visión general

```
  Partner A ──POST /api/integrations/v1/points (API key)──▶  NOSOTROS
                                                              │ guarda + fan-out
  Partner B ◀──webhook (api_key o login→Bearer)──────────────┘
```

- **Misma BD, mismo `schema.prisma`**: tablas nuevas `Partner`, `PartnerApiKey`,
  `PartnerPointLink`, `PartnerSyncLog` (migración `20260815062434_add_integrations`).
- El aislamiento es de **código** (módulo hexagonal propio), no de base de datos.
- La cola de envíos es la propia tabla `PartnerSyncLog` (job queue en Postgres con
  reintentos y backoff exponencial). Migra a BullMQ/RabbitMQ implementando
  `SyncQueuePort` — nada más cambia.

## 1) Inbound: partner → nosotros

`POST /api/integrations/v1/points`

Auth (una de las dos):
- Header `X-API-Key: apc_...`
- Header `Authorization: Bearer apc_...`

Payload (contrato genérico):

```jsonc
{
  "externalId": "id-del-punto-en-su-sistema",   // dedup/idempotencia (upsert)
  "source": {                                    // opcional, anti-eco
    "app": "su-app", "id": "...", "code": "...", "url": "https://..."
  },
  "point": {
    "type": "need_help" | "offer_help",
    "title": "mín 3, máx 200",
    "description": "mín 10, máx 5000",
    "helpTypeName": "p. ej. Donaciones",
    "locations": [                               // 1..5
      { "type": "location|origin|destination", "lat": 4.71, "lng": -74.07,
        "address": "...", "city": "...", "neighborhood": "..." }
    ],
    "contacts": [ { "type": "phone|whatsapp|instagram|email|other", "value": "..." } ], // offer_help: ≥1
    "supplies": [ { "name": "Agua", "targetQuantity": 100, "unit": "litros" } ],
    "expiresAt": "2026-12-31T00:00:00.000Z"      // opcional
  }
}
```

Respuestas:
- `201` creado → `{ pointId, code, status, verificationStatus, created: true, ... }`
- `200` existía (upsert/dedup) → `{ ..., updated|deduplicated }`
- Errores: `400` payload inválido (detalle del campo), `401` sin/inválida API key,
  `403` partner con inbound deshabilitado.

Consulta de estado: `GET /api/integrations/v1/points/:externalId/status`
(devuelve status/verificationStatus actuales del punto).

**Política de moderación** (campo `Partner.trusted`):
- `trusted: true` → entra `active` + `approved` (publicación inmediata).
- `trusted: false` → `offer_help` entra `pending` (cola de moderación normal);
  `need_help` entra `active` (paridad con el flujo SOS anónimo).

**Idempotencia**: si reenvían el mismo contenido (firma canónica idéntica),
responde `deduplicated: true` sin tocar BD ni re-difundir.

**Anti-eco**: si el payload declara `source.app = "ayudaporcolombia"` (nos están
devolviendo un punto nuestro), se ignora y solo se asegura el vínculo.

## 2) Outbound: nosotros → partner (webhook)

Disparadores (automáticos):
- Punto creado local (`POST /api/points`) y punto importado inbound → broadcast
  `point_created` a todos los partners con `outboundEnabled` + `sendOnCreated`,
  excluyendo al origin y a quienes ya lo tienen.
- Aprobación de moderación (`approvePoint`) → `point_created` a quien no lo tenga.
- Cambios de ciclo de vida (`changeStatus`, `verifyPoint`, solicitud aprobada) →
  `point_updated` SOLO a los partners que ya tienen el punto.

Envío: `POST {Partner.outboundUrl}` con el JSON canónico (`event`, `point`, `source`
con `app=ayudaporcolombia` para que ellos detecten ecos). Solo contactos públicos.
Respuesta 2xx = entregado; si devuelven `{ "id": "..." }` se guarda como externalId.

**Auth por partner** (`Partner.authType`):
- `api_key`: header configurable (`outboundHeaderName`, default `X-API-Key`) con
  el valor cifrado en BD (AES-256-GCM con `INTEGRATION_ENCRYPTION_KEY`).
- `login`: POST `{email,password}` a `loginUrl`, token extraído por
  `tokenJsonPath` (default `token`, admite `data.token`), cacheado en memoria y
  enviado como `Authorization: Bearer` (configurable con `tokenHeader`).
  Si el webhook da 401/403 → re-login automático y UN reintento.

**Reintentos**: backoff exponencial 30s·2^n (máx 1h), hasta
`INTEGRATION_MAX_ATTEMPTS` (default 6). Después → `failed` visible en admin.

## 3) Administración (JWT + rol moderador)

| Endpoint | Uso |
|---|---|
| `POST /api/admin/partners` | crear partner (`slug` inmutable, `trusted`, flags outbound, credenciales) |
| `GET/PATCH/DELETE /api/admin/partners[/:id]` | listar/editar/borrar |
| `POST /api/admin/partners/:id/api-keys` | emitir API key — **se muestra UNA sola vez** |
| `GET /api/admin/partners/:id/api-keys` | listar (prefijo + lastUsedAt) |
| `DELETE /api/admin/partners/:id/api-keys/:keyId` | revocar |
| `GET /api/admin/sync-logs?status=failed&partnerId=...` | cola/historial de envíos |
| `POST /api/admin/sync-logs/:id/retry` | reintentar un job failed/skipped |

Ejemplo de alta de partner:

```bash
curl -X POST http://localhost:4000/api/admin/partners \
  -H "Cookie: token=<jwt-moderador>" -H "Content-Type: application/json" \
  -d '{
    "slug": "app-b", "name": "App B", "trusted": true,
    "outboundEnabled": true, "outboundUrl": "https://app-b.com/api/webhooks/ayuda",
    "authType": "api_key", "outboundApiKeyValue": "la-key-que-nos-dieron"
  }'
```

## 4) Mappers custom

Dos mecanismos, en orden de preferencia:

1. **Mapeo declarativo (recomendado, self-service)**: el partner registra vía
   su API key un JSON de mapeo con expresiones JSONata
   (`/api/integrations/v1/mappings`, con dry-run y versionado). Ver
   **`Mapeos por expresiones (JSONata).md`** — es el documento para compartir
   con los equipos de las otras apps.
2. **Mapper de código**: clase `@Injectable()` que implemente `PartnerMapper`
   (`parseInbound` + `toOutbound`) con `slug` del partner, registrada en el
   array de `PARTNER_MAPPERS` en `integrations.module.ts`.

Si no hay ninguno de los dos, aplica el contrato genérico (`GenericMapper`).

## 5) Seguridad

- API keys: solo hash SHA-256 en BD; prefijo para la UI; revocación inmediata;
  `lastUsedAt` por uso. Formato `apc_<40 chars>`.
- Credenciales outbound cifradas AES-256-GCM (`INTEGRATION_ENCRYPTION_KEY`,
  obligatoria). Por la API solo se ven máscaras `••••1234`.
- Nunca salen outbound: email del creador, contactos no públicos, deleteToken.
- Envíos solo de puntos públicamente visibles (revisa `isPubliclyVisible`).

## 6) Variables de entorno

| Var | Obligatoria | Default | Uso |
|---|---|---|---|
| `INTEGRATION_ENCRYPTION_KEY` | sí (para guardar credenciales) | — | cifrado AES-256-GCM |
| `INTEGRATION_WORKER_INTERVAL_MS` | no | 3000 | polling del worker |
| `INTEGRATION_OUTBOUND_TIMEOUT_MS` | no | 10000 | timeout de webhooks |
| `INTEGRATION_MAX_ATTEMPTS` | no | 6 | reintentos por job |

## 7) Flujo completo de ejemplo

1. Moderador crea partner `app-b` (trusted, con credenciales) → emite API key.
2. App B nos POSTea un punto con su API key → punto creado `active/approved`.
3. El `SyncDispatcher` encola `point_created` para App C (que también es partner).
4. El `SyncWorker` entrega el webhook a App C con su auth; si falla reintenta
   con backoff; queda visible en `/api/admin/sync-logs`.
5. App B actualiza el punto (mismo `externalId`) → diff de firma → update +
   `point_updated` SOLO a quienes ya lo tenían (App C), nunca de vuelta a B.