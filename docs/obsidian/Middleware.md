---
tags: [backend, middleware]
aliases: [Middlewares]
tipo: referencia
---

# Middleware

## `auth.middleware.ts`

| Función | Qué hace | Falla con |
|---|---|---|
| `requireAuth` | Lee `req.cookies.token`, verifica JWT, setea `req.user`. | 401 si no hay token o es inválido. |
| `requireModerator` | Comprueba `req.user.role === "moderator"` (requiere `requireAuth` antes). | 403 si no es moderador. |
| `attachUserIfPresent` | Como `requireAuth` pero **no falla** si no hay sesión (deja anónimo). | (no se usa hoy) |

Declara `Express.Request.user?: TokenPayload` globalmente.

## `upload.middleware.ts`

Exporta `upload` (instancia de multer):

| Setting | Valor |
|---|---|
| `destination` | `process.cwd()/uploads` |
| `filename` | `<uuid><ext>` |
| `fileSize` | 5 MB |
| `files` | 5 |
| `fileFilter` | solo JPEG/PNG/WebP/GIF |

Ver [[Subida de fotos]].

## Built-in (en `app.ts`)

| Middleware | Uso |
|---|---|
| `cors` | CORS con `credentials` |
| `express.json()` | parseo de JSON body |
| `cookieParser` | leer `req.cookies.token` |
| `express.static("/uploads")` | servir imágenes |
| `express.static(clientDist)` | servir SPA (prod) |
| handler SPA fallback | regex `^(?!\/api|\/uploads).*` → `index.html` |
| error handler (final) | log + `{ error }` 500 |

## Orden importa

cors → json → cookieParser → uploads estáticos → routers (/api/...) → estáticos del cliente → SPA fallback → error handler. Cualquier router o estático declarado **después** del SPA fallback sería inalcanzable.

## Relacionado

- [[Autenticación JWT + cookies]]
- [[Subida de fotos]]
- [[Arquitectura general]]
- [[API REST - endpoints]]
