# MoaSpace Backend API

A production-ready, modular layered architecture NestJS backend for the **MoaSpace** application.

Powered by **NestJS 11**, **Drizzle ORM**, **PostgreSQL**, **Redis**, and **Turborepo** with full **npm** support.

---

## Architecture & Features

- **Clean Scaffolding**: Pristine and unopinionated baseline ready for your custom business domain models.
- **Drizzle ORM & Migrations**: Strongly typed schemas in `@moaspace/database` mapped to PostgreSQL.
- **OpenAPI / Swagger Documentation**: Interactive API reference via Scalar at `/docs` and raw OpenAPI spec at `/openapi.yaml`.
- **OpenAPI Type Generation**: Generates client types via `@moaspace/api-types`.
- **Docker Compose**: Pre-configured PostgreSQL and Redis services.

---

## Workspace Structure

```
moaspace-backend/
├── apps/
│   └── api/                    # NestJS REST API (port :3000)
├── packages/
│   ├── database/               # @moaspace/database (Drizzle ORM schemas & migrations)
│   └── api-types/              # @moaspace/api-types (OpenAPI-generated TypeScript definitions)
├── docker/
│   └── docker-compose.yml      # PostgreSQL + Redis setup
└── scripts/
    └── setup-env.js            # Automatic .env preparation
```

---

## Quick Start

### 1. Prerequisites
- **Node.js** >= 22
- **npm** >= 10
- **Docker** & Docker Compose

### 2. Install Dependencies
```bash
npm install
```
> Running `npm install` automatically initializes `.env` files in `apps/api` and `packages/database` from `.env.example`.

### 3. Start Database & Cache
```bash
docker compose -f docker/docker-compose.yml up -d
```

### 4. Push Database Schema
```bash
npm --workspace=@moaspace/database run db:push
```

### 5. Start Development Server
```bash
npm run dev
```

The API will be available at:
- **API Base**: [http://localhost:3000](http://localhost:3000)
- **Interactive Docs**: [http://localhost:3000/docs](http://localhost:3000/docs)
- **Swagger JSON/YAML**: [http://localhost:3000/openapi.yaml](http://localhost:3000/openapi.yaml)
- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

---

## Common Commands

| Command | Description |
|---|---|
| `npm run dev` | Starts API in development watch mode |
| `npm run build` | Builds all packages via Turbo |
| `npm run typecheck` | Validates TypeScript types across packages |
| `npm test` | Runs unit tests across apps |
| `npm run format` | Formats code with oxfmt |
| `npm --workspace=@moaspace/database run db:studio` | Opens Drizzle Studio database UI |
| `npm --workspace=@moaspace/api-types run api:gen` | Regenerates OpenAPI TypeScript types |
