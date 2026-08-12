---
tags: [operacion, docker, postgres]
aliases: [Compose, docker-compose]
tipo: referencia
---

# Docker — Postgres

`docker-compose.yml`. Hoy **solo** levanta la base de datos.

## Servicio

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ayuda
      POSTGRES_PASSWORD: ayuda
      POSTGRES_DB: ayudaporcolombia
    ports:
      - "5434:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

## Notas

- **Imagen alpine** de Postgres 16 → ligera.
- Credenciales `ayuda:ayuda` → solo para local. Cambiar en real.
- Puerto `5434` en el host → 5432 interno. Coincide con `DATABASE_URL` del `.env.example`.
- **Volumen persistente** `pgdata` → los datos sobreviven a `docker compose down`. Para borrar todo: `docker compose down -v`.
- `restart: unless-stopped` → arranca solo con Docker al reiniciar el equipo.

## Lo que no está

- No hay servicio para el server ni el client. El README lo deja como pendiente (ver [[Backlog]]: "Despliegue en el servidor casero vía Docker Compose completo").

## Relacionado

- [[Configuración de entorno]]
- [[Puesta en marcha (dev)]]
- [[Build y producción]]
