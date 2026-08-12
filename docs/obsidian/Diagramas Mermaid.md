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

## Modelo de datos (actual, simplificado)

```mermaid
erDiagram
    User ||--o{ Point : "crea"
    User ||--o{ Point : "revisa (reviewedById)"
    User ||--o| ModeratorRequest : "envía"
    User ||--o{ ModeratorRequest : "revisa (reviewedById)"
    Point {
        string id PK
        enum  type "ayuda|necesita_ayuda"
        string title
        string description
        float  lat
        float  lng
        string addressText
        enum   category
        text[] photos
        string contactInfo
        string verificationCode
        enum   status
        string createdById FK
        string reviewedById FK
    }
```

## Ciclo de vida de un Punto de ayuda

```mermaid
stateDiagram-v2
    [*] --> pending: usuario crea (ayuda)
    pending --> approved: moderador aprueba
    pending --> rejected: moderador rechaza
    approved --> [*]
    rejected --> [*]
```

## Ciclo de vida de un reporte necesita_ayuda

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
    alt type=ayuda
        A->>DB: crea Point(status=pending, verificationCode)
        A-->>C: 201 + código
        C-->>U: "enviado a revisión, tu código es..."
    else type=necesita_ayuda
        A->>DB: crea Point(status=active)
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
- [[Modelo de datos (actual)]]
- [[Estados y ciclos de vida de un Punto]]
