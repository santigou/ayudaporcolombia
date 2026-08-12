---
tags: [frontend, componentes]
aliases: [Components]
tipo: referencia
---

# Componentes del cliente

Inventario de `client/src/components/`.

## `MapView.tsx`
Ver [[Mapa interactivo]]. MapLibre + marcadores. Dos modos: lectura y picker.

## `AddressSearch.tsx`
Ver [[Búsqueda de direcciones]]. Input + lista de resultados Nominatim.

## `FiltersBar.tsx`
Barra de filtros de `Home`:
- Botones de tipo: **Todos / Puntos de ayuda / Personas no ubicadas**.
- Si tipo = `ayuda`, aparece segunda fila con categorías (Todas + las 5).
- Cambiar tipo resetea categoría a "todas".

## `PointList.tsx`
Lista vertical de `PointCard` con scroll. Vacío → mensaje.

## `PointCard.tsx`
Botón-tarjeta con:
- Título (1 línea).
- Badge: categoría esmeralda (ayuda) o **"No verificado"** rojo (necesita_ayuda).
- Descripción (2 líneas).
- Dirección (si hay).
- Estado `selected` → borde y fondo de marca.

## `PointDetail.tsx`
Vista de detalle en el panel lateral:
- Botón "← Volver a la lista".
- Título.
- Para `necesita_ayuda`: caja roja con aviso de **no verificado** y recomendación de contactar autoridades.
- Para `ayuda` con categoría: badge esmeralda.
- Descripción (`whitespace-pre-wrap`).
- Dirección.
- Grilla de fotos (`<img>` de `point.photos`).

> [!warning] `PointDetail` no muestra contacto
> El listado público no incluye `contactInfo` (ver [[API REST - endpoints]]), pero `GET /:id` sí lo devuelve. `PointDetail` actualmente **no** lo muestra, aunque el tipo lo permite.

## Relacionado

- [[Páginas y rutas (React Router)]]
- [[Mapa interactivo]]
- [[Estilos - Tailwind]]
