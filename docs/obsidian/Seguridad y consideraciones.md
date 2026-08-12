---
tags: [seguridad, riesgos]
aliases: [Riesgos, Seguridad]
tipo: referencia
---

# Seguridad y consideraciones

Inventario de riesgos y mitigaciones actuales / pendientes.

## ✅ Bien hecho

| Práctica | Dónde |
|---|---|
| JWT en cookie **httpOnly** (no XSS-robable por JS) | `auth.routes.ts` |
| `sameSite: lax` + `secure` en prod | `COOKIE_OPTIONS` |
| CORS restringido a `CLIENT_ORIGIN` | `app.ts` |
| Passwords con bcrypt (10 rounds) | `password.ts` |
| Validación de input con zod en cada endpoint | `auth.routes.ts`, `points.routes.ts` |
| `JWT_SECRET` obligatorio (fail-fast) | `jwt.ts` |
| `.env` en `.gitignore` | raíz |
| Puntos públicos filtrados por estado | `points.routes.ts` |

## ⚠️ Mejorable

| Riesgo | Estado | Mitigación sugerida |
|---|---|---|
| **Sin rate limiting** | No hay | `express-rate-limit` en auth y create |
| **Sin helmet** (headers de seguridad) | No hay | añadir `helmet()` |
| **Sin CSRF token** | Solo `sameSite=lax` | suficiente para POST, revisar si se añaden forms sin JSON |
| **Auto-moderación** posible | Sin control | bloquear que un moderador apruebe su propio punto/solicitud |
| **Validación de imágenes solo por MIME** | `fileFilter` usa `mimetype` | validar magic bytes o usar `sharp` |
| **Fotos huérfanas** | No se borran al rechazar | garbage collector al rechazar/eliminar |
| **Sin expiry de `verificationCode`** | El código no caduca | añadir TTL o eliminar tras aprobación |
| **`Math.random()` para códigos** | No criptográfico | aceptable para referencia, no para secretos |
| **`GET /api/points/:id` devuelve datos sensibles** | `contactInfo`, `verificationCode`, `reviewedById` | seleccionar campos como en el listado |
| **Path `clientDist` relativo a cwd** | Prod depende del directorio de lanzamiento | usar `__dirname` o path absoluto |
| **Credenciales DB débiles** (`ayuda:ayuda`) | Solo local | cambiar en prod |
| **Sin logs estructurados ni monitoreo** | `console.error` | pino/winston + métricas |
| **Sin tests** | No hay | añadir antes de crecer |
| **Sin HTTPS explícito en despliegue** | Pendiente | reverse proxy con TLS |

## Privacidad

- El campo `contactInfo` de User es libre (texto) → los usuarios pueden meter teléfono/Instagram. Eso es dato personal.
- `Point.contactInfo` (público en detalle) también. En una emergencia es el punto, pero conviene avisar al usuario qué se publica.

## Disponibilidad

- Servidor casero = punto único de fallo. Sin réplicas, sin CDN.
- Dependencia de tiles OpenFreeMap y Nominatim (externos) → si caen, mapa roto / búsqueda rota.

## Relacionado

- [[Autenticación JWT + cookies]]
- [[Subida de fotos]]
- [[Sistema de verificación y código]]
- [[Backlog]]
- [[Decisiones de diseño]]
