# MoaSpace REST API

NestJS backend REST API for MoaSpace. Clean, modular, and ready for feature implementation.

---

## Tech Stack

| Category | Technology |
|---|---|
| **Framework** | NestJS 11 + TypeScript 5 |
| **Database** | PostgreSQL + Drizzle ORM (via `@moaspace/database`) |
| **API Documentation** | OpenAPI 3.0 / Swagger + Scalar UI (`/docs`) |
| **Validation** | class-validator + class-transformer |
| **Testing** | Vitest + @nestjs/testing |

---

## Quick Start

```bash
# Push database schema
npm --workspace=@moaspace/database run db:push

# Start development server (port 3000)
npm run dev
```

The API will be available at:
- **Base URL**: `http://localhost:3000`
- **Interactive Documentation**: `http://localhost:3000/docs`
- **OpenAPI Schema**: `http://localhost:3000/openapi.yaml`
- **Health Check**: `http://localhost:3000/health`

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start development server with SWC and hot reload |
| `npm test` | Run unit tests |
| `npm run typecheck` | Type-check without emitting |
| `npm run build` | Build production bundle |