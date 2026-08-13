# syntax=docker/dockerfile:1

# ============================ Build stage ============================
FROM node:20-alpine AS build
WORKDIR /app

# Manifests primero para aprovechar el cache de dependencias de Docker.
COPY package.json package-lock.json ./
COPY server-nestjs/package.json ./server-nestjs/
COPY client/package.json ./client/
RUN npm ci

# Resto del código fuente y build de cliente + servidor (npm workspaces).
COPY . .
RUN npm run build

# Genera el cliente Prisma (motor de consulta) dentro de node_modules.
RUN npx prisma generate --schema=server-nestjs/prisma/schema.prisma

# =========================== Runtime stage ===========================
FROM node:20-alpine AS runtime
WORKDIR /app

# Deps de producción + CLI de Prisma (necesaria para `migrate deploy` en el
# arranque, ya que `prisma` es una devDependency).
COPY package.json package-lock.json ./
COPY server-nestjs/package.json ./server-nestjs/
COPY client/package.json ./client/
RUN npm ci --omit=dev \
 && npm install --no-save prisma@^5.20.0

# Artefactos de build: servidor compilado, SPA y schema/migraciones.
COPY --from=build /app/server-nestjs/dist ./server-nestjs/dist
COPY --from=build /app/client/dist ./client/dist
COPY server-nestjs/prisma ./server-nestjs/prisma

# Regenera el cliente Prisma con el motor de la plataforma runtime (linux/musl).
RUN npx prisma generate --schema=server-nestjs/prisma/schema.prisma

# Entrypoint: migraciones + seed-prod + start. Normaliza CRLF→LF (se edita en Win).
COPY server-nestjs/entrypoint.sh ./server-nestjs/entrypoint.sh
RUN sed -i 's/\r$//' server-nestjs/entrypoint.sh && chmod +x server-nestjs/entrypoint.sh

# main.ts usa process.cwd() para /uploads y ../client/dist para el SPA, así que
# el WORKDIR debe ser el del servidor.
WORKDIR /app/server-nestjs
RUN mkdir -p uploads

# Las fotos subidas se guardan en disco: volumen para que persistan.
VOLUME ["/app/server-nestjs/uploads"]

EXPOSE 4000
ENTRYPOINT ["./entrypoint.sh"]