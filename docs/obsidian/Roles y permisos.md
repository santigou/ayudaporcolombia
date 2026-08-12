---
tags: [dominio, roles, authz]
aliases: [User, Moderator, Permisos, Authorization]
tipo: referencia
---

# Roles y permisos

## Roles

Solo dos (`enum Role`):

### `user` (default)
- Crearse cuenta (`POST /api/auth/register`).
- Opcionalmente solicitar ser moderador (`wantsModerator: true` al registro → crea `ModeratorRequest` pendiente).
- Crear puntos (`POST /api/points`) — ver [[Flujo de creación de un Punto]].
- Ver el mapa y los puntos públicos (sin login siquiera).

### `moderator`
- Todo lo de `user`.
- Ver panel `/moderador` y llamar endpoints bajo `/api/moderator/*`:
  - Listar y aprobar/rechazar puntos `ayuda` pendientes.
  - Listar y aprobar/rechazar solicitudes de moderador.
  - Al **aprobar una solicitud**, se asciende a ese usuario a `moderator` (transacción).

## Cómo se asigna el rol

1. **Seed**: el primer moderador se crea con `npm run seed` → `role: "moderator"` directo (ver [[Seed del primer moderador]]).
2. **Promoción por otro moderador**: `POST /api/moderator/requests/:id/approve` → en una `$transaction`, actualiza `ModeratorRequest` y el `User.role`.

## Aplicación de permisos (backend)

`middleware/auth.middleware.ts`:
- `requireAuth` → valida cookie JWT, setea `req.user = { userId, role }`. Si no → 401.
- `requireModerator` → comprueba `req.user.role === "moderator"`. Si no → 403.
- `attachUserIfPresent` → opcional, no falla si no hay sesión (definido pero no se usa en rutas actualmente).

El router `moderatorRouter` aplica `requireAuth` + `requireModerator` a **todo** con `moderatorRouter.use(...)`.

## Aplicación de permisos (frontend)

- El link a `/moderador` solo se muestra si `user.role === "moderator"` (Navbar).
- `ModeratorDashboard` comprueba rol y muestra mensaje si no aplica. **No es seguridad real**: el backend sigue siendo la fuente de verdad.

## En el rediseño

Los roles se mantienen (`user`, `moderator`) — ver [[Modelo de datos (rediseño pendiente)]]. No se planea un rol `admin`.

## Relacionado

- [[Autenticación JWT + cookies]]
- [[Middleware]]
- [[Flujo de moderación]]
- [[Seguridad y consideraciones]]
