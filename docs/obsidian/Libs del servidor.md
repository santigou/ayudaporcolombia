---
tags: [backend, lib, utilidades]
aliases: [Libs, Helpers servidor]
tipo: referencia
---

# Libs del servidor

Cuatro módulos pequeños bajo `server/src/lib/`.

## `prisma.ts`

```ts
export const prisma = new PrismaClient();
```

Singleton simple. Sin logging configurado. Importado por todas las rutas y el seed.

## `jwt.ts`

Ver [[Autenticación JWT + cookies]]. `signToken` / `verifyToken` + tipo `TokenPayload`. Falla al importar si falta `JWT_SECRET`.

## `password.ts`

```ts
hashPassword(plain)     // bcrypt.hash, 10 rounds
comparePassword(plain, hash)  // bcrypt.compare
```

10 rounds de salt — razonable para volúmenes bajos. Usado en auth y seed.

## `code.ts`

Ver [[Sistema de verificación y código]]. `generateVerificationCode(length=6)` con alfabeto no ambiguo. Usa `Math.random()`.

## Notas

- **Sin logging estructurado**: solo `console.error` en el error handler del `app.ts`.
- **Sin rate limiting** ni helmet. Ver [[Seguridad y consideraciones]].
- **Sin métricas** ni healthcheck dedicado.

## Relacionado

- [[Middleware]]
- [[Autenticación JWT + cookies]]
- [[Configuración de entorno]]
