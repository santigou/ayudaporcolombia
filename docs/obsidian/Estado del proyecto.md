---
tags: [proyecto, estado]
aliases: [Estado actual, Estado del proyecto]
tipo: referencia
---

# Estado del proyecto

> [!info] Estado actual
> El proyecto corre con el **modelo rico** (plataforma de ayuda estructurada). El antiguo modelo simple "mapa de puntos" **ya no existe**: la base de datos se migró a cero y el backend + frontend se reescribieron contra el modelo nuevo.

## Qué está implementado

- **Base de datos**: migración `20260812160000_init` crea las 13 tablas del modelo rico (ver [[Modelo de datos]]). `prisma migrate status` → *up to date*.
- **Backend** (`server/`): Express + Prisma, compila limpio (`tsc` = 0 errores). Endpoints de auth, points y moderator adaptados al modelo nuevo. Seed del moderador verificado.
- **Frontend** (`client/`): React + Vite, compila limpio. Tipos, AuthContext, mapa, formularios y panel de moderación reescritos contra la nueva API.
- **Postgres**: corriendo en Docker (`ayudaporcolombia-postgres-1`, puerto `5434`).

## Qué cambió respecto al modelo anterior

Antes existía una **divergencia**: el `schema.prisma` contenía el rediseño pero la migración y el código usaban el modelo simple. Esa divergencia **se resolvió** adoptando el rediseño:

- `PointType`: `ayuda`/`necesita_ayuda` → `offer_help`/`need_help`.
- Coordenadas, fotos, contacto y categoría salieron de `Point` a tablas (`Location`/`Attachment`/`Contact`/`HelpType`).
- La verificación pasó de un campo `verificationCode` a una tabla `Verification` (historial) + `verificationStatus`.
- `User` perdió `name` y `contactInfo`.
- La API normaliza el modelo rico a shapes simples en los endpoints públicos (ver [[API REST - endpoints]]).

## Estado del git

- 1 commit histórico (`2b92164 Primer commit`) + cambios sin commitear tras el rediseño: `server/prisma/*`, `server/src/*`, `client/src/*` y estos docs.
- Archivos sueltos sin trackear: `client/pnpm-lock.yaml`, `client/pnpm-workspace.yaml` (gestor de paquetes mezclado, ver [[Stack tecnológico]]).

## Relacionado

- [[Modelo de datos]]
- [[Decisiones de diseño]]
- [[Backlog]]
- [[Seguridad y consideraciones]]
