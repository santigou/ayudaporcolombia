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
- Al elegir un resultado, `onSelect({ lat, lng, label })` setea ubicación, hace `flyTo` y rellena `addressText`.

## Consideraciones

> [!warning] Política de uso de Nominatim
> Nominatim tiene una política de uso estricta (≤ 1 req/seg, con User-Agent identificable). Llamarlo desde el navegador de cada usuario **distribuye** las llamadas (cada IP es distinta), pero:
> - No se envía `User-Agent` personalizado (el navegador manda el suyo).
> - En producción con mucho tráfico podrías exceder límites o ser bloqueado.
> - Para escala, conviene un proxy propio o un proveedor de geocoding. Ver [[Backlog]].

## Limitaciones actuales

- **Sin debounce**: solo busca al presionar Enter o click en "Buscar".
- **Sin geocoding inverso**: no se obtiene dirección desde un punto en el mapa.
- **Solo creación**: la búsqueda NO aparece en el `Home` (solo en `CreatePoint`).

## En el flujo

Ver [[Flujo de creación de un Punto]] y [[Mapa interactivo]].

## Relacionado

- [[Decisiones de diseño]]
- [[Objetivos y restricciones]]
