---
tags: [backlog, pendientes]
aliases: [TODO, Pendientes, Próximos pasos]
tipo: referencia
---

# Backlog

Lo declarado como pendiente + lo que surge del análisis.

## Declarado (README)

- [ ] **Despliegue en servidor casero vía Docker Compose completo** (hoy solo Postgres). Ver [[Build y producción]].
- [ ] **Migración de almacenamiento de fotos a la nube** si crece el volumen. Ver [[Subida de fotos]].

## Deducido del análisis

### Modelo de datos
- [ ] **Decidir el destino del [[Modelo de datos (rediseño pendiente)|rediseño del schema]]**: adoptarlo, ajustarlo o descartarlo. ([[Estado del proyecto y divergencias]])
- [ ] Reincorporar `User.name` / `User.contactInfo` (o equivalentes) si se adopta el rediseño.

### Funcionalidades
- [ ] Transición a `resolved` para `necesita_ayuda` (no hay endpoint hoy). Ver [[Estados y ciclos de vida de un Punto]].
- [ ] Cambio/registro de password (el seed deja una fija). Ver [[Seed del primer moderador]].
- [ ] Edición / baja de puntos por el creador (no existe).
- [ ] Filtros por búsqueda de texto, radio geográfico, fecha.
- [ ] Búsqueda de direcciones en el `Home` (solo está en `CreatePoint`).
- [ ] Geocoding inverso (punto → dirección).

### Operación / seguridad
- [ ] Rate limiting + helmet. Ver [[Seguridad y consideraciones]].
- [ ] Logging estructurado.
- [ ] Healthcheck (`GET /api/health`).
- [ ] Validación de entorno con zod al arranque.
- [ ] Limpieza de fotos huérfanas al rechazar/eliminar puntos.
- [ ] Validación real de imágenes (magic bytes, no solo MIME).
- [ ] Evitar auto-moderación (que un moderador no apruebe su propio punto/solicitud).
- [ ] Unificar gestor de paquetes (npm vs pnpm en `client/`).

### Infra
- [ ] HTTPS + dominio real (`ayudaporcolombia.org`).
- [ ] Backups de `pgdata` y `uploads/`.
- [ ] CI (lint, typecheck, test).

## Relacionado

- [[Estado del proyecto y divergencias]]
- [[Decisiones de diseño]]
- [[Seguridad y consideraciones]]
