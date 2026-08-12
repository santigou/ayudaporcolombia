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
| Puntos públicos filtrados por visibilidad | `points.routes.ts` |

## ⚠️ Mejorable

| Riesgo | Estado | Mitigación sugerida |
|---|---|---|
| **Sin rate limiting** | No hay | `express-rate-limit` en auth y create |
| **Sin helmet** (headers de seguridad) | No hay | añadir `helmet()` |
| **Sin CSRF token** | Solo `sameSite=lax` | suficiente para POST, revisar si se añaden forms sin JSON |
| **Auto-moderación** posible | Sin control | bloquear que un moderador apruebe su propio punto/solicitud |
| **Validación de imágenes solo por MIME** | `fileFilter` usa `mimetype` | validar magic bytes o usar `sharp` |
| **Fotos huérfanas** | No se borran al rechazar | garbage collector al rechazar/eliminar |
| **`GET /api/points/:id`** devuelve datos sensibles | `contacts` del punto | el listado omite contacto; el detalle lo incluye (revisar si es intencional) |
| **Path `clientDist` relativo a cwd** | Prod depende del directorio de lanzamiento | usar `__dirname` o path absoluto |
| **Credenciales DB débiles** (`ayuda:ayuda`) | Solo local | cambiar en prod |
| **Sin logs estructurados ni monitoreo** | `console.error` | pino/winston + métricas |
| **Sin tests** | No hay | añadir antes de crecer |
| **Sin HTTPS explícito en despliegue** | Pendiente | reverse proxy con TLS |

## Privacidad

- Los contactos de un punto (`Contact`) son texto libre → los usuarios pueden meter teléfono/Instagram. Es dato personal.
- Los contactos visibles públicamente son los que tienen `isPublic=true`. El listado público **no** los devuelve; el detalle sí. En una emergencia es el punto, pero conviene avisar al usuario qué se publica.

## Disponibilidad

- Servidor casero = punto único de fallo. Sin réplicas, sin CDN.
- Dependencia de tiles OpenFreeMap y Nominatim (externos) → si caen, mapa roto / búsqueda rota.

## Relacionado

- [[Autenticación JWT + cookies]]
- [[Subida de fotos]]
- [[Verificación de puntos]]
- [[Backlog]]
- [[Decisiones de diseño]]
