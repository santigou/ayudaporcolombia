# Ayuda por Colombia - NestJS Backend

Backend implementation of the "Ayuda por Colombia" platform using **Hexagonal Architecture** with **Domain-Driven Design (DDD)** principles and **NestJS** framework.

## 🏗️ Architecture

This backend follows **Hexagonal/Ports-and-Adapters Architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     INFRASTRUCTURE LAYER                    │
│  (Adapters - Controllers, Repositories, Middleware, Guards)  │
├─────────────────────────────────────────────────────────────┤
│                       DOMAIN LAYER                          │
│         (Entities, Value Objects, Domain Services)          │
├─────────────────────────────────────────────────────────────┤
│                     APPLICATION LAYER                       │
│       (Use Cases, DTOs, Interfaces, Application Services)   │
└─────────────────────────────────────────────────────────────┘
```

### Key Principles
- **Domain-Driven Design**: Bounded Contexts (Auth, Points, Moderation)
- **Hexagonal Architecture**: Infrastructure independent of domain logic
- **Repository Pattern**: Abstract data access with Prisma implementation
- **Dependency Injection**: Loose coupling and easy testing
- **Clean Architecture**: Business logic separated from external concerns

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Docker (optional, for running PostgreSQL locally)

### Installation

1. **Install dependencies:**
```bash
cd server-nestjs
npm install
```

2. **Setup environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Setup database:**
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database
npm run seed
```

4. **Start development server:**
```bash
npm run start:dev
```

The server will start at `http://localhost:4000`