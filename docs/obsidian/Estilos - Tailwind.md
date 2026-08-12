---
tags: [frontend, estilos, tailwind]
aliases: [Tailwind, Colores de marca]
tipo: referencia
---

# Estilos — Tailwind

Config en `client/tailwind.config.js` + `postcss.config.js`. CSS en `src/index.css`.

## Setup

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
html, body, #root { height: 100%; }
.maplibre-gl-popup-content { border-radius: 0.5rem; }
```

## Color de marca

```js
colors: {
  brand: {
    DEFAULT: "#1d6f5c",  // verde
    dark:    "#144d40",
  }
}
```

Clases: `bg-brand`, `text-brand`, `hover:bg-brand-dark`, `text-brand-dark`, `bg-brand/10`, etc. Usadas en botones primarios, links activos, marcadores seleccionados.

## Colores semánticos (no config,直接 Tailwind)

| Uso | Clase | Color |
|---|---|---|
| Acción confirmar / activo | `bg-emerald-600`, `bg-emerald-100` | verde esmeralda |
| Acción rechazar / alerta | `bg-red-600`, `bg-red-50`, `text-red-700` | rojo |
| Texto primario | `text-gray-900` | casi negro |
| Texto secundario | `text-gray-600`/`500`/`400` | grises |
| Bordes | `border-gray-200` | |

## Convenciones observadas

- Bordes redondeados: `rounded-md` (formularios) / `rounded-full` (chips y botones circulares).
- Layout principal: `flex flex-col md:flex-row` (responsive).
- Alturas: `h-14` (navbar), `h-[calc(100vh-56px)]` (contenido), `h-full w-full` (mapa).
- Tipografía: base `text-sm`/`text-xs` muy frecuente; títulos `text-lg font-bold`.

## Relacionado

- [[Componentes del cliente]]
- [[Páginas y rutas (React Router)]]
