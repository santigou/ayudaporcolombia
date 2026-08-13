# syntax=docker/dockerfile:1
#
# Un único Dockerfile con dos TARGETS:
#   - back   → NestJS (API pura en :4000)
#   - front  → nginx sirviendo el SPA (:80) + proxy /api y /uploads al back
#
# En docker-compose se selecciona con `target: back` / `target: front`.

# ============================ Build base ============================
FROM node:20-alpine AS build-base
WORKDIR /app

# Manifests primero para aprovechar el cache de dependencias de Docker.
COPY package.json package-lock.json ./
COPY server-nestjs/package.json ./server-nestjs/
COPY client/package.json ./client/
RUN npm ci

# Resto del código fuente.
COPY . .

# ============================ Back build ============================
FROM build-base AS back-build
# Generar el cliente Prisma ANTES del build: sin él, los tipos son `any` y
# `nest build` falla con TS7006 en builds limpios (no hay cliente cacheado).
RUN npx prisma generate --schema=server-nestjs/prisma/schema.prisma
RUN npm run build -w server-nestjs

# ============================ Front build ============================
FROM build-base AS front-build
RUN npm run build -w client

# ============================ Back runtime ============================
FROM node:20-alpine AS back
WORKDIR /app

# Deps de producción + CLI de Prisma (necesaria para `migrate deploy` en el
# arranque, ya que `prisma` es una devDependency).
COPY package.json package-lock.json ./
COPY server-nestjs/package.json ./server-nestjs/
COPY client/package.json ./client/
RUN npm ci --omit=dev \
 && npm install --no-save prisma@^5.20.0

# Artefactos de build del servidor + schema/migraciones.
COPY --from=back-build /app/server-nestjs/dist ./server-nestjs/dist
COPY server-nestjs/prisma ./server-nestjs/prisma

# Regenera el cliente Prisma con el motor de la plataforma runtime (linux/musl).
RUN npx prisma generate --schema=server-nestjs/prisma/schema.prisma

# Entrypoint: migraciones + seed-prod + start. Normaliza CRLF→LF (se edita en Win).
COPY server-nestjs/entrypoint.sh ./server-nestjs/entrypoint.sh
RUN sed -i 's/\r$//' server-nestjs/entrypoint.sh && chmod +x server-nestjs/entrypoint.sh

WORKDIR /app/server-nestjs

EXPOSE 4000
ENTRYPOINT ["./entrypoint.sh"]

# ============================ Front runtime ============================
FROM nginx:alpine AS front

# nginx: sirve el SPA y hace de proxy hacia el back (/api y /uploads).
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

# Artefactos de build del cliente (SPA compilado).
COPY --from=front-build /app/client/dist /usr/share/nginx/html

EXPOSE 80