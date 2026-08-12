---
tags: [frontend, geocoding, nominatim]
aliases: [AddressSearch, Nominatim, Geocoding]
tipo: referencia
---

# Búsqueda de direcciones

Implementada en `client/src/components/AddressSearch.tsx`. Permite buscar una dirección para marcarla en el mapa al crear un punto.

## Cómo funciona

- Llama **directamente desde el navegador** a la API pública de Nominatim (OpenStreetMap).
- URL: `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=co&q=...`
- Devuelve hasta 5 resultados para Colombia, con `lat`, `lon` y `display_name`.
- Al elegir un resultado, `onSelect({ lat, lng, label, city?, neighborhood? })` setea ubicación, hace `flyTo` y rellena `addressText`/ciudad/barrio de la ubicación activa.

## Geocoding inverso (click en el mapa)

- Función exportada `reverseGeocode(lat, lng)` en el mismo archivo.
- URL: `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=...&lon=...`
- Al hacer click en el mapa en `CreatePoint`, se llama para **rellenar automáticamente** la dirección, ciudad y barrio de la ubicación activa (muestra "Obteniendo dirección…").
- Maneja race conditions con un ref contador: si el usuario hace otro click antes, se descarta la respuesta vieja. Si Nominatim no devuelve dirección, los campos quedan vacíos (no bloquea).
- **Etiqueta concisa**: para el click se arma `"<calle>, <barrio>"` (p. ej. "Calle 12, Buenos Aires Alto") en vez del `display_name` saturado con nombres de POIs. La búsqueda por texto sigue mostrando el nombre completo al elegir resultados.
- **Detección de ciudad (ajuste para Colombia)**: OSM modela el casco urbano como `"Perímetro Urbano X"` en el campo `city` (a veces sin `county` que lo respalde). `pickCity()` **quita el prefijo** `"Perímetro Urbano "` → "Medellín", "Armenia". Orden de campos: `city → town → village → municipality → county`.
- **Barrio con contexto (comuna + barrio)**: `pickNeighborhood()` combina `suburb - neighbourhood`, p. ej. *"Comuna 7 - Robledo - López de Mesa"*. Si solo hay uno, lo usa. Fallbacks: `quarter → borough → city_district → hamlet`.
- **Dirección según el tipo de lugar**: si el click cae sobre un POI (`amenity`: hospital, colegio…), `reverseLabel()` arma `"<calle> - <amenity>"` (p. ej. *"Carrera 65 - Unidad Intermedia de Castilla"*). Si no, `"<calle>, <barrio>"`.

## Consideraciones

> [!warning] Política de uso de Nominatim
> Nominatim tiene una política de uso estricta (≤ 1 req/seg, con User-Agent identificable). Llamarlo desde el navegador de cada usuario **distribuye** las llamadas (cada IP es distinta), pero:
> - No se envía `User-Agent` personalizado (el navegador manda el suyo).
> - En producción con mucho tráfico podrías exceder límites o ser bloqueado.
> - Para escala, conviene un proxy propio o un proveedor de geocoding. Ver [[Backlog]].

## Limitaciones actuales

- **Sin debounce**: solo busca al presionar Enter o click en "Buscar".
- **Solo creación**: la búsqueda NO aparece en el `Home` (solo en `CreatePoint`).

## En el flujo

Ver [[Flujo de creación de un Punto]] y [[Mapa interactivo]].

## Relacionado

- [[Decisiones de diseño]]
- [[Objetivos y restricciones]]
