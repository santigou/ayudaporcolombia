---
tags: [api, endpoints, backend]
aliases: [Rutas, API, Endpoints]
tipo: referencia
---

# API REST — endpoints

Catálogo completo de rutas del backend. Prefijo `/api`. Base URL: `http://localhost:4000` (dev) o mismo origen (prod).

## Auth (`/api/auth`)

| Método | Path | Auth | Body | Devuelve |
|---|---|---|---|---|
| POST | `/register` | — | `{name,email,password,contactInfo?,wantsModerator?}` | `201 {id,name,email,role}` + cookie |
| POST | `/login` | — | `{email,password}` | `200 user` + cookie |
| POST | `/logout` | — | — | `204`, limpia cookie |
| GET | `/me` | ✅ | — | `user` (con `moderatorRequest.status`) |

Validaciones (zod): `register` → name 2-100, email, password 8-100. `login` → email + password mínima.

## Points (`/api/points`)

| Método | Path | Auth | Notas |
|---|---|---|---|
| GET | `/` | — | Lista pública. Query: `type`, `category`. Filtra por [[Estados y ciclos de vida de un Punto#Visibilidad|estados públicos]]. |
| GET | `/:id` | — | Detalle si el punto es visible públicamente; si no, 404. |
| POST | `/` | ✅ | Crea punto. `multipart/form-data` con fotos (max 5). Ver [[Flujo de creación de un Punto]]. |

> [!info] El GET `/` selecciona solo campos públicos
> `select: { id, type, title, description, lat, lng, addressText, category, photos, status, createdAt }` — **no** devuelve `contactInfo`, `verificationCode`, ni datos del creador al público. El detalle (`GET /:id`) sí devuelve todo el registro (incluido contacto) — revisar si eso es intencional.

## Moderator (`/api/moderator`)

Todas requieren `requireAuth` + `requireModerator`.

| Método | Path | Acción |
|---|---|---|
| GET | `/points/pending` | Cola de puntos `ayuda+pending` (incluye `createdBy`) |
| POST | `/points/:id/approve` | Aprueba → `status=approved` |
| POST | `/points/:id/reject` | Rechaza → `status=rejected` |
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
