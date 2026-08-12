---
tags: [moc, indice, ayudaporcolombia]
aliases: [Índice, Mapa de contenidos, MOC]
tipo: moc
---

# 00 — Índice (Mapa de contenidos)

Punto de entrada a la base de conocimiento del proyecto **Ayuda por Colombia**.

## Visión general

- [[Visión general del proyecto]] — qué es, para quién, qué resuelve
- [[Objetivos y restricciones]] — metas, alcance y límites
- [[Estado del proyecto]] — modelo vigente (plataforma de ayuda estructurada)

## Arquitectura

- [[Arquitectura general]] — monolito, capas, flujo de datos
- [[Stack tecnológico]] — todas las tecnologías usadas
- [[Estructura del repositorio]] — carpetas y archivos
- [[Diagramas Mermaid]] — arquitectura y flujos en un solo lugar

## Modelo de dominio

- [[Modelo de datos]] — el schema vigente (modelo rico, migrado)
- [[Estados y ciclos de vida de un Punto]] — `pending → active`, estados y visibilidad

## Funcionalidades

- [[Tipos de Punto - ayuda vs necesita_ayuda]] — la distinción central (`offer_help` / `need_help`)
- [[Flujo de creación de un Punto]] — usuario → mapa → moderación
- [[Verificación de puntos]] — cómo se valida un `offer_help` (tabla `Verification`)
- [[Roles y permisos]] — user / moderator
- [[Flujo de moderación]] — revisión de puntos y solicitudes
- [[Mapa interactivo]] — MapLibre + OpenFreeMap
- [[Búsqueda de direcciones]] — Nominatim / OpenStreetMap
- [[Subida de fotos]] — multer, límites, almacenamiento

## Backend en detalle

- [[API REST - endpoints]] — catálogo completo de rutas
- [[Autenticación JWT + cookies]] — cómo funciona la sesión
- [[Middleware]] — auth, upload
- [[Libs del servidor]] — jwt, password, code, prisma
- [[Configuración de entorno]] — variables `.env`

## Frontend en detalle

- [[Páginas y rutas (React Router)]]
- [[Componentes del cliente]]
- [[AuthContext y estado de sesión]]
- [[Cliente HTTP (api)]]
- [[Estilos - Tailwind]] — colores de marca

## Operación

- [[Puesta en marcha (dev)]] — pasos para correr local
- [[Build y producción]] — monolito Express sirviendo el cliente
- [[Docker - Postgres]] — compose local
- [[Seed del primer moderador]]

## Backlog y decisiones

- [[Backlog]] — pendientes declarados en el README
- [[Decisiones de diseño]] — por qué se eligió cada cosa
- [[Seguridad y consideraciones]] — riesgos y mitigaciones
