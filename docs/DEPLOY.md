# Despliegue de producción

Guía paso a paso para desplegar **ayudaporcolombia** con Docker + Cloudflare
Tunnel, integrando las fotos con tu SeaweedFS (`j4f-storage`).

> Supuesto: el SeaweedFS y esta app corren en el **mismo servidor** (`j4f-server`),
> pero cada uno con su propio `docker-compose`. No comparten red: el navegador
> habla con ambos por HTTPS (la app por su tunnel, las fotos por `cdn.jffsolutions.com`).

---

## Arquitectura final

```
                     ┌─────────────────────────────────────┐
   Browser ──HTTPS──▶│ Cloudflare (ayuda.jffsolutions.com) │──tunnel──▶ app:4000 (NestJS API + SPA)
                     └─────────────────────────────────────┘                │
                                                                            │ presign
                     ┌─────────────────────────────────────┐                ▼
   Browser ──HTTPS──▶│ Cloudflare (cdn.jffsolutions.com)   │──tunnel──▶ S3:8333 (SeaweedFS)
    (PUT foto)       └─────────────────────────────────────┘
    (GET <img>)            (bucket ayudaporcolombia, CORS configurado)
```

---

## 0) Requisitos previos (servidor `j4f-server`)

- [x] SeaweedFS (`j4f-storage`) corriendo con la API S3 (puerto 8333) tras nginx.
- [x] Bucket `ayudaporcolombia` creado + CORS configurado + identidad `ayuda_apc_key`.
  (ver `docs/seaweedfs-s3-config.md` — el paso de las keys ya está hecho).
- [ ] Docker + Docker Compose.
- [ ] Un dominio gestionado en Cloudflare (ej. `jffsolutions.com`).

---

## 1) Llevar el código al servidor

### Opción A — Git (recomendado)

```bash
cd ~  # o donde quieras
git clone <url-de-tu-repo> ayudaporcolombia
cd ayudaporcolombia

# Para actualizar tras cambios futuros:
git pull
```

### Opción B — Subir el código (sin git)

```bash
# Desde tu PC, comprime y sube (excluye node_modules/dist)
tar --exclude='node_modules' --exclude='dist' --exclude='.git' -czf app.tar.gz .
scp app.tar.gz j4f-dev@j4f-server:~/

# En el servidor
mkdir -p ~/ayudaporcolombia && tar -xzf app.tar.gz -C ~/ayudaporcolombia
cd ~/ayudaporcolombia
```

---


---

## 3) Configurar el `.env.prod`

```bash
cd ~/ayudaporcolombia
cp .env.prod.example .env.prod
nano .env.prod   # o el editor que prefieras
```

Completa estos valores:

```env
# ===== Postgres =====
POSTGRES_USER=ayuda
POSTGRES_PASSWORD=<genera: openssl rand -hex 24>
POSTGRES_DB=ayudaporcolombia

# ===== App =====
JWT_SECRET=<genera: openssl rand -hex 32>
# El dominio público de la APP (lo que ve el navegador)
CLIENT_ORIGIN=https://ayuda.jffsolutions.com

# ===== Moderador inicial =====
SEED_MODERATOR_EMAIL=moderador@tudominio.com
SEED_MODERATOR_PASSWORD=<una clave fuerte>

# ===== Cloudflare Tunnel =====
TUNNEL_TOKEN=<el token del paso 2>

# ===== Storage (fotos) =====
STORAGE_DRIVER=seaweedfs
S3_ENDPOINT=https://cdn.jffsolutions.com
S3_REGION=us-east-1
S3_BUCKET=ayudaporcolombia
S3_ACCESS_KEY=ayuda_apc_key
S3_SECRET_KEY=<la MISMA secreta que pusiste en el s3.json de j4f-storage>
S3_PUBLIC_URL=https://cdn.jffsolutions.com
```

> ⚠️ `S3_SECRET_KEY` debe ser **idéntica** a la del `s3.json` del SeaweedFS,
> si no, los PUT darán `SignatureDoesNotMatch`.

---

## 4) CORS del bucket: añadir el dominio de la app

El bucket `ayudaporcolombia` ya tiene CORS, pero debe incluir el dominio de la
**app** (no `localhost`). En el servidor:

```bash
cat > /tmp/cors.json <<'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://ayuda.jffsolutions.com"],
      "AllowedMethods": ["GET", "PUT"],
      "AllowedHeaders": ["Content-Type", "Content-Length", "Content-MD5"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 86400
    }
  ]
}
EOF

AWS_ACCESS_KEY_ID=j4f-dev AWS_SECRET_ACCESS_KEY='aDvhVPzbL3U47@' \
  aws --endpoint-url=https://cdn.jffsolutions.com s3api put-bucket-cors \
    --bucket ayudaporcolombia --cors-configuration file:///tmp/cors.json
```

> Cambia `https://ayuda.jffsolutions.com` por tu dominio real.

---

## 5) Levantar la app

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

La primera vez tarda unos minutos (build). Verifica que arrancó:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

Busca: `🚀 Server is running on: http://localhost:4000` y `📝 Environment: production`.

---

## 6) Verificar end-to-end

1. Abre `https://ayuda.jffsolutions.com` → debe cargar el mapa.
2. Inicia sesión con el moderador semilla.
3. Crea un punto de ayuda con una foto.
4. La foto debe subir y verse servida desde `https://cdn.jffsolutions.com/...`.

Si la subida falla con 403/CORS, revisa el paso 4 (CORS del bucket con el dominio correcto).

---

## Actualizar tras un cambio de código

```bash
cd ~/ayudaporcolombia
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Las migraciones se aplican solas en el arranque (`entrypoint.sh`).

---

## Comandos útiles

```bash
docker compose -f docker-compose.prod.yml logs -f app   # logs en vivo
docker compose -f docker-compose.prod.yml ps            # estado contenedores
docker compose -f docker-compose.prod.yml down          # detener todo
```

---

## Troubleshooting rápido

| Síntoma | Causa probable | Fix |
|---|---|---|
| Fotos no suben (403) | CORS del bucket sin el dominio de la app | Paso 4 (`put-bucket-cors`) |
| 403 `SignatureDoesNotMatch` | `S3_SECRET_KEY` distinta entre app y `s3.json` | Igualar los valores |
| 403 `InvalidAccessKeyId` | No reiniciaste `j4f-storage` tras editar `s3.json` | `docker restart j4f-storage` |
| 403 `AccessDenied` | La identidad no tiene `Write:ayudaporcolombia` | Revisar `actions` del `s3.json` |
| App no carga (502/timeouts) | El tunnel no apunta a `app:4000` | Revisar Public Hostname en Cloudflare |
## 2) Crear el Tunnel de Cloudflare para la app (una sola vez)

1. **Cloudflare Zero Trust → Networks → Tunnels → Create a tunnel**.
2. Nómbralo (ej. `ayuda`) y copia el **token**.
3. En **Public Hostname** añade:
   - Subdomain/Domain: `ayuda.jffsolutions.com` (tu dominio).
   - Service: `HTTP` · URL `app:4000`.

> ℹ️ Es un tunnel **distinto** al de SeaweedFS (`j4f-storage-tunnel`), porque la
> app levanta su propio contenedor `cloudflared` (ver `docker-compose.prod.yml`).
