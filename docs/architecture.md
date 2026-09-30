# MoaSpace Backend Architecture

A modular, scalable, production-ready NestJS backend for the MoaSpace application.

---

## Tech Stack

- **Framework**: [NestJS 11](https://nestjs.com/)
- **Runtime**: Node.js 22+
- **Database ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Database Engine**: PostgreSQL 16+
- **API Documentation**: OpenAPI / Swagger with Scalar UI at `/docs`
- **Monorepo Manager**: Turborepo + npm workspaces

---

## Directory Layout

```
moaspace-backend/
├── apps/
│   └── api/                    # NestJS API Application (Port :3000)
│       ├── src/
│       │   ├── database/       # Drizzle database module & provider
│       │   ├── app.controller.ts
│       │   ├── app.service.ts
│       │   ├── app.module.ts
│       │   └── main.ts
│       └── package.json
│
├── packages/
│   ├── database/               # @moaspace/database
│   │   ├── src/
│   │   │   └── schemas/        # Drizzle table schemas
│   │   ├── scripts/seed.ts     # Initial database seed
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   └── api-types/              # @moaspace/api-types (Shared TypeScript types)
│       └── package.json
│
└── docker/
    └── docker-compose.yml      # Local PostgreSQL & Redis
```

---

## Development Workflow

1. **Database Schema Changes**:
   - Define new tables in `packages/database/src/schemas/`.
   - Export them in `packages/database/src/schemas/index.ts`.
   - Build database types: `npm --workspace=@moaspace/database run build`.
   - Push to local DB: `npm --workspace=@moaspace/database run db:push`.

2. **Adding API Features**:
   - Create feature modules under `apps/api/src/modules/<feature-name>/`.
   - Register them in `apps/api/src/app.module.ts`.
