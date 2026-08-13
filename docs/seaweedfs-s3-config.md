# Configuración de SeaweedFS S3 para ayudaporcolombia

Esta guía muestra los cambios exactos a hacer en el **repositorio del servidor
de almacenamiento** (donde corre el contenedor `j4f-storage` con SeaweedFS) para
habilitar la subida de fotos de ayudaporcolombia vía API S3 con URLs pre-firmadas.

El bucket se llama **`ayudaporcolombia`** y vive como carpeta
`/buckets/ayudaporcolombia` en el volumen del contenedor `j4f-storage` (sin
almacenamiento en nube externa).

## 1) Añadir variables al `.env` del storage

```env
# Ayuda por Colombia
S3_AYUDA_ACCESS_KEY=ayuda_apc_key
S3_AYUDA_SECRET_KEY="genera-una-secreta-larga-y-aleatoria"
```

Genera la secret así (en el servidor):
```bash
openssl rand -base64 32
```

## 2) Añadir identidades al `s3.json`

Añade DOS objetos al array `"identities"`:

```json
{
    "name": "ayudaporcolombia",
    "credentials": [
        {
            "accessKey": "${S3_AYUDA_ACCESS_KEY}",
            "secretKey": "${S3_AYUDA_SECRET_KEY}"
        }
    ],
    "actions": [
        "Read:ayudaporcolombia",
        "Write:ayudaporcolombia",
        "List:ayudaporcolombia"
    ]
},
{
    "name": "anonymous",
    "actions": [
        "Read:ayudaporcolombia"
    ]
}
```

- La identidad **`ayudaporcolombia`** la usa el backend (NestJS) para generar las
  URLs pre-firmadas de subida (Write) y listar (List).
- La identidad **`anonymous`** permite que el `<img>` lea las fotos **sin
  credenciales** (lectura pública del bucket).

> ⚠️ IMPORTANTE: crea la identidad `anonymous` **una sola vez**. Si ya existe en
> tu `s3.json` (porque la usan otras apps), añádele `"Read:ayudaporcolombia"` a
> su array `actions` en vez de duplicarla.

## 3) Reiniciar SeaweedFS para que cargue la config

```bash
docker restart j4f-storage
```

## 4) Crear el bucket y configurar CORS

Crea el bucket con la identidad admin y aplícale CORS para que el navegador
pueda hacer el PUT directo (SeaweedFS soporta CORS nativo a nivel de bucket,
igual que AWS S3, incluyendo el preflight OPTIONS):

```bash
export AWS_ACCESS_KEY_ID=j4f-dev
export AWS_SECRET_ACCESS_KEY='aDvhVPzbL3U47@'
export AWS_ENDPOINT_URL=https://cdn.jffsolutions.com

# 1) Crear el bucket
aws --endpoint-url=$AWS_ENDPOINT_URL s3 mb s3://ayudaporcolombia

# 2) CORS del bucket: permite PUT/GET desde el dominio de la app.
#    <<< AJUSTA AllowedOrigins al dominio público de tu APP >>>
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
aws --endpoint-url=$AWS_ENDPOINT_URL s3api put-bucket-cors \
  --bucket ayudaporcolombia --cors-configuration file:///tmp/cors.json
```

> ⚠️ **No hace falta tocar nginx**: el bloque S3 (`cdn.jffsolutions.com`) sigue
> siendo un proxy puro. SeaweedFS responde los `OPTIONS` de preflight usando la
> config CORS del bucket. Ver `docs/seaweedfs-cdn-nginx.conf`.

## 5) Verificar (antes de deployar)

```bash
# Subida con la identidad de la app (lo que hace el backend con presigned):
export AWS_ACCESS_KEY_ID=ayuda_apc_key
export AWS_SECRET_ACCESS_KEY='<tu-secreta>'
echo "hola" > /tmp/p.txt
aws --endpoint-url=$AWS_ENDPOINT_URL s3 cp /tmp/p.txt s3://ayudaporcolombia/probe.txt
# Lectura pública (identidad anonymous):
curl -i https://cdn.jffsolutions.com/ayudaporcolombia/probe.txt
# Ver CORS (preflight):
curl -i -X OPTIONS \
  -H "Origin: https://ayuda.jffsolutions.com" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://cdn.jffsolutions.com/ayudaporcolombia/probe.txt
```

El primer `curl` debe responder `200` con `hola`. El segundo (preflight) debe
responder `200/204` con las cabeceras `Access-Control-Allow-*`.

## 6) En el `.env.prod` de ayudaporcolombia

```env
STORAGE_DRIVER=seaweedfs
S3_ENDPOINT=https://cdn.jffsolutions.com
S3_REGION=us-east-1
S3_BUCKET=ayudaporcolombia
S3_ACCESS_KEY=ayuda_apc_key
S3_SECRET_KEY=<la-misma-secreta-del-s3.json>
S3_PUBLIC_URL=https://cdn.jffsolutions.com
```

## Notas

- SeaweedFS guarda cada bucket como **una colección**. Por defecto una colección
  usa 7 volúmenes; si tu disco es pequeño, ya tienes `-master.volumeSizeLimitMB=1024`,
  así que está acotado.
- El CORS para el `PUT` del navegador se configura en el **bucket** con
  `aws s3api put-bucket-cors` (paso 4), NO en nginx. SeaweedFS lo maneja nativo.
