---
tags: [dominio, datos, rediseño, pendiente]
aliases: [Schema nuevo, Modelo rico, Rediseño]
tipo: referencia
---

# Modelo de datos (rediseño pendiente)

> [!danger] No implementado
> Este es el contenido **actual** de `server/prisma/schema.prisma`, pero **no hay migración** que lo cree y **el código no lo usa**. Ver [[Estado del proyecto y divergencias]].

## Enums del rediseño

```prisma
enum Role               { user, moderator }
enum PointType          { need_help, offer_help }          // ⚠️ renombrado
enum PointStatus        { pending, active, resolved,
                          rejected, expired, cancelled }   // +expired, +cancelled
enum VerificationStatus { pending, approved, rejected }    // reemplaza ModeratorRequestStatus
enum PointLocationType  { location, origin, destination }
enum ContactType        { phone, whatsapp, instagram, email, other }
enum AttachmentType     { image, video, document }
enum ValidationStatus   { confirmed, rejected }
```

## Tablas nuevas / cambiadas

### `User`
- Pierde `name` y `contactInfo` (⚠️ el auth actual los usa → rompería).
- Mantiene `id, email, passwordHash, role, createdAt, updatedAt`.
- Suma relaciones a `Validation`, `Verification`, `PointUpdate`, `ModeratorRequest`.

### `ModeratorRequest`
- Cambia su enum de estado a `VerificationStatus`.
- Idéntica estructura (`userId` unique, `reviewedById`, `reviewedAt`).

### `Point`
- **Pierde**: `lat`, `lng`, `addressText`, `category`, `photos`, `contactInfo`, `verificationCode`, `reviewedById`, `reviewedAt`.
- **Gana**: `helpTypeId` (FK→`HelpType`), `verificationStatus` (`VerificationStatus`), `expiresAt`.
- Mantiene `type` (con nuevos valores), `title`, `description`, `status`, `createdById`.

### `HelpType` *(nueva)*
Catálogo configurable de tipos de ayuda. `name` único + `description`. Reemplaza al enum `PointCategory`.

### `Location` + `PointLocation` *(nuevas)*
- `Location { id, city, neighborhood, address?, latitude, longitude }`.
- `PointLocation { pointId, locationId, locationType }` → tabla de unión con **rol** (`location`/`origin`/`destination`). Permite múltiples ubicaciones por punto (ej. rutas de transporte).

### `Supply` + `PointSupply` *(nuevas)*
- `Supply { id, name }` — catálogo de suministros.
- `PointSupply { pointId, supplyId, targetQuantity?, receivedQuantity?, unit? }` — inventario con cantidades (`Decimal`).

### `Contact` *(nueva)*
Reemplaza el `contactInfo` de texto plano. Múltiples contactos tipados por punto. Campo `isPublic` para ocultar/mostrar.

### `Attachment` *(nueva)*
Reemplaza `photos TEXT[]`. Tipos `image | video | document`, con URL.

### `Validation` *(nueva)*
`User` confirma/rechaza un `Point`. PK compuesta `(pointId, userId)`. Estado `confirmed | rejected`.

### `Verification` *(nueva)*
Historial de verificaciones por moderador (una fila por verificación), reemplazando los campos únicos `reviewedById/reviewedAt`. Incluye `note`.

### `PointUpdate` *(nueva)*
Timeline de mensajes asociados a un punto. `createdById` + `message`.

## Índices (notables)

- `Point`: `[type, status]`, `[verificationStatus]`, `[helpTypeId]`, `[createdAt]`.
- `PointLocation`: `[locationId]`, `[locationType]`, PK `(pointId, locationId, locationType)`.
- `Verification`: `[pointId, createdAt]`, `[moderatorId]`.
- `Contact`, `Attachment`, `Validation`, `PointUpdate`: indexados por `pointId`.

## Qué implica adoptarlo

Un cambio de envergadura: pasó de "mapa de puntos" a **plataforma logística**. Requiere:

1. Migración nueva (`prisma migrate dev`).
2. Reescribir [[API REST - endpoints]] (shapes totalmente distintos).
3. Reescribir frontend: [[types.ts]], formularios, componentes.
4. Decidir qué hacer con `User.name`/`contactInfo` (¿se reincorporan?).
5. Sembrar catálogos: `HelpType`, `Supply`.

## Relacionado

- [[Modelo de datos (actual)]]
- [[Estado del proyecto y divergencias]]
- [[Backlog]]
