---
tags: [proyecto, objetivos]
aliases: [Alcance, Restricciones]
tipo: referencia
---

# Objetivos y restricciones

## Objetivos (declarados y deducidos)

- Mostrar en un mapa puntos de ayuda **confiables** (verificados).
- Permitir reportes **rápidos** de personas no ubicadas, asumiendo el riesgo de no verificación con un aviso claro.
- Soportar **fotos** para dar contexto.
- Tener un **sistema de roles** ligero: usuarios y moderadores.
- Funcionar como **monolito** desplegable en un servidor casero.
- Usar infraestructura **gratuita / abierta** (Postgres local, tiles OSM, Nominatim).

## Restricciones

- **Sin costos de terceros** salvo que el volumen lo justifique (ver [[Backlog]]: posible migración de fotos a la nube).
- **Sin dependencia de APIs de mapas de pago**: se usa OpenFreeMap + MapLibre (ver [[Mapa interactivo]]).
- **Almacenamiento de fotos en disco local** (`server/uploads/`) — no en la nube todavía.
- **Autenticación con cookies httpOnly** (no localStorage de tokens).
- **Primera cuenta moderadora** creada por *seed*, no por UI.

## Fuera de alcance (por ahora)

- Chat / mensajería entre usuarios.
- Apps móviles nativas (es web responsiva).
- Internacionalización: la UI está en español y centrada en Colombia (`countrycodes=co`).
- Roles adicionales (admin, organización) — solo `user` y `moderator`.

## Relacionado

- [[Visión general del proyecto]]
- [[Decisiones de diseño]]
- [[Seguridad y consideraciones]]
- [[Backlog]]
