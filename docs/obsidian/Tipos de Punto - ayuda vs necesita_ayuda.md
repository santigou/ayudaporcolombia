---
tags: [dominio, tipo-punto]
aliases: [offer_help, need_help, Tipos de punto, PuntoType]
tipo: referencia
---

# Tipos de Punto: offer_help vs need_help

La distinción central del producto. Un `Point` tiene un `type` que **cambia todo su comportamiento**.

## Comparación

| Aspecto | `offer_help` | `need_help` |
|---|---|---|
| Qué representa | Un recurso/oferta (refugio, comida, agua, médico) | Una persona no ubicada / desaparecida |
| Estado inicial | `pending` (`verificationStatus=pending`) | `active` (inmediato) |
| ¿Moderación previa? | ✅ Sí, obligatoria | ❌ No |
| ¿Requiere cuenta? | ✅ Sí (trazabilidad) | ❌ No (puede ser anónimo) |
| `helpType` | Requerido (refugio/alimentos/agua/médico/otro) | Requerido (mismo catálogo) |
| Visible públicamente si | `verificationStatus = approved` | `status ∈ {active, resolved}` |
| Color del marcador | Verde `#1d6f5c` | Rojo `#dc2626` |
| Badge en la UI | Tipo de ayuda (esmeralda) | **"No verificado"** (rojo) |
| Mensaje post-creación | "Enviado a revisión" | "Ya visible, marcado como no verificado" |

## Por qué esta división

Una persona desaparecida es urgente: la velocidad importa más que la verificación. Un falso refugio es peligroso: la verificación importa más que la velocidad. Ver [[Visión general del proyecto]].

## Implementación

- **Backend**: `points.routes.ts` usa `attachUserIfPresent` (sesión opcional). `createSchema` con `z.enum(["need_help","offer_help"])`; la rama `isOffer = data.type === "offer_help"` decide `status` (`pending` vs `active`). `helpTypeName` es **obligatorio para ambos tipos** (400 si falta); la sesión solo es obligatoria para `offer_help` (401 si falta). `need_help` puede crearse anónimo (`createdById = null`).
- **Frontend**: `/crear` es un **asistente por pasos** sobre un mapa a pantalla completa (drawer inferior en móvil, panel lateral derecho en desktop). Si es `offer_help` sin sesión, bloquea la publicación y ofrece iniciar sesión. `need_help` se publica con o sin sesión. Soporta **varias ubicaciones** por punto (rol `location`/`origin`/`destination`) en un acordeón. Ver [[Componentes del cliente]].

> [!info] Nomenclatura actual
> Antes los valores eran `ayuda` / `necesita_ayuda`. Se renombraron a `offer_help` (era `ayuda`) y `need_help` (era `necesita_ayuda`). Ver [[Modelo de datos]].

## Relacionado

- [[Modelo de datos]]
- [[Estados y ciclos de vida de un Punto]]
- [[Flujo de creación de un Punto]]
- [[Flujo de moderación]]
