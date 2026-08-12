---
tags: [dominio, tipo-punto]
aliases: [ayuda, necesita_ayuda, Tipos de punto, PuntoType]
tipo: referencia
---

# Tipos de Punto: ayuda vs necesita_ayuda

La distinción central del producto. Un `Point` tiene un `type` que **cambia todo su comportamiento**.

## Comparación

| Aspecto | `ayuda` | `necesita_ayuda` |
|---|---|---|
| Qué representa | Un recurso/oferta (refugio, comida, agua, médico) | Una persona no ubicada / desaparecida |
| Estado inicial | `pending` | `active` (inmediato) |
| ¿Moderación previa? | ✅ Sí, obligatoria | ❌ No |
| `category` | Requerida (`refugio/alimentos/agua/medico/otro`) | Ignorada (se guarda `null`) |
| `verificationCode` | Generado (6 chars) | No |
| Visible públicamente si | `status=approved` | `status∈{active,resolved}` |
| Color del marcador | Verde `#1d6f5c` | Rojo `#dc2626` |
| Badge en la UI | Categoría (esmeralda) | **"No verificado"** (rojo) |
| Mensaje post-creación | "Enviado a revisión, tu código es..." | "Ya visible, marcado como no verificado" |

## Por qué esta división

Una persona desaparecida es urgente: la velocidad importa más que la verificación. Un falso refugio es peligroso: la verificación importa más que la velocidad. Ver [[Visión general del proyecto]].

## Implementación

- **Backend**: `points.routes.ts` → `createSchema` con `z.enum(["ayuda","necesita_ayuda"])`, y la rama `isAyuda = data.type === "ayuda"` decide `status`, `verificationCode` y `category`.
- **Frontend**: [[CreatePoint]] tiene dos botones que cambian el tipo y, según el tipo, muestra/oculta campos y avisos.

> [!warning] Validación de categoría
> El backend exige `category` **solo si** `type=ayuda`. Si mandas `category` con `necesita_ayuda`, se guarda `null` (no error).

## En el rediseño

> [!info] Cambio de nombres planeado
> El [[Modelo de datos (rediseño pendiente)]] renombra los valores a `need_help` y `offer_help`. Es decir, **invierte la nomenclatura** respecto a hoy: lo que hoy es `ayuda` pasaría a `offer_help`, y `necesita_ayuda` a `need_help`. Ojo al migrar.

## Relacionado

- [[Estados y ciclos de vida de un Punto]]
- [[Sistema de verificación y código]]
- [[Flujo de creación de un Punto]]
