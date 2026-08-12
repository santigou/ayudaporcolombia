# Ayuda por Colombia

Plataforma para coordinar ayuda tras el sismo: mapa de puntos de ayuda (validados por moderadores) y reportes de personas no ubicadas (publicados de inmediato, marcados como no verificados).

Monolito: React + Vite (client) y Node/Express + Prisma (server) sobre PostgreSQL. Mapa con MapLibre GL JS + tiles gratis de OpenFreeMap.

## Requisitos

- Node.js 20+
- Docker (para levantar Postgres localmente) o una instancia de Postgres accesible

## Arranque en local

1. Copia el archivo de entorno y ajusta valores si quieres:

   ```bash
   cp .env.example server/.env
   ```

2. Instala dependencias (workspaces):

   ```bash
   npm install
   ```

3. Levanta Postgres:

   ```bash
   docker compose up -d
   ```

4. Corre las migraciones y crea el primer moderador (usa las credenciales `SEED_MODERATOR_*` de `server/.env`):

   ```bash
   npm run prisma:migrate
   npm run seed
   ```

5. Arranca cliente y servidor en modo desarrollo:

   ```bash
   npm run dev
   ```

   - Cliente: http://localhost:5173
   - API: http://localhost:4000

6. Inicia sesión con el correo/contraseña del moderador semilla para acceder a `/moderador`.

## Producción (build único)

```bash
npm run build
npm start
```

El servidor Express sirve el build de `client/dist` y expone la API bajo `/api`.

## Roles

- **Usuario normal**: se registra, puede crear puntos de ayuda (quedan pendientes de verificación por un moderador) y reportes de personas no ubicadas (se publican de inmediato, marcados como no verificados).
- **Moderador**: revisa y aprueba/rechaza puntos de ayuda pendientes, y aprueba/rechaza solicitudes de otros usuarios que quieren ser moderadores.

## Pendiente para después

- Despliegue en el servidor casero vía Docker Compose completo.
- Posible migración de almacenamiento de fotos a la nube si crece el volumen.
