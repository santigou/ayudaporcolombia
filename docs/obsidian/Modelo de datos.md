---
tags: [dominio, datos, vigente]
aliases: [Schema, Modelo de datos, Modelo rico]
tipo: referencia
---

# Modelo de datos

> [!info] Modelo vigente
> Este es el modelo con el que el código y la base de datos funcionan hoy. Está en `server/prisma/schema.prisma` y lo crea la migración `20260812160000_init`. Pasó de "mapa de puntos simple" a una **plataforma de ayuda más estructurada** (ubicaciones múltiples, catálogos, verificaciones con historial, trazabilidad).

## Enums

```prisma
enum Role               { user, moderator }
enum PointType          { need_help, offer_help }          // offer_help = recurso/oferta, need_help = persona no ubicada
enum PointStatus        { pending, active, resolved, rejected, expired, cancelled }
enum VerificationStatus { pending, approved, rejected }    // estado de moderación de un punto o solicitud
enum PointLocationType  { location, origin, destination }  // rol de una ubicación dentro del punto
enum ContactType        { phone, whatsapp, instagram, email, other }
enum AttachmentType     { image, video, document }
enum ValidationStatus   { confirmed, rejected }            // validación comunitaria de un punto
```

> [!warning] Nomenclatura
> El modelo anterior usaba `ayuda` / `necesita_ayuda`. Ahora es `offer_help` (lo que antes era `ayuda`) y `need_help` (lo que era `necesita_ayuda`). Ojo al migrar datos o comparar con documentación antigua.

## Modelos principales

### `User`
| campo | tipo | notas |
|---|---|---|
| `id` | String PK | uuid (v4, nativo Postgres) |
| `email` | String unique | |
| `passwordHash` | String | bcrypt |
| `role` | Role | default `user` |
| `createdAt`, `updatedAt` | DateTime | |

> [!warning] Sin `name` ni `contactInfo`
> A diferencia del modelo anterior, `User` **no** tiene `name` ni `contactInfo`. El registro/login operan solo con email + contraseña. El contacto de un punto vive en la tabla `Contact` (asociada al punto, no al usuario).

Relaciones: `points` (creados), `validations`, `verifications` (como moderador), `pointUpdates`, `moderatorRequests` (propias), `reviewedRequests`.

### `Point`
| campo | tipo | notas |
|---|---|---|
| `id` | String PK | uuid (v4, nativo Postgres) |
| `type` | PointType | `need_help` o `offer_help` |
| `title`, `description` | String | |
| `helpTypeId` | String? | FK → `HelpType` (catálogo). Reemplaza al antiguo enum `PointCategory`. |
| `status` | PointStatus | default `pending` |
| `verificationStatus` | VerificationStatus | default `pending` |
| `createdById` | String? | FK → `User` (nullable: puede haber puntos anónimos) |
| `createdAt`, `updatedAt` | DateTime | |
| `expiresAt` | DateTime? | |

> [!warning] Sin coordenadas ni fotos directas
> `Point` **no** tiene `lat`, `lng`, `addressText`, `category`, `photos`, `contactInfo`, ni `verificationCode`. Esos se modelan en tablas relacionadas: `Location`/`PointLocation` (coordenadas), `Attachment` (fotos), `Contact` (contacto), y la verificación pasa a `Verification` + `verificationStatus`.

Relaciones: `helpType`, `locations[]` (PointLocation), `supplies[]` (PointSupply), `contacts[]`, `validations[]`, `verifications[]`, `updates[]` (PointUpdate), `attachments[]`.
Índices: `[type, status]`, `[verificationStatus]`, `[helpTypeId]`, `[createdAt]`.


## Catálogos y relaciones

### `HelpType`
Catálogo configurable de tipos de ayuda. `{ id, name unique, description }`. Reemplaza al enum `PointCategory`. El frontend envía un nombre (Refugio, Alimentos, …) y el backend hace `upsert` por nombre.

