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

1. **Lectura** (`Home.tsx`): muestra marcadores de los puntos **de la zona visible**. Al cargar, `GeolocateControl.trigger()` pide permiso automáticamente; si se concede, centra en el usuario y muestra el **punto azul** (`showUserLocation`), con zoom máximo 11 (~50 km). Si se rechaza, queda en **Medellín** (zoom 11). El botón 🎯 permite recentrar manualmente. Al mover/zoom, emite `onBoundsChange(bbox)` (con **debounce ~400 ms** e ignorando movimientos diminutos) para que `Home` recargue solo los puntos del rectángulo visible.
2. **Picker** (`CreatePoint.tsx`): `pickerMode` → soporta **varias ubicaciones**. Hay una lista de ubicaciones (cada una con rol `location`/`origin`/`destination`); el botón ✎ marca la *activa* y los clics en el mapa (o la búsqueda) la mueven. Se ven varios marcadores, coloreados por tipo (ubicación=verde, origen=azul, destino=ámbar); el activo se resalta (más grande, anillo oscuro).

## Carga por zona (bounding box)

- El listado `GET /points` acepta `minLat/maxLat/minLng/maxLng`. El backend solo devuelve puntos con alguna ubicación dentro de ese rectángulo, con un **cap de 300** (`truncated: true` si hay más → la UI pide acercarse).
- Así el mapa carga solo lo visible → peticiones ligeras que escalan al crecer el número de puntos. No hay "X peticiones" troceadas: una sola consulta por zona, con índice.

## Marcadores y clustering

- **Modo lectura (clustering nativo de MapLibre)**: cada **ubicación** es un feature de un source GeoJSON con `cluster: true` (`clusterMaxZoom: 16`, `clusterRadius: 60`). Así:
  - Al alejar el zoom, las ubicaciones (incluidas las de un mismo punto) se **agrupan** en un círculo verde.
  - Click en un grupo → `getClusterExpansionZoom` + `easeTo`: hace zoom hasta que se separan.
  - Ubicaciones individuales: círculos coloreados por tipo (verde `offer_help`, rojo `need_help`), con borde blanco.
  - Punto seleccionado: anillo oscuro (capa `selected-point` con filtro dinámico por `id`).
  - **Conteo híbrido del número**: la primera ubicación de cada punto se marca `isPrimary` y el cluster calcula `pointsCount = nº de primaries = nº de puntos originales`. La etiqueta muestra: **nº de ubicaciones** (`point_count`) si el cluster agrupa un solo punto (sus semi-puntos); **nº de puntos** (`pointsCount`, sin contar semi-puntos) si agrupa varios puntos.
- **Puntos con varias ubicaciones**: cada ubicación es un punto del source, así que se ven y clusterizan como cualquier otra. Al **seleccionar** un punto con varias ubicaciones, sus ubicaciones salen del source y se muestran como **sub-marcadores numerados** (1, 2, 3…), y el mapa hace `fitBounds` para verlas todas a la vez.
- **Picker (creación)**: marcadores `<div>` circulares manuales (`buildPickerMarkerEl`), numerados por orden, coloreados por rol (ubicación=verde, origen=azul, destino=ámbar); el activo se resalta (más grande, anillo oscuro).
- Color según tipo: `offer_help` → verde `#1d6f5c`, `need_help` → rojo `#dc2626`.

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
