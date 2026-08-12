# Architecture Documentation - Ayuda por Colombia Backend

## Overview
This backend implements a **Hexagonal (Ports and Adapters) Architecture** combined with **Domain-Driven Design (DDD)** principles using **NestJS**.

## Architectural Layers

### 1. Domain Layer (Core)
- **Purpose**: Business rules and domain logic
- **Components**: Entities, Value Objects, Domain Services
- **Characteristics**: Framework-agnostic, no external dependencies

### 2. Application Layer
- **Purpose**: Orchestrates use cases and coordinates domain operations
- **Components**: Use Cases, DTOs, Interfaces, Application Services
- **Dependencies**: Only depends on Domain Layer

### 3. Infrastructure Layer
- **Purpose**: Technical details and external concerns
- **Components**: Controllers, Repositories, Middleware, Guards
- **Dependencies**: Implements Application Layer interfaces

## Bounded Contexts

### 1. Auth Context
- Entities: User, ModeratorRequest
- Value Objects: Email, PasswordHash
- Use Cases: Register, Login

### 2. Points Context
- Entities: Point, Location, Contact, Supply
- Value Objects: Coordinates
- Use Cases: CreatePoint, GetPoints, ApprovePoint

### 3. Moderation Context
- Entities: Verification, Validation
- Use Cases: ApprovePoint, RejectPoint

## Key Patterns

### Repository Pattern
Abstract data access behind interfaces for testability and flexibility.

### Use Case Pattern
Each business operation encapsulated in a dedicated use case class.

### Value Objects
Immutable domain concepts with built-in validation.

### Dependency Injection
Loose coupling and easy testing via NestJS DI system.

## Technology Stack
- **NestJS**: Node.js framework
- **Prisma ORM**: Database access
- **PostgreSQL**: Database
- **Zod**: Validation
- **TypeScript**: Type safety

See README.md for setup instructions.