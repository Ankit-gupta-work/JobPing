# PROJECT.md

## Purpose
JobPing — developer-focused job alert platform. Fetches jobs from free public
APIs every 2h, scores match % against each user's skill profile, emails alerts
above the user's threshold via SendGrid.

## Core user journey
Register → set skills + location prefs → receive email alerts for matching jobs.

## Tech stack
- Backend: .NET 9 Web API, EF Core 9 (code-first), PostgreSQL 15
- Frontend: Angular 21 (standalone components), Tailwind 3 + Angular Material
- Cache/locks/rate-limit: Redis 7 (StackExchange.Redis)
- Queue (planned, not yet wired): RabbitMQ 3.x
- Email (planned): SendGrid v3
- Auth: JWT (HS256, 15 min access token) + refresh token rotation, BCrypt hashing

## How to run locally
```bash
# Deps (Docker)
docker run -d --name jp-postgres -e POSTGRES_DB=jobping -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:15
docker run -d --name jp-redis -p 6379:6379 redis:7-alpine

# API (auto-migrates + seeds in Development)
dotnet run --project src/JobPing.API --launch-profile http   # port 5052
# Swagger at /swagger

# Frontend
cd jobping-ui && ng serve   # http://localhost:4200, CORS allows this origin
```
No Docker Compose file yet — services are started individually (see above).

## Full spec
`CLAUDE.md` at repo root is the complete original spec (schema, DTOs, all
endpoints, worker/queue design, Docker/CI templates). Treat it as the target,
not the current state — see REQUIREMENTS.md for what's actually built.
