# Step 1 — Master Data APIs + Redis Cache

**Status:** ✅ Complete · Build: 0 warnings / 0 errors

Set up the whole backend skeleton: 4-project Clean Architecture solution, all entities,
DbContext + migration + seed data, Redis cache service, and the public master-data endpoints.

---

## What was built

### Solution (4 projects, Clean Architecture)
```
JobPing.sln
└── src/
    ├── JobPing.Domain/          18 entity classes, zero dependencies
    ├── JobPing.Application/     interfaces + DTOs
    ├── JobPing.Infrastructure/  EF Core, Redis
    └── JobPing.API/             controllers, Program.cs, config
```

### Entities (all 18, in `Domain/Entities/`)
Role, User, RefreshToken, LoginAttempt, Skill, Experience, Location, UserProfile, UserSkill,
UserLocation, Job, JobSkill, SavedJob, UserJobHistory, AlertHistory, MailQueue, Notification,
BackgroundTask.

### DbContext (`Infrastructure/Data/JobPingDbContext.cs`)
- All DbSets + full Fluent API config (no data annotations).
- snake_case tables **and** columns (auto PascalCase→snake_case converter).
- Unique indexes: `(user_id, skill_id)`, `(user_id, location_id)`, `(job_id, skill_id)`,
  `(external_id, source)`, and the critical `(user_id, job_id)` on `alert_history`.
- Named perf indexes: `idx_jobs_active_fetched`, `idx_mail_queue_status`, `idx_notifications_user_unread`.
- Seed data: 2 roles, 4 experiences, 20 skills, 6 locations, 2 background_tasks.

### Redis (`Infrastructure/Services/RedisCacheService.cs` → `ICacheService`)
Cache get/set (with TTL), remove, remove-by-pattern, distributed lock (SET NX + safe release via
Lua), JWT blacklist. Uses StackExchange.Redis + Newtonsoft.Json.

### Master data (`API/Controllers/MasterDataController.cs`)
Cache-aside via a thin `IMasterDataService` (keeps EF out of the controller per coding rule #1).

### Program.cs
PostgreSQL (Npgsql), Redis singleton, DI registrations, Swagger (+JWT), CORS for `localhost:4200`,
auto-migrate in Development, `GET /health`.

### Migration
`Infrastructure/Migrations/*_InitialCreate.cs` — all 18 tables, indexes, and seed data.

---

## After building

### How to run
```powershell
# deps
docker run -d --name jp-postgres -e POSTGRES_DB=jobping -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:15
docker run -d --name jp-redis -p 6379:6379 redis:7-alpine
# api (auto-applies migration + seed in Development)
dotnet run --project src/JobPing.API
```
Swagger: `https://localhost:7230/swagger` (or the printed port).

### The 3 endpoints to test (all public, Redis-cached 24h)
| Method | Endpoint | Returns |
|---|---|---|
| GET | `/api/master/skills` | 20 seeded skills |
| GET | `/api/master/locations` | 6 locations |
| GET | `/api/master/experiences` | 4 experience levels |

Plus `GET /health` → `{ status: "healthy", timestamp }`.

### Verify caching
Call `/api/master/skills` once, then check Redis: `redis-cli KEYS *` shows `skills:all`.
Second call is served from Redis.

---

## Environment note
Machine had only .NET 9 + 10 runtimes (no .NET 8) — a reason the project targets **.NET 9**.
