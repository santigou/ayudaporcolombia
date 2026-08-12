---
tags: [flujo, moderacion]
aliases: [Panel de moderador, Moderation flow]
tipo: flujo
---

# Flujo de moderación

Dos colas de trabajo para el moderador: **puntos** y **solicitudes**. Ver [[ModeratorDashboard]] para la UI.

## Cola 1: Puntos de ayuda pendientes

Solo revisan puntos `type=ayuda AND status=pending` (los `necesita_ayuda` **no** se moderan previamente).

```mermaid
sequenceDiagram
    participant M as Moderador
    participant A as API
    participant DB
    M->>A: GET /api/moderator/points/pending
    A-->>M: lista (incluye createdBy + verificationCode)
    M->>M: contacta al creador por canal externo, pide código
    alt código coincide
        M->>A: POST /api/moderator/points/:id/approve
        A->>DB: status=approved, reviewedById, reviewedAt
    else no coincide / sospechoso
        M->>A: POST /api/moderator/points/:id/reject
        A->>DB: status=rejected, reviewedById, reviewedAt
    end
```

- Endpoints: `GET /points/pending`, `POST /points/:id/approve`, `POST /points/:id/reject`.
- Guardan quién revisó (`reviewedById`) y cuándo (`reviewedAt`).
- Si el punto no es `ayuda` o no está `pending` → 404.

## Cola 2: Solicitudes de moderador

Usuarios que pidieron ser moderadores (`wantsModerator` al registrarse).

```mermaid
sequenceDiagram
    participant M as Moderador
    participant A as API
    participant DB
    M->>A: GET /api/moderator/requests
    A-->>M: solicitudes pending
    alt aprueba
        M->>A: POST /api/moderator/requests/:id/approve
        A->>DB: tx { request.status=approved, User.role=moderator }
    else rechaza
        M->>A: POST /api/moderator/requests/:id/reject
        A->>DB: request.status=rejected
    end
```

- La aprobación es **atómica** (`prisma.$transaction`) — actualiza la solicitud y el rol del usuario a la vez.
- Una vez aprobado, ese usuario ve el link "Moderación" en su navbar.

## Punto importante

- Un moderador **puede moderar sus propios puntos o su propia solicitud**: no hay restricción de auto-revisión en el código. Ver [[Seguridad y consideraciones]].

## Relacionado

- [[Roles y permisos]]
- [[Sistema de verificación y código]]
- [[API REST - endpoints]]
- [[Estados y ciclos de vida de un Punto]]
