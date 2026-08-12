---
tags: [proyecto, vision]
aliases: [Qué es Ayuda por Colombia, Resumen del proyecto]
tipo: referencia
---

# Visión general del proyecto

**Ayuda por Colombia** es una plataforma web para **coordinar ayuda humanitaria tras un sismo** (originalmente pensada para Colombia).

## Qué hace

Coordina dos tipos de información sobre un mapa:

1. **Puntos de ayuda** (`offer_help`) — refugios, puntos de alimentos, agua, atención médica, etc. **Validados por moderadores** antes de publicarse.
2. **Reportes de personas no ubicadas** (`need_help`) — publicaciones **inmediatas** marcadas como *no verificadas*, para maximizar la velocidad ante una urgencia.

## Problema que resuelve

En una emergencia la información rápida y geolocalizada es crítica. Pero la **velocidad** y la **confiabilidad** compiten:

- Si todo requiere validación → la información urgente (una persona desaparecida) llega tarde.
- Si nada se valida → el mapa se llena de ruido / desinformación.

La solución del proyecto es un **modelo dual**:

| Tipo | Velocidad | Confiabilidad |
|---|---|---|
| `offer_help` | Moderada (lento) | Verificada por moderador |
| `need_help` | Inmediata | Marcada como *no verificada* |

Ver [[Tipos de Punto - ayuda vs necesita_ayuda]].

## Para quién

- **Ciudadanos** que necesitan ayuda o quieren ofrecerla / reportar.
- **Moderadores** voluntarios que validan puntos y administran la comunidad.

## Forma

Monolito web (un solo deploy) — cliente React + API Node/Express sobre PostgreSQL, con un mapa interactivo. Ver [[Arquitectura general]].

## Contexto

> [!info] Origen
> El README menciona "tras el sismo", lo que ubica el proyecto en un escenario de respuesta a desastre. El dominio `ayudaporcolombia.org` aparece en el `.env.example`.

## Relacionado

- [[Objetivos y restricciones]]
- [[Estado del proyecto]]
- [[Decisiones de diseño]]
