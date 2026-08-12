---
tags: [frontend, rutas, react-router]
aliases: [Rutas SPA, Pages]
tipo: referencia
---

# Páginas y rutas (React Router)

Definidas en `client/src/App.tsx`. Router en `main.tsx` con `BrowserRouter`.

## Rutas

| Path | Componente | Acceso |
|---|---|---|
| `/` | `Home` | público — mapa + filtros + lista/detalle |
| `/crear` | `CreatePoint` | requiere login (redirige a `/login` si no) |
| `/login` | `Login` | público |
| `/registro` | `Register` | público |
| `/moderador` | `ModeratorDashboard` | solo `role=moderator` (verifica cliente + backend) |

## Navbar

- Visible siempre. Muestra:
  - Link a "Ayuda por Colombia" (home).
  - "Moderación" **solo** si `user.role === "moderator"`.
  - Si logueado: email + "Salir".
  - Si no: "Entrar" + "Registrarse".

## Layout

- `<div className="flex flex-col h-full">` con `<Navbar />` y un contenedor `flex-1 overflow-hidden`.
- `Home` y `CreatePoint` usan `h-[calc(100vh-56px)]` (la navbar mide 56px = `h-14`).
- En móvil: layout vertical (mapa arriba, panel abajo). En md+: mapa a la izquierda + panel lateral derecho.

## Sin rutas protegidas reales

No hay `<PrivateRoute>` ni `loader` que impida cargar `/crear` o `/moderador` si no hay sesión. La protección es:
- `CreatePoint` se carga siempre; solo bloquea la publicación de `offer_help` sin sesión (aviso + botón a `/login`). `need_help` puede crearse anónimamente.
- `ModeratorDashboard` muestra mensaje si `role !== moderator`.
- El **backend** deniega la acción real → es la fuente de verdad.

## Relacionado

- [[Componentes del cliente]]
- [[AuthContext y estado de sesión]]
