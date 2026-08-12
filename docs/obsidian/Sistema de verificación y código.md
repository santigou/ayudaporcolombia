---
tags: [dominio, verificacion, codigo, seguridad]
aliases: [VerificationCode, Código de verificación, Cómo se valida un punto]
tipo: referencia
---

# Sistema de verificación y código

Por qué los puntos de **ayuda** llevan un `verificationCode` y cómo se usa.

## Qué es

Un código alfanumérico de 6 caracteres generado para cada `Point` de tipo `ayuda` al crearse. Se devuelve al usuario en la pantalla de éxito y queda guardado en el `Point`.

## Generación (`lib/code.ts`)

```ts
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0, O, 1, I, L
generateVerificationCode(length = 6)
```

> [!info] Alfabeto a prueba de ambigüedad
> Se excluyen `0`, `O`, `1`, `I`, `L` para evitar confusiones visuales al leer/copiar el código a mano o por teléfono.

Usa `Math.random()` (no criptográfico) → suficiente para un código de referencia de moderación, **no** para tokens de seguridad.

## Flujo

1. Usuario crea un punto `ayuda` → la API genera el código y lo guarda.
2. La UI muestra: *"Tu código de verificación es **XYZ123**. Un moderador te contactará por Instagram o el canal autorizado usando este código para confirmar tu identidad antes de publicarlo."*
3. El moderador ve el código en el panel de moderación ([[ModeratorDashboard]]) junto al contacto del creador.
4. El moderador **fuera de la plataforma** (Instagram, etc.) contacta al usuario y le pide el código; si coincide, aprueba.

## Límites del sistema actual

- No hay registro **en la app** del contacto fuera de plataforma: el flujo es manual.
- No hay intentos límite ni expiración del código.
- Cualquiera que cree el punto ve el código (es el creador quien debe portarlo).
- El código **no** se usa para desbloquear nada en la API — es solo referencia operativa para el moderador.

## En el rediseño

El [[Modelo de datos (rediseño pendiente)]] reemplaza el `verificationCode` único por una tabla `Verification` (historial) y un `verificationStatus` en el punto. El código tal cual **desaparecería** salvo que se mantenga explícitamente.

## Relacionado

- [[Flujo de creación de un Punto]]
- [[Flujo de moderación]]
- [[Roles y permisos]]
- [[Seguridad y consideraciones]]
