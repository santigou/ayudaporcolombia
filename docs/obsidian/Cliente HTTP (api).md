---
tags: [frontend, api, fetch]
aliases: [api client, ApiError]
tipo: referencia
---

# Cliente HTTP (api)

`client/src/api/client.ts`. Wrapper mínimo sobre `fetch`.

## Base

`const BASE = "/api"` → relativo. En dev, Vite hace proxy a `:4000` (ver `vite.config.ts`). En prod, mismo origen.

## `request<T>`

- Envía `credentials: "include"` → manda cookies.
- Si el body **no** es `FormData`, setea `Content-Type: application/json`.
- Si `FormData` (creación con fotos), **no** setea Content-Type (lo hace el navegador con boundary).
- Si `!res.ok` → lee JSON `{ error }`, lanza `ApiError(message, status)`.
- Si `204` → devuelve `undefined`.
- Sino → `res.json()`.

## Helper exportado

```ts
api.get<T>(path)
api.post<T>(path, body?)  // body puede ser FormData u objeto
```

> [!info] No hay PUT/PATCH/DELETE
> La API actual solo usa GET y POST. El wrapper no los expone, lo cual encaja con los endpoints existentes. Si se añaden en el futuro, habrá que extenderlo.

## `ApiError`

Subclase de `Error` con `status`. Usado por páginas para distinguir 401 de otros errores (ej. `AuthContext.refresh`).

## Relacionado

- [[API REST - endpoints]]
- [[AuthContext y estado de sesión]]
- [[Flujo de creación de un Punto]]
