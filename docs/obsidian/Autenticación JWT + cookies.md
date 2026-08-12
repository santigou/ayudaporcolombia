---
tags: [backend, auth, jwt, cookies]
aliases: [JWT, Cookies de sesión, Auth]
tipo: referencia
---

# Autenticación JWT + cookies

## Resumen

- El login/register firma un **JWT** con `userId` + `role` y lo setea en una cookie **httpOnly** llamada `token`.
- En cada request, el navegador envía la cookie automáticamente (`credentials: "include"` en el fetch).
- El middleware `requireAuth` la verifica y pobla `req.user`.

## Detalle del token (`lib/jwt.ts`)

```ts
signToken({ userId, role }) → jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" })
verifyToken(token)          → jwt.verify → { userId, role }
```

- `JWT_SECRET` **obligatorio** — si falta, el módulo lanza al importar (fail-fast).
- Expira en **7 días**.
- Payload: `{ userId, role: "user" | "moderator" }`.

## Cookie (`auth.routes.ts`)

```ts
COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax", secure: isProd, maxAge: 7 días }
```

- `httpOnly`: no accesible por JS del navegador → protege de XSS robar token.
- `sameSite: "lax"`: mitiga CSRF básico.
- `secure`: solo HTTPS en producción (`NODE_ENV=production`).
- `logout` limpia la cookie con las mismas opciones.

## CORS

```ts
cors({ origin: CLIENT_ORIGIN ?? "http://localhost:5173", credentials: true })
```

- Origen limitado a `CLIENT_ORIGIN` — necesario para que el navegador envíe la cookie cross-origin.
- `credentials: true` obligatorio para cookies.

## Por qué cookies y no localStorage

- localStorage es **accesible por JS** → vulnerable a XSS.
- Cookie httpOnly + `sameSite` es el patrón más seguro para SPAs.
- Consecuencia: el cliente **no** maneja el token, solo llama `/auth/me` al arrancar (ver [[AuthContext y estado de sesión]]).

## Riesgo CSRF

`sameSite: "lax"` bloquea la mayoría de CSRF. Para endpoints que mutan estado desde un GET malicioso sería un problema, pero todas las mutaciones son POST y `lax` las protege. No hay token CSRF adicional.

## Relacionado

- [[Middleware]]
- [[AuthContext y estado de sesión]]
- [[Roles y permisos]]
- [[Seguridad y consideraciones]]
- [[Configuración de entorno]]
