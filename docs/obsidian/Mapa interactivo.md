---
tags: [frontend, mapa, maplibre]
aliases: [MapLibre, OpenFreeMap, MapView]
tipo: referencia
---

# Mapa interactivo

El corazón visual del producto. Implementado en `client/src/components/MapView.tsx`.

## Stack

- **MapLibre GL JS** v4 (libre, fork abierto de Mapbox GL).
- **Tiles + estilo**: OpenFreeMap, estilo `positron`.
  - URL: `https://tiles.openfreemap.org/styles/positron`
- **Centro por defecto**: Colombia `[-74.297, 4.5709]`, zoom 5.

## Modos

El componente `MapView` soporta dos modos por props:

1. **Lectura** (`Home.tsx`): muestra marcadores de todos los puntos, click abre detalle.
2. **Picker** (`CreatePoint.tsx`): `pickerMode` → click en el mapa setea ubicación; muestra un marcador blanco con borde verde.

## Marcadores

- Construidos a mano (`buildMarkerEl`) como `<div>` circulares.
- Color según tipo:
  - `ayuda` → verde `#1d6f5c`
  - `necesita_ayuda` → rojo `#dc2626`
- Marcador seleccionado: más grande (28px) y borde oscuro.
- Click en marcador → `onSelectPoint(point)` (detiene propagación).

## Ciclo de vida con `useRef`

El componente guarda en refs:
- `mapRef` → instancia del mapa (se crea/destruye una vez).
- `markersRef` → array de marcadores (se limpia y reconstruye al cambiar `points`).
- `pickerMarkerRef` → marcador del picker.
- Efectos separados para: init, click handler, render markers, picker marker, `flyTo`.

> [!warning] `flyTo` no se limpia en cleanup
> El efecto de `flyTo` no retorna cleanup, lo cual está bien (es un one-shot), pero conviene saberlo si se refactoriza.

## Dependencias externas

- Requiere conexión a internet para cargar tiles (no hay tileserver local).
- El CSS `maplibre-gl/dist/maplibre-gl.css` se importa en el componente.

## Relacionado

- [[Búsqueda de direcciones]]
- [[Flujo de creación de un Punto]]
- [[Componentes del cliente]]
- [[Decisiones de diseño]]
