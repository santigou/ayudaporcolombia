---
tags: [operacion, seed]
aliases: [Primer moderador, seed.ts]
tipo: howto
---

# Seed del primer moderador

`server/src/seed.ts`. Corre con `npm run seed` (workspace server).

## Qué hace

1. Lee `SEED_MODERATOR_EMAIL`, `SEED_MODERATOR_PASSWORD` de `server/.env`. Si falta alguno → throw con mensaje claro.
2. Si **ya existe** un user con ese email → loguea y sale (idempotente). No sobreescribe rol.
3. Hashea la password con `hashPassword` (bcrypt, 10 rounds).
4. Crea el `User` con `role: "moderator"` directamente.
5. Loguea `Moderador creado: <email> (id ...)` y desconecta Prisma.

> [!warning] Sin `name`
> El modelo `User` no tiene `name`. El seed usa **solo email + contraseña**. La variable `SEED_MODERATOR_NAME` del `.env` es **legacy** y se ignora.

## Uso típico

Después de migrar por primera vez:

```bash
npm run prisma:migrate
npm run seed
```

Luego iniciar sesión con ese email/password en `/login` para acceder a `/moderador`.

## Por qué así

No hay UI de "primer admin". El seed es la **única** forma de crear un moderador sin pasar por la cola de solicitudes. Ver [[Roles y permisos]].

> [!warning] Contraseña débil = riesgo
> Si dejas `SEED_MODERATOR_PASSWORD="cambia-esta-clave"`, cualquier que conozca el correo entra como moderador. **Cambiar siempre** tras el seed (hoy no hay endpoint de cambio de password).

## Relacionado

- [[Roles y permisos]]
- [[Configuración de entorno]]
- [[Puesta en marcha (dev)]]
