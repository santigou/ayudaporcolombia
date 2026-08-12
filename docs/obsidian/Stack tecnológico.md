---
tags: [stack, tecnologia]
aliases: [Tecnologías, Dependencies]
tipo: referencia
---

# Stack tecnológico

## Backend (`server/`)

| Tech | Versión | Uso |
|---|---|---|
| **Node.js** | 20+ (requisito) | runtime |
| **TypeScript** | ^5.6 | lenguaje |
| **Express** | ^4.21 | framework HTTP |
| **Prisma** + `@prisma/client` | ^5.20 | ORM |
| **PostgreSQL** | 16 (docker) | base de datos |
| **bcryptjs** | ^2.4.3 | hash de contraseñas |
| **jsonwebtoken** | ^9.0.2 | JWT de sesión |
| **cookie-parser** | ^1.4.6 | leer cookie `token` |
| **cors** | ^2.8.5 | CORS con credenciales |
| **multer** | ^2.2.0 | subida de fotos |
| **zod** | ^3.23.8 | validación de input |
| **dotenv** | ^16.4.5 | variables de entorno |
| **tsx** | ^4.19 | dev (run TS directo, watch) |

> [!info] Módulos ES
> El server usa `"type": "module"` y `module: NodeNext` en tsconfig → los imports internos llevan extensión `.js` aunque el fuente sea `.ts`.

## Frontend (`client/`)

| Tech | Versión | Uso |
|---|---|---|
| **React** | ^18.3 | UI |
| **React Router DOM** | ^6.30 | rutas SPA |
| **MapLibre GL JS** | ^4.7.1 | mapa |
| **Vite** | ^5.4 | bundler + dev server |
| **Tailwind CSS** | ^3.4 | estilos |
| **TypeScript** | ^5.6 | lenguaje |

## Externos (sin auth, gratis)

| Servicio | Uso |
|---|---|
| **OpenFreeMap** (`tiles.openfreemap.org`) | estilo `positron` + tiles del mapa |
| **Nominatim / OpenStreetMap** | geocoding (búsqueda de direcciones, `countrycodes=co`) |

## Infra / tooling

- **Docker Compose** → solo Postgres por ahora (`postgres:16-alpine`).
- **npm workspaces** → monorepo con `server` y `client`.
- **concurrently** → correr dev de ambos en paralelo.

> [!warning] Gestor de paquetes mezclado
> Existen `client/pnpm-lock.yaml` y `client/pnpm-workspace.yaml` sin trackear. Si se usa pnpm dentro del cliente, los `lockfiles` del root (`package-lock.json`) pueden desincronizarse. Definir uno solo.

## Relacionado

- [[Arquitectura general]]
- [[Configuración de entorno]]
- [[Decisiones de diseño]]
