---
tags: [diagrama, mermaid]
aliases: [Diagramas]
tipo: referencia
---

# Diagramas Mermaid

Centralizo aquí los diagramas para referencia rápida. Obsidian los renderiza nativamente.

## Arquitectura

```mermaid
flowchart LR
    Browser["Navegador<br/>(React SPA)"] -->|/api| Express
    Browser -->|tiles| OFM["OpenFreeMap"]
    Browser -->|geocoding| NOM["Nominatim"]
    Express --> Prisma --> PG[("PostgreSQL")]
    Express -->|fotos| FS[("uploads/")]
```

## Modelo de datos (simplificado)

```mermaid
erDiagram
    User ||--o{ Point : "crea (createdById)"
    User ||--o{ Verification : "verifica (moderatorId)"
    User ||--o{ ModeratorRequest : "envía"
    User ||--o{ ModeratorRequest : "revisa (reviewedById)"
    Point ||--o{ PointLocation : "tiene"
    PointLocation }o--|| Location : ""
    Point ||--o{ Contact : "tiene"
    Point ||--o{ Attachment : "tiene"
    Point ||--o{ Verification : "historial"
    Point }o--|| HelpType : "helpTypeId"
    Point {
        string type "need_help|offer_help"
        string title
        enum   status
        enum   verificationStatus
        string helpTypeId FK
    }
```

> [!info] Modelo completo
> Ver [[Modelo de datos]] para todas las tablas y campos (incluye `Supply`/`PointSupply`, `Validation`, `PointUpdate`, etc.).

## Ciclo de vida de un punto offer_help

```mermaid
stateDiagram-v2
    [*] --> pending: usuario crea (verificationStatus=pending)
    pending --> active: moderador aprueba
    pending --> rejected: moderador rechaza
    active --> [*]
    rejected --> [*]
```

## Ciclo de vida de un reporte need_help

```mermaid
stateDiagram-v2
    [*] --> active: usuario crea (se publica ya)
    active --> resolved: (marcado resuelto - futuro)
    active --> [*]
```

Ver [[Estados y ciclos de vida de un Punto]].

## Flujo de creación de punto

```mermaid
sequenceDiagram
    participant U as Usuario
    participant C as Cliente
    participant A as API
    participant DB as Postgres
    U->>C: Completa formulario + marca mapa
    C->>A: POST /api/points (multipart)
    A->>A: requireAuth + multer + zod
    alt type=offer_help
        A->>DB: crea Point(pending) + Location + Contact + Attachments
        A-->>C: 201
        C-->>U: "enviado a revisión"
    else type=need_help
        A->>DB: crea Point(active) + Location + Contact
        A-->>C: 201
        C-->>U: "ya visible, marcado no verificado"
    end
```

Ver [[Flujo de creación de un Punto]].

## Flujo de autenticación

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API
    B->>A: POST /api/auth/login {email,password}
    A->>A: bcrypt.compare
    A-->>B: Set-Cookie: token (httpOnly) + JSON user
    Note over B: cookie enviada en cada fetch (credentials)
    B->>A: GET /api/auth/me (cookie)
    A->>A: verifyToken → req.user
    A-->>B: user actual
```

Ver [[Autenticación JWT + cookies]].

## Relacionado

- [[Arquitectura general]]
- [[Modelo de datos]]
- [[Estados y ciclos de vida de un Punto]]
