---
tags: [proyecto, estado, divergencia, importante]
aliases: [Discrepancia schema, Estado actual, Lo implementado vs lo diseñado]
tipo: referencia
---

# Estado del proyecto y divergencias

> [!danger] Lo más importante de esta base de conocimiento
> Existe una **divergencia mayor** entre el `schema.prisma` actual y el código que realmente funciona. Entender esto antes de tocar nada.

## Estado real (lo que corre hoy)

El código funcionando usa un **modelo simple** de `Point` con campos directos:

```
Point { id, type, title, description,
        lat, lng, addressText, category,
        photos[], contactInfo, verificationCode,
        status, createdById, reviewedById, reviewedAt }
```

- Enum `PointType`: `ayuda | necesita_ayuda`
- Enum `PointCategory`: `refugio | alimentos | agua | medico | otro`
- Enum `PointStatus`: `pending | approved | rejected | active | resolved`
- Migración: `20260811160618_init` (coincide con este modelo).
- Routes, tipos TS del cliente y migración están alineados con este modelo.

Ver [[Modelo de datos (actual)]].

## Estado del schema.prisma (rediseño pendiente)

El archivo `server/prisma/schema.prisma` **fue reescrito** a un modelo mucho más rico, pero:

- ❌ **No hay migración SQL** que lo cree (la única migración es la *init* del modelo simple).
- ❌ **El código (rutas, tipos, cliente) no lo usa**: se rompería si se generara el client y se corriera.
- ❌ **Enums distintos**: cambia nombres y valores (ej. `PointType` pasa a `need_help | offer_help`, `PointStatus` añade `expired` y `cancelled`, etc.).

Introduce muchos modelos nuevos: `HelpType`, `Location`, `PointLocation`, `Supply`, `PointSupply`, `Contact`, `Validation`, `Verification`, `PointUpdate`, `Attachment`. Ver [[Modelo de datos (rediseño pendiente)]].

## Mapa de cambios del schema

| Aspecto | Modelo actual (funciona) | Rediseño (pendiente) |
|---|---|---|
| Coordenadas | `lat`, `lng` en `Point` | Tabla `Location` separada con `PointLocation` (rol: `location`/`origin`/`destination`) |
| Categoría | enum `PointCategory` | Tabla `HelpType` (nombre + descripción) |
| Fotos | `photos TEXT[]` | Tabla `Attachment` (image/video/document, con URL) |
| Contacto | `contactInfo TEXT` | Tabla `Contact` (phone/whatsapp/instagram/email/other) |
| Verificación | `verificationCode` + `reviewedById` | Tabla `Verification` (historial por moderador) + `VerificationStatus` en el punto |
| Suministros | (no existe) | Tabla `Supply` + `PointSupply` (cantidad objetivo/recibida, unidad) |
| Validaciones | (no existe) | Tabla `Validation` (usuarios confirman/rechazan un punto) |
| Actualizaciones | (no existe) | Tabla `PointUpdate` (mensajes tipo timeline) |
| User.name / contactInfo | Sí, en `User` | **No** están en el nuevo schema (faltan) |
| `PointType` | `ayuda / necesita_ayuda` | `need_help / offer_help` |

> [!warning] El rediseño rompe cosas existentes
> El nuevo schema **elimina** `name` y `contactInfo` de `User`, que el código de auth usa hoy (`register`, `/auth/me`). Una migración a ciegas rompería login/registro.

## Hipótesis del rediseño

Parece orientado a un **sistema de ayuda más estructurado y colaborativo**: múltiples ubicaciones por punto (origen/destino para transporte), catálogo de tipos de ayuda configurables, inventario de suministros con cantidades, historial de verificaciones, validaciones comunitarias y timeline de actualizaciones. Es decir, pasar de "mapa de puntos" a **plataforma logística de ayuda**.

## Recomendación

Antes de usar el schema nuevo:

1. Decidir si se adopta (es un cambio de producto, no solo técnico).
2. Generar migración con `prisma migrate dev` sobre un DB de prueba.
3. Ajustar **todo** el backend (routes, middleware, libs, seed) y el frontend (types, componentes, páginas).
4. Migrar datos si ya hay producción.

Ver [[Backlog]] para sumarlo como tarea.

## Estado del git

- 1 solo commit (`2b92164 Primer commit`), rama `main`.
- Cambios sin commitear: `schema.prisma` (el rediseño), `package-lock.json`.
- Archivos sin trackear: `client/pnpm-lock.yaml`, `client/pnpm-workspace.yaml` (hay un workspace pnpm dentro del workspace npm — posible inconsistencia de gestores de paquetes).

## Relacionado

- [[Modelo de datos (actual)]]
- [[Modelo de datos (rediseño pendiente)]]
- [[Estados y ciclos de vida de un Punto]]
- [[Backlog]]
