---
tags: [frontend, componentes]
aliases: [Components]
tipo: referencia
---

# Componentes del cliente

Inventario de `client/src/components/`.

## `MapView.tsx`
Ver [[Mapa interactivo]]. MapLibre + marcadores. Dos modos: lectura y picker. Los marcadores se dibujan desde `point.location` (ver [[Modelo de datos]]); los puntos sin ubicación no se muestran.

## `AddressSearch.tsx`
Ver [[Búsqueda de direcciones]]. Input + lista de resultados Nominatim.

## `FiltersBar.tsx`
Barra de filtros de `Home`:
- Botones de tipo: **Todos / Puntos de ayuda / Personas no ubicadas** (`offer_help` / `need_help`).
- Si tipo = `offer_help`, aparece segunda fila con tipos de ayuda (`HELP_TYPES`: Todas + Refugio/Alimentos/Agua/Médico/Otro).
- Cambiar tipo resetea el filtro a "todas".
- El filtro por tipo de ayuda es **en el cliente** (el catálogo `HelpType` es libre).

## `PointList.tsx`
Lista vertical de `PointCard` con scroll. Vacío → mensaje.

## `PointCard.tsx`
Botón-tarjeta con:
- Título (1 línea).
- Badge: tipo de ayuda esmeralda (`offer_help`) o **"No verificado"** rojo (`need_help`).
- Descripción (2 líneas).
- Ubicación (`locationLabel`, si hay).
- Estado `selected` → borde y fondo de marca.

## `PointDetail.tsx`
Vista de detalle en el panel lateral:
- Botón "← Volver a la lista".
- Título.
- Para `need_help`: caja roja con aviso de **no verificado** y recomendación de contactar autoridades.
- Para `offer_help` con tipo de ayuda: badge esmeralda.
- Descripción (`whitespace-pre-wrap`).
- Ubicación.
- Grilla de fotos (`<img>` de `point.photos`).

## `types.ts`
Tipos del dominio frontend. Define `Point` (shape normalizado de la API: `location`, `photos`, `helpType`), `CurrentUser`, `HELP_TYPES` y el helper `locationLabel`.

## Relacionado

- [[Páginas y rutas (React Router)]]
- [[Mapa interactivo]]
- [[API REST - endpoints]]
- [[Estilos - Tailwind]]
