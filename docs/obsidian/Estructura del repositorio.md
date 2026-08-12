---
tags: [estructura, repo]
aliases: [Carpetas, Árbol de archivos]
tipo: referencia
---

# Estructura del repositorio

```
ayudaporcolombia/
├── package.json            # workspace root (scripts dev/build/start/...)
├── docker-compose.yml      # solo Postgres
├── .env.example            # plantilla (se copia a server/.env)
├── .gitignore
├── README.md
├── server/                 # API Node + Prisma  (workspace)
│   ├── package.json        # type: module, scripts prisma/seed
│   ├── tsconfig.json       # NodeNext, strict
│   ├── prisma/
│   │   ├── schema.prisma   # ⚠️ rediseño pendiente (no migrado)
│   │   └── migrations/
│   │       └── 20260811160618_init/migration.sql
│   ├── src/
│   │   ├── index.ts        # listen en PORT
│   │   ├── app.ts          # crea app Express, monta rutas + SPA
│   │   ├── seed.ts         # crea el primer moderador
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── points.routes.ts
│   │   │   └── moderator.routes.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   └── upload.middleware.ts
│   │   └── lib/
│   │       ├── prisma.ts
│   │       ├── jwt.ts
│   │       ├── password.ts
│   │       └── code.ts
│   └── uploads/            # fotos (gitignored, se crea sola)
└── client/                 # SPA React + Vite  (workspace)
    ├── package.json
    ├── vite.config.ts      # proxy /api y /uploads → :4000
    ├── tailwind.config.js  # color de marca
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.tsx        # BrowserRouter + AuthProvider
        ├── App.tsx         # Navbar + Routes
        ├── index.css       # tailwind + .maplibregl-popup
        ├── types.ts        # tipos del dominio (frontend)
        ├── api/client.ts   # fetch wrapper
        ├── context/AuthContext.tsx
        ├── pages/
        │   ├── Home.tsx
        │   ├── CreatePoint.tsx
        │   ├── Login.tsx
        │   ├── Register.tsx
        │   └── ModeratorDashboard.tsx
        └── components/
            ├── MapView.tsx
            ├── AddressSearch.tsx
            ├── FiltersBar.tsx
            ├── PointList.tsx
            ├── PointCard.tsx
            └── PointDetail.tsx
```

## Notas

- **`docs/obsidian/`** → esta base de conocimiento (no afecta el runtime).
- Los `uploads/` se crean solos al primer arranque (lo hace `upload.middleware.ts` con `fs.mkdirSync`).
- El root usa **npm workspaces** (no pnpm, aunque hay locks sueltos de pnpm en `client/`).

## Relacionado

- [[Arquitectura general]]
- [[API REST - endpoints]]
- [[Componentes del cliente]]
