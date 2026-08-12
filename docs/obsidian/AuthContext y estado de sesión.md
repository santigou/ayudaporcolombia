---
tags: [frontend, estado, auth]
aliases: [AuthProvider, useAuth, Sesión]
tipo: referencia
---

# AuthContext y estado de sesión

`client/src/context/AuthContext.tsx`. Provee el usuario actual a toda la app.

## API del contexto

```ts
useAuth() → {
  user: CurrentUser | null,
  loading: boolean,
  login(email, password),
  register({...}),
  logout(),
  refresh()
}
```

## Comportamiento

- Al montar (`AuthProvider`), ejecuta `refresh()` → `GET /api/auth/me` con cookie. Si 401 → `user = null`. Si ok → `user`. Setea `loading=false` al terminar.
- `login` / `register` llaman al endpoint, que devuelve el user y setea la cookie; guardan el user en estado.
- `logout` llama a `/auth/logout` (limpia cookie servidor) y setea `user = null`.

## Tipo `CurrentUser`

```ts
{ id, name, email, role, contactInfo?, moderatorRequest?: { status } }
```

- `moderatorRequest.status` → para saber si el usuario ya pidió ser moderador.

## Patrón de uso

```tsx
const { user, loading } = useAuth();
if (loading) return <Cargando/>;
if (!user) return <IrALogin/>;
```

## Por qué un contexto

Evita pasar el user por props y permite a cualquier componente (Navbar, CreatePoint, ModeratorDashboard) reaccionar a login/logout.

## Relacionado

- [[Autenticación JWT + cookies]]
- [[Cliente HTTP (api)]]
- [[Páginas y rutas (React Router)]]
