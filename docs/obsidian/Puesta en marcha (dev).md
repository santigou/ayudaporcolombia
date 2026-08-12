---
tags: [operacion, dev, setup]
aliases: [Cómo correr, Setup local, Arranque]
tipo: howto
---

# Puesta en marcha (dev)

Pasos para correr el proyecto en local. Fuente: `README.md`.

## Requisitos

- **Node.js 20+**
- **Docker** (para Postgres) o un Postgres accesible.

## Pasos

1. **Copiar entorno**:
   ```bash
   cp .env.example server/.env
   ```
   Ajusta `JWT_SECRET`, `SEED_MODERATOR_PASSWORD`, etc. Ver [[Configuración de entorno]].

2. **Instalar dependencias** (workspaces npm):
   ```bash
   npm install
   ```

3. **Levantar Postgres**:
   ```bash
   docker compose up -d
   ```
   Expone en `localhost:5434` (ver [[Docker - Postgres]]).

4. **Migrar + sembrar primer moderador**:
   ```bash
   npm run prisma:migrate
   npm run seed
   ```
   El seed crea el moderador con las creds `SEED_MODERATOR_*`. Ver [[Seed del primer moderador]].

5. **Arrancar dev (cliente + servidor)**:
   ```bash
   npm run dev
   ```
   Usa `concurrently`. Logs prefijados `server` (azul) y `client` (verde).
   - Cliente: http://localhost:5173
   - API: http://localhost:4000

6. **Entrar**: loguearse en `/login` con el moderador sembrado para ver `/moderador`.

## Qué corre en dev

- **Vite** (cliente) en `:5173` con HMR, hace proxy de `/api` y `/uploads` al `:4000`.
- **tsx watch** (servidor) reinicia al cambiar `server/src/**`.
- **Prisma Client** se genera con `prisma:migrate`/`prisma:generate`. Si cambias el schema, vuelve a migrar.

> [!warning] Schema divergente
> Si corres `prisma:migrate dev` hoy con el `schema.prisma` rediseñado, intentará crear la nueva estructura. Ver [[Estado del proyecto y divergencias]] antes.

## Relacionado

- [[Docker - Postgres]]
- [[Configuración de entorno]]
- [[Seed del primer moderador]]
- [[Build y producción]]
