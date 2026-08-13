#!/bin/sh
# Entrypoint de producción del contenedor `app`.
#   1) Aplica migraciones pendientes (idempotente).
#   2) Crea el moderador inicial si no existe (no destructivo).
#   3) Levanta el servidor NestJS (sirve API + SPA).
set -e

echo "==> Aplicando migraciones (prisma migrate deploy)..."
npx prisma migrate deploy

echo "==> Asegurando moderador inicial (idempotente)..."
node dist/scripts/seed-prod.js || echo "   seed-prod: omitido o falló, continuando."

echo "==> Iniciando servidor..."
exec node dist/main