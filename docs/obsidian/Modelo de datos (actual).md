---
tags: [dominio, datos, actual]
aliases: [Schema actual, Modelo simple]
tipo: referencia
---

# Modelo de datos (actual)

> [!info] Este es el modelo con el que el código realmente funciona
> No confundir con [[Modelo de datos (rediseño pendiente)]], que está en `schema.prisma` pero no migrado.

## Enums (modelo actual)

```prisma
enum Role                  { user, moderator }
enum PointType             { ayuda, necesita_ayuda }
enum PointCategory         { refugio, alimentos, agua, medico, otro }
enum PointStatus           { pending, approved, rejected, active, resolved }
enum ModeratorRequestStatus { pending, approved, rejected }
```

> [!warning] La migración SQL usa `ModeratorRequestStatus`, pero el schema actual lo llama `VerificationStatus`
> Eso es parte de la divergencia: la `migration.sql` de `init` coincide con el modelo actual, **no** con el `schema.prisma` de hoy.

## Tablas (según `migration.sql`)

### `User`
| campo | tipo | notas |
|---|---|---|
| `id` | TEXT PK | cuid |
| `name` | TEXT | requerido |
| `email` | TEXT UNIQUE | |
| `passwordHash` | TEXT | bcrypt |
| `role` | Role | default `user` |
| `contactInfo` | TEXT | nullable |
| `createdAt` | TIMESTAMP | |

### `ModeratorRequest`
| campo | tipo | notas |
|---|---|---|
| `id` | TEXT PK | |
| `userId` | TEXT UNIQUE FK→User | una solicitud por usuario |
| `status` | ModeratorRequestStatus | default `pending` |
| `reviewedById` | TEXT? FK→User | |
| `reviewedAt` | TIMESTAMP? | |
| `createdAt` | TIMESTAMP | |

### `Point`
| campo | tipo | notas |
|---|---|---|
| `id` | TEXT PK | |
| `type` | PointType | |
| `title` | TEXT | |
| `description` | TEXT | |
| `lat`, `lng` | DOUBLE | ubicación directa |
| `addressText` | TEXT? | |
| `category` | PointCategory? | solo para `ayuda` |
| `photos` | TEXT[] | array de URLs `/uploads/...` |
| `contactInfo` | TEXT | contacto del punto |
| `verificationCode` | TEXT? | solo para `ayuda` |
| `status` | PointStatus | ver [[Estados y ciclos de vida de un Punto]] |
| `createdById` | TEXT FK→User (RESTRICT) | |
| `reviewedById` | TEXT? FK→User (SET NULL) | |
| `reviewedAt` | TIMESTAMP? | |
| `createdAt`, `updatedAt` | TIMESTAMP | |

### Índices
- `User_email_key` (unique)
- `ModeratorRequest_userId_key` (unique)
- `Point_type_status_idx` → soporta el listado público filtrado por tipo+estado.

## Relaciones

- `User 1—N Point` (creador)
- `User 1—N Point` (revisor, opcional)
- `User 1—1 ModeratorRequest` (solicitante, única)
- `User 1—N ModeratorRequest` (revisor, opcional)

## Invariante de negocio

- Un `Point` de tipo `ayuda` **nace `pending`** y necesita un `verificationCode`.
- Un `Point` de tipo `necesita_ayuda` **nace `active`**, sin código.
- Solo se exponen públicamente: `ayuda+approved` y `necesita_ayuda+active/resolved`.

## Relacionado

- [[Modelo de datos (rediseño pendiente)]]
- [[Estados y ciclos de vida de un Punto]]
- [[Estado del proyecto y divergencias]]
- [[Diagramas Mermaid]]
