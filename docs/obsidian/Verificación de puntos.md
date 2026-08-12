---
tags: [dominio, verificacion]
aliases: [Verification, Cómo se valida un punto, Verificación, Sistema de verificación y código]
tipo: referencia
---

# Verificación de puntos

Cómo se valida un `Point` de tipo `offer_help` antes de publicarse.

## Modelo

La verificación ya **no** usa un campo `verificationCode`. Se basa en dos cosas (ver [[Modelo de datos]]):

- `Point.verificationStatus` (`VerificationStatus`: `pending` | `approved` | `rejected`) — estado actual de moderación del punto.
- Tabla `Verification` — **historial**: una fila por cada acción de moderación, con `moderatorId`, `status` y `note?`.

> [!warning] Ya no hay `verificationCode`
> El modelo anterior generaba un código alfanumérico por punto (`lib/code.ts`) que el moderador pedía por un canal externo. Eso **desapareció** en el modelo vigente. El archivo `lib/code.ts` aún existe pero **ya no se usa** en el flujo de creación (candidato a eliminar, ver [[Backlog]]).

## Flujo

1. Usuario crea un punto `offer_help` → la API lo guarda con `status=pending`, `verificationStatus=pending`.
2. Queda en la cola de moderación (`GET /api/moderator/points/pending`).
3. Un moderador lo aprueba o rechaza:
   - **Aprobar**: en una transacción se crea `Verification(status=approved)` y se actualiza el punto a `verificationStatus=approved`, `status=active`.
   - **Rechazar**: se crea `Verification(status=rejected, note?)` y el punto queda `verificationStatus=rejected`, `status=rejected`.
4. A partir de ahí, el punto es público (si fue aprobado) según la regla de visibilidad (ver [[Estados y ciclos de vida de un Punto]]).

Ver [[Flujo de moderación]] para el detalle de endpoints.

## Límites del sistema actual

- No hay expiración ni re-verificación periódica (existe `expiresAt` en el modelo, sin endpoint que lo use).
- No hay validación comunitaria expuesta por endpoints (existe la tabla `Validation`, sin uso aún).
- Un moderador **puede** verificar su propio punto: no hay restricción de auto-revisión. Ver [[Seguridad y consideraciones]].

## Relacionado

- [[Modelo de datos]]
- [[Flujo de moderación]]
- [[Estados y ciclos de vida de un Punto]]
- [[Roles y permisos]]