### `Location` + `PointLocation`
- `Location { id, city, neighborhood, address?, latitude, longitude }` — lugar geográfico reutilizable.
- `PointLocation { pointId, locationId, locationType }` — tabla de unión con **rol** (`location`/`origin`/`destination`). PK compuesta `(pointId, locationId, locationType)`. Permite múltiples ubicaciones por punto (ej. rutas de transporte).

### `Supply` + `PointSupply`
- `Supply { id, name unique }` — catálogo de suministros (upsert por nombre en la creación).
- `PointSupply { pointId, supplyId, targetQuantity?, receivedQuantity?, unit? }` — inventario por punto con cantidades `Decimal`. PK compuesta. **Se crea desde el asistente** (`POST /points` con `supplies` JSON) con la cantidad "esperada" (`targetQuantity`) y unidad opcionales. `receivedQuantity` queda para seguimiento posterior de donaciones recibidas.

### `Contact`
Múltiples contactos tipados por punto. `{ id, pointId, type: ContactType, value, isPublic }`. Reemplaza al `contactInfo` de texto plano.

### `Attachment`
Reemplaza a `photos TEXT[]`. `{ id, pointId, url, type: AttachmentType, createdAt }`. Soporta imagen, video y documento.

## Verificación y trazabilidad

### `Verification`
Historial de verificaciones por moderador (una fila por acción), reemplazando a los campos únicos `reviewedById`/`reviewedAt` del modelo anterior. `{ id, pointId, moderatorId, status: VerificationStatus, note?, createdAt }`. Índices `[pointId, createdAt]` y `[moderatorId]`.

### `Validation`
Validación comunitaria: un `User` confirma/rechaza un `Point`. PK compuesta `(pointId, userId)`. `status: ValidationStatus`.

### `PointUpdate`
Timeline de mensajes asociados a un punto. `{ id, pointId, createdById, message, createdAt }`.

## Invariante de negocio y visibilidad

- Un `Point` de tipo `offer_help` **nace `pending`** (con `verificationStatus = pending`) y requiere la aprobación de un moderador para publicarse.
- Un `Point` de tipo `need_help` **nace `active`**, sin moderación previa (se marca como no verificado en la UI).
- **Visibilidad pública** (regla en `points.routes.ts`):
  - `offer_help` → visible solo si `verificationStatus = approved`.
  - `need_help` → visible si `status ∈ { active, resolved }`.

> [!info] Múltiples ubicaciones en uso
> Aunque el modelo siempre permitió varias ubicaciones por punto, ahora el formulario de creación y el detalle **las exponen**: `POST /` acepta `locations[]` (rol `location`/`origin`/`destination`) y `GET /:id` devuelve `locations[]`. El listado `GET /` sigue devolviendo `location` (la principal, rol `location`) para los marcadores del mapa.

> [!info] Moderación cambia `verificationStatus`
> Al aprobar/rechazar, el backend crea un registro en `Verification` y actualiza `verificationStatus` (+ `status` a `active`/`rejected`). Ver [[Flujo de moderación]].

## Notas de implementación

- La API **normaliza** el modelo rico a un shape más simple en los endpoints públicos (ver [[API REST - endpoints]]): el listado devuelve `location: { lat, lng, address, ... }` y `photos: string[]` en lugar de exponer `PointLocation`/`Attachment` crudos.
- El modelo define capacidades aún no expuestas por endpoints (suministros, validaciones comunitarias). Las ubicaciones múltiples (origen/destino) **ya se exponen** en creación y detalle. Ver [[Backlog]].

## Relacionado

- [[Estados y ciclos de vida de un Punto]]
- [[Tipos de Punto - ayuda vs necesita_ayuda]]
- [[Flujo de creación de un Punto]]
- [[Flujo de moderación]]
- [[API REST - endpoints]]
- [[Diagramas Mermaid]]
- [[Estado del proyecto]]

### `ModeratorRequest`
Solicitud de un usuario para ser moderador. `userId` único (una solicitud por usuario). `status` es `VerificationStatus`. Campos: `id`, `userId`, `status`, `reviewedById?`, `reviewedAt?`, `createdAt`. Índice en `status`.
