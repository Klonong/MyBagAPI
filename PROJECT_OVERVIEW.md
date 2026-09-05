# Pioma API — Project Overview

## Description
Pioma API is the backend service for the Pioma platform, built with [NestJS](https://nestjs.com/). It exposes a REST API secured with JWT authentication, backed by PostgreSQL (via Prisma), Redis-backed caching/queues, and OpenAPI (Swagger) documentation.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | [NestJS](https://nestjs.com/) 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) |
| Database | PostgreSQL |
| ORM | [Prisma](https://www.prisma.io/) (`@prisma/client`, `prisma`) |
| Auth | JWT (`@nestjs/jwt`), password hashing with `bcrypt` |
| Caching | `ioredis` — cache-aside for catalog/settings reads, see [Caching](#caching) below |
| Queues | `@nestjs/bullmq` + `bullmq` (Redis-backed; not yet wired to a processor) |
| Rate limiting | `@nestjs/throttler` |
| API docs | `@nestjs/swagger` (OpenAPI, served at `/docs`) |
| Validation | `class-validator` / `class-transformer` |
| Security headers | `helmet` |
| Testing | `jest`, `supertest`, `ts-jest` |
| Linting/formatting | `eslint` (flat config), `prettier` |

## Project Structure

```
prisma/
  schema.prisma        # Prisma schema (PostgreSQL datasource)
src/
  main.ts               # App bootstrap: helmet, validation pipe, Swagger at /docs
  app.module.ts         # Root module wiring Config, Throttler, Prisma, Redis, Auth
  common/
    filters/            # Global exception filters
    utils/              # Shared helpers: BigInt-safe JSON serialization, Prisma error -> HTTP exception mapping, pagination
  config/
    configuration.ts    # Typed config loader (port, database, jwt, redis)
  database/
    prisma.module.ts    # Global Prisma module
    prisma.service.ts   # PrismaClient wrapper as injectable service
  redis/
    redis.module.ts     # Global Redis module
    redis.service.ts    # ioredis wrapper: get/set/del + getOrSet cache-aside helper
  modules/
    auth/                # Authentication module (controller, service)
test/
  app.e2e-spec.ts       # End-to-end tests
```

## Configuration

Environment variables (see [.env.example](.env.example)):

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | Secret used to sign JWTs | — |
| `JWT_EXPIRES_IN` | JWT access token TTL | `15m` |
| `REDIS_HOST` | Redis host (cache/queues) | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |

Config is loaded centrally via [src/config/configuration.ts](src/config/configuration.ts) and exposed through `ConfigModule` globally.

## Caching
`RedisService` ([src/redis/redis.service.ts](src/redis/redis.service.ts)) wraps `ioredis` and is injected wherever read-heavy, rarely-changing data is served. Currently cached (cache-aside, via `getOrSet`), with cache invalidation on writes:
- Product list (60s TTL) and product detail (300s TTL) — `ProductsService`
- Category list (120s TTL) and category detail (300s TTL) — `CategoriesService`
- Store settings (300s TTL) — `AdminService`

Cart, wishlist, and orders are intentionally left uncached (per-user, mutate frequently). If Redis is unreachable, `getOrSet` logs a warning and falls back to the database rather than failing the request.

## Getting Started

### Prerequisites
- Node.js (LTS)
- PostgreSQL instance
- Redis instance (for caching/queues)

### Setup
```bash
npm install
cp .env.example .env   # then fill in real values
npm run prisma:generate
npm run prisma:migrate
```

### Run
```bash
npm run start:dev      # watch mode
npm run start          # standard
npm run start:prod      # production (requires npm run build first)
```

### Test
```bash
npm run test           # unit tests
npm run test:e2e       # end-to-end tests
npm run test:cov       # coverage
```

### Lint / Format
```bash
npm run lint
npm run format
```

## API Documentation
Once running, Swagger UI is available at `http://localhost:<PORT>/docs`.

## Security Notes
- Global `ValidationPipe` with `whitelist` and `transform` enabled.
- `helmet` applied for secure HTTP headers.
- Request throttling via `ThrottlerModule` (default: 20 requests / 60s).
- Passwords hashed with `bcrypt`; sessions/access tokens signed via JWT.
