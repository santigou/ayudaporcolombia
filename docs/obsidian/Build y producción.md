---
tags: [operacion, build, prod]
aliases: [Producción, Deploy]
tipo: howto
---

# Build y producción

## Build único

```bash
npm run build   # = npm run build -w client && npm run build -w server
npm start       # = npm run start -w server → node dist/index.js
```

- `client` → `tsc -b && vite build` → output en `client/dist`.
- `server` → `tsc -p tsconfig.json` → output en `server/dist`.

## Cómo sirve Express

En `app.ts`:

```ts
const clientDist = path.join(process.cwd(), "..", "client", "dist");
app.use(express.static(clientDist));
app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"), ...);
});
```

> [!warning] Path relativo frágil
> `clientDist` es `..`/`client`/`dist` relativo a `process.cwd()`. **Depende del directorio de trabajo** al arrancar. Hay que lanzar `npm start` desde `server/` o ajustar el path. Si se lanza desde otra carpeta, el SPA no se sirve.

## Variables de entorno en prod

- `NODE_ENV=production` → cookie `secure`, CORS con `CLIENT_ORIGIN` real.
- `JWT_SECRET` fuerte.
- `DATABASE_URL` apuntando al Postgres real.
- Servir bajo **HTTPS** (para que `secure=true` funcione).

## SPA fallback

Cualquier ruta que no sea `/api/*` ni `/uploads/*` cae al `index.html` → el cliente enruta con React Router. Esto significa que `/moderador` recargada funciona en prod (no en dev con el proxy separado, donde Vite lo maneja igual).

## Lo que falta (según README)

- **Despliegue en servidor casero vía Docker Compose completo** (hoy el compose solo tiene Postgres). Ver [[Backlog]].

## Relacionado

- [[Arquitectura general]]
- [[Configuración de entorno]]
- [[Puesta en marcha (dev)]]
