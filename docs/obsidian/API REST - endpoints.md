---
tags: [api, endpoints, backend]
aliases: [Rutas, API, Endpoints]
tipo: referencia
---

# API REST — endpoints

Catálogo de rutas del backend. Prefijo `/api`. Base URL: `http://localhost:4000` (dev) o mismo origen (prod).

> [!info] Shapes normalizados
> El modelo de DB es rico (ver [[Modelo de datos]]), pero la API **normaliza** las respuestas a shapes más simples: el listado devuelve `location: {lat,lng,...}` y `photos: string[]` en lugar de exponer `PointLocation`/`Attachment` crudos.

## Auth (`/api/auth`)

| Método | Path | Auth | Body | Devuelve |
|---|---|---|---|---|
| POST | `/register` | — | `{email,password,wantsModerator?}` | `201 {id,email,role}` + cookie |
| POST | `/login` | — | `{email,password}` | `200 {id,email,role}` + cookie |
| POST | `/logout` | — | — | `204`, limpia cookie |
| GET | `/me` | ✅ | — | `{id,email,role,moderatorRequest:{id,status}|null}` |

Validaciones (zod): `register` → email, password 8–100. `login` → email + password mínima.

> [!warning] Sin `name` ni `contactInfo`
> El registro ya **no** acepta `name` ni `contactInfo` (el modelo `User` no los tiene).

## Points (`/api/points`)

| Método | Path | Auth | Notas |
|---|---|---|---|
| GET | `/` | — | Lista pública **por zona visible**. Query: `type` (`need_help`/`offer_help`), `minLat`, `maxLat`, `minLng`, `maxLng` (bounding box del mapa). Cap de 300; `{points, truncated}`. |
| GET | `/:id` | — | Detalle si es visible públicamente; si no, 404. |
| GET | `/:id/updates` | — | Timeline de novedades (`PointUpdate`) del punto (si es visible). |
| POST | `/:id/updates` | ✅ | Publica una novedad. Body `{ message }` (1–500). Crea `PointUpdate`. |
| POST | `/` | ✅ offer_help · – need_help | Crea punto. `multipart/form-data` con fotos (max 5). `offer_help` exige sesión; `need_help` puede ser anónimo. |

**GET `/`** devuelve `{ points: [...], truncated }`. Por punto: `{id,type,title,description,status,verificationStatus,createdAt,helpType,location:{lat,lng,address,city,neighborhood}|null,photos:string[]}`. Filtra por zona (`minLat/maxLat/minLng/maxLng`):
- `offer_help` → `verificationStatus=approved`
- `need_help` → `status ∈ {active,resolved}`
- Si hay más de 300 visibles → `truncated: true` (la UI pide acercarse) y devuelve los 300 más recientes.

**GET `/:id`** devuelve además `locations: [{type,lat,lng,address,city,neighborhood}]` (todas las ubicaciones con su rol).

**POST `/`** (FormData): `type`, `title`, `description`, `lat?`, `lng?`, `addressText?`, `city?`, `neighborhood?` (legacy, ubicación única), `locations?` (JSON `[{type,lat,lng,addressText?,city?,neighborhood?}]`, preferido — multi-ubicación; al menos una válida), `helpTypeName?` (obligatorio para ambos tipos), `contactInfo?` (legacy), `contacts?` (JSON `[{type,value}]`, preferido — al menos un contacto válido), `supplies?` (JSON `[{name,targetQuantity?,unit?}]`, opcional — crea filas `PointSupply` con upsert del catálogo `Supply`), `expiresAt?`, `photos[]`.

## Moderator (`/api/moderator`)

Todas requieren `requireAuth` + `requireModerator`.

| Método | Path | Acción |
|---|---|---|
| GET | `/points/pending` | Cola de `offer_help` con `verificationStatus=pending` |
| POST | `/points/:id/approve` | Crea `Verification(approved)` + `verificationStatus=approved`, `status=active` |
| POST | `/points/:id/reject` | Crea `Verification(rejected,note?)` + `verificationStatus=rejected`, `status=rejected` |
| GET | `/requests` | Cola de solicitudes de moderador pendientes |
| POST | `/requests/:id/approve` | Aprueba + asciende a `moderator` (tx) |
| POST | `/requests/:id/reject` | Rechaza la solicitud |

## Estáticos (sin `/api`)

- `GET /uploads/*` → imágenes servidas desde `uploads/`.
- `GET /*` (no API, no uploads) → `client/dist/index.html` (SPA fallback en prod).

## Formato de errores

Todos los errores devuelven `{ "error": "mensaje" }` (en español). El wrapper del cliente los levanta como `ApiError` (ver [[Cliente HTTP (api)]]).

## Relacionado

- [[Autenticación JWT + cookies]]
- [[Middleware]]
- [[Flujo de creación de un Punto]]
- [[Flujo de moderación]]
- [[Modelo de datos]]
