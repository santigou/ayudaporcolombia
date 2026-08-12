---
tags: [decisiones, adrs, diseño]
aliases: [ADRs, Por qué cada cosa]
tipo: referencia
---

# Decisiones de diseño

Racional de las elecciones técnicas principales. No son ADRs formales, pero capturan el *por qué*.

## Monolito, no microservicios

- Proyecto chico, equipo chico, servidor casero. Un proceso Express que sirve API + estáticos + SPA es lo más simple de operar. Ver [[Arquitectura general]].

## Modelo dual de puntos (offer_help vs need_help)

- Resuelve el trade-off velocidad vs confiabilidad. Ver [[Visión general del proyecto]] y [[Tipos de Punto - ayuda vs necesita_ayuda]].

## Cookies httpOnly + JWT, no localStorage

- Protege el token de XSS. El cliente nunca lo toca. Ver [[Autenticación JWT + cookies]].

## Postgres + Prisma

- Postgres es robusto, gratis, y soporta enums y tipos ricos. Prisma da tipado + migraciones. Ver [[Modelo de datos]].

## MapLibre + OpenFreeMap (no Mapbox/Google)

- Sin API keys, sin cuota, sin costo. Suficiente para un mapa de puntos. Ver [[Mapa interactivo]].

## Nominatim directo desde el navegador

- Sin backend de geocoding que mantener. Apto para volumen bajo. Ver [[Búsqueda de direcciones]].

## npm workspaces

- Monorepo simple con dos paquetes (`server`, `client`) sin overhead de herramientas tipo Turborepo/Nx.

## TypeScript estricto + zod en backend

- `strict: true` en tsconfig y validación zod en cada endpoint → errores en compile y en runtime controlados.

## Multer a disco local

- Simple y suficiente al inicio. Migrar a nube cuando el volumen lo pida (declarado). Ver [[Subida de fotos]].

## Primera cuenta moderadora por seed

- Sin UI de admin bootstrap. Una sola vez, controlado. Ver [[Seed del primer moderador]].

## Plataforma de ayuda estructurada (modelo rico)

- El modelo evolucionó de "mapa de puntos simple" (coordenadas y fotos directas en `Point`) a una **plataforma logística**: ubicaciones múltiples con rol (`Location`/`PointLocation`), catálogos (`HelpType`, `Supply`), contactos tipados (`Contact`), adjuntos multimedia (`Attachment`), verificación con historial (`Verification`) y trazabilidad (`PointUpdate`). **Ya está migrado e implementado**. Ver [[Modelo de datos]] y [[Estado del proyecto]].

## API normaliza el modelo rico

- Para no exponer la complejidad del modelo al frontend, los endpoints públicos devuelven shapes simples (`location:{lat,lng}`, `photos:string[]`). El modelo rico vive en la DB; la API es la frontera. Ver [[API REST - endpoints]].

## Relacionado

- [[Objetivos y restricciones]]
- [[Estado del proyecto]]
- [[Stack tecnológico]]
