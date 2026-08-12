---
tags: [config, env, variables]
aliases: [.env, Variables de entorno]
tipo: referencia
---

# Configuración de entorno

Definidas en `.env.example`. **Se copia a `server/.env`** antes de arrancar (`cp .env.example server/.env`).

## Variables

| Variable | Default | Uso |
|---|---|---|
| `DATABASE_URL` | `postgresql://ayuda:ayuda@localhost:5434/ayudaporcolombia?schema=public` | Prisma. Puerto **5434** (mapeado en docker-compose). |
| `PORT` | `4000` | Escucha de Express (`index.ts`). |
| `JWT_SECRET` | (requerido) | Firma JWT. **Debe cambiarse** en producción. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Origen permitido en CORS (la URL del Vite dev). |
| `NODE_ENV` | — | Si `=production`, cookie va con `secure`. |
| `SEED_MODERATOR_NAME` | "Moderador Principal" | **Legacy**: queda en `.env` pero el seed actual **no lo usa** (el modelo de `User` no tiene `name`). |
| `SEED_MODERATOR_EMAIL` | `moderador@ayudaporcolombia.org` | Seed. |
| `SEED_MODERATOR_PASSWORD` | (requerido) | Seed. Cambiar en real. |

> [!danger] Secretos en `.env.example` son **placeholders**
> `JWT_SECRET` y `SEED_MODERATOR_PASSWORD` tienen valores de ejemplo inseguros. En producción **deben** ser secretos reales y `server/.env` **no** se commitea (`.gitignore` lo cubre: `.env`).

## Dónde se leen

- `dotenv/config` se importa al inicio de `index.ts` y `seed.ts`.
- Cada módulo lee `process.env.X` directo (sin validación centralizada con zod de entorno — oportunidad de mejora).

## Puerto 5434

El docker-compose mapea el **5434** del host al **5432** interno de Postgres. Esto evita chocar con un Postgres local que ya use 5432.

## Relacionado

- [[Autenticación JWT + cookies]]
- [[Docker - Postgres]]
- [[Puesta en marcha (dev)]]
- [[Seed del primer moderador]]
- [[Seguridad y consideraciones]]
