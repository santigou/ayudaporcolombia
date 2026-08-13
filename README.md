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

- Posible migración de almacenamiento de fotos a la nube si crece el volumen.

## Producción con Docker + Cloudflare Tunnel

La app se despliega con **3 contenedores** (`app` + `postgres` + `cloudflared`) sin
abrir puertos en el router: Cloudflare Tunnel expone todo por HTTPS.

> La app es un monolito: el backend NestJS sirve la API (`/api`) **y** el SPA compilado
> (`client/dist`). Por eso hay un único contenedor de aplicación, no dos.

### 1) Crear el tunnel en Cloudflare (una sola vez)

1. Entra a **Cloudflare Zero Trust → Networks → Tunnels → Create a tunnel**.
2. Nómbralo (ej. `ayuda`) y copia el **token** de instalación → va en `TUNNEL_TOKEN`.
3. En la pestaña **Public Hostname** del tunnel añade:
   - Subdomain/Domain: `ayuda.tudominio.com` (tu dominio gestionado en Cloudflare).
   - Service: `HTTP` · URL `app:4000` (el nombre del contenedor dentro de la red de compose).

### 2) Configurar variables

```bash
cp .env.prod.example .env.prod
# Edita .env.prod: JWT_SECRET (largo/aleatorio), POSTGRES_PASSWORD,
# SEED_MODERATOR_* y TUNNEL_TOKEN.
```

### 3) Levantar

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

- Migraciones y moderador inicial se aplican automáticamente al arrancar `app`.
- Fotos subidas y datos de la BD persisten en volúmenes (`uploads`, `pgdata`).
- La app queda accesible en `https://ayuda.tudominio.com` (HTTPS por Cloudflare).

### Comandos útiles

```bash
# Ver logs
docker compose -f docker-compose.prod.yml logs -f app

# Reconstruir tras un cambio de código
docker compose -f docker-compose.prod.yml up -d --build

# Detener todo
docker compose -f docker-compose.prod.yml down
```
