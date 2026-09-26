# ARCHITECTURE.md

## Layering (strict — controllers never touch DB/Redis directly)
```
Browser/Swagger → JobPing.API (Controllers, Program.cs, middleware)
                → JobPing.Application (interfaces + DTOs only, no impl)
                → JobPing.Infrastructure (EF Core, Redis, external HTTP, workers)
                → JobPing.Domain (plain entity classes, zero dependencies)
```
Rule: Controller → Service → DbContext/Redis. No EF/business logic in controllers.

## Folder map (deviations from CLAUDE.md spec noted)
- `src/JobPing.Domain/Entities/` — 18 entities, matches spec exactly.
- `src/JobPing.Application/DTOs/` and `/Interfaces/` — matches spec, but only
  interfaces for what's built so far (no IMatchingService/IAlertService/
  IEmailService yet — those are Step 6/7).
- `src/JobPing.Infrastructure/Migrations/` — **note:** actual path is
  `Infrastructure/Migrations/`, NOT `Infrastructure/Data/Migrations/` as the
  spec says. One migration so far: `InitialCreate` (20260619111544).
- `src/JobPing.Infrastructure/Services/` — implemented: AuthService,
  JwtService, MasterDataService, PreferenceService, JobService, JobFetchService,
  JobMappingService, SkillMatcher, RedisCacheService, LoggingMessagePublisher
  (stub IMessagePublisher — logs instead of publishing to RabbitMQ; swap in
  Step 7). NOT yet built: MatchingService, AlertService, SendGridEmailService,
  RabbitMQPublisher.
- `src/JobPing.Infrastructure/Workers/` — only FetchJobsWorker exists.
  MatchAndAlertWorker and MailWorker are not started (Step 7).
- `src/JobPing.Infrastructure/ExternalClients/` — RemotiveClient,
  ArbeitnowClient, WWRRssClient — all three built, typed HttpClients (30s
  timeout), registered in Program.cs.
- `src/JobPing.API/Controllers/` — AdminController, AuthController,
  JobsController, MasterDataController, PreferencesController. NOT built:
  AlertsController, NotificationsController.
- `src/JobPing.API/Middleware/` — ExceptionMiddleware, JwtBlacklistMiddleware
  (checks Redis blacklist on every authenticated request; **fails open** if
  Redis is down — availability over strict revocation, deliberate tradeoff).
- No `docker-compose.yml`, `Dockerfile`, `nginx/`, or `.github/workflows/`
  anywhere in the repo yet — Steps 8/9/10 not started.
- `jobping-ui/src/app/pages/` — landing, auth/login, auth/register, dashboard,
  jobs/jobs-list, jobs/job-detail all built. alerts/saved/preferences/profile
  are a shared `placeholder.component.ts` ("Coming soon" stub).
- `jobping-ui/src/app/services/` — auth, job, master-data, preference all
  built and wired. No alert.service.ts yet (no backend to call).

## Data flow (working today)
Angular service → `authInterceptor` attaches Bearer token from `localStorage`
→ .NET controller → Infrastructure service → EF Core (Postgres) and/or Redis
cache-aside → DTO back to Angular. 401 anywhere → interceptor clears tokens,
redirects to `/auth/login`.

## Key entities/tables
See `CLAUDE.md` §4 for full schema — it's implemented as specced. Most
important constraint: `alert_history` has `UNIQUE(user_id, job_id)` — this is
the dedup mechanism preventing repeat email alerts once Step 6/7 land.
`jobs` has `UNIQUE(external_id, source)` — dedup for the fetch worker
(enforced both in code via `AnyAsync` check and DB index).

## External services
- **Postgres 15** — source of truth, `JobPingDbContext` (EF Core code-first,
  Fluent API only, zero data annotations, seed data for roles/experiences/
  skills/locations/background_tasks defined in `OnModelCreating`).
- **Redis 7** — 2 of 4 planned responsibilities are live: (1) read cache
  (skills/locations/experiences 24h, jobs list 10min, job detail 30min),
  (2) distributed lock (`lock:fetch-jobs`, 90min TTL, used by FetchJobsWorker).
  Rate limiting and JWT blacklist TTL-based revocation: blacklist IS
  implemented (`JwtBlacklistMiddleware` + `/auth/revoke`); rate limiting is
  NOT implemented yet.
- **RabbitMQ** — not connected. `IMessagePublisher` is satisfied by
  `LoggingMessagePublisher`, which just logs `job.fetched` events instead of
  publishing. Real RabbitMQ publisher/consumers are Step 7.
- **SendGrid** — not connected. No email is actually sent anywhere yet.

## Conventions actually in use
- Table names snake_case via explicit `.ToTable()` + a `ToSnakeCase()` helper
  that auto-converts every column name in `OnModelCreating` (see bottom of
  `JobPingDbContext.cs`) — don't hand-roll snake_case property configs.
- All DTOs wrapped in `ApiResponseDto<T>` → `{ success, data, message }`.
- `DateTime.UtcNow` everywhere; DB defaults use `HasDefaultValueSql("NOW()")`.
- Cache-aside pattern: check Redis → miss → query DB → `SetAsync` with TTL →
  return. Cache keys are deterministic: list cache key = MD5 hash of the
  filter JSON (`jobs:list:{hash}`) so pagination/filter combos each get their
  own key. List cache is deliberately **user-agnostic** (`isSaved` always
  false in the cached payload) — per-user save flags are overlaid onto the
  cached result after reading, so one user's saved-state never leaks into
  another user's cached page.
- Delta updates for junction tables (user_skills, user_locations) — add only
  what's new, remove only what's gone, never wipe-and-reinsert (verified by
  row `id` stability across updates — see NOTES.md §6C for the proof query).
- Same error message ("Invalid email or password.") for wrong email vs wrong
  password in AuthService.Login — never reveal which one was wrong.
- JWT: `ClockSkew = TimeSpan.Zero`, role claim type is `"role"` (custom —
  needed for `[Authorize(Roles="Admin")]` to read it), `nameid` claim carries
  user id.
- Angular: standalone components only, `inject()` not constructor DI, every
  HTTP call goes through a `*.service.ts` (never HttpClient in a component
  directly), dark theme only via CSS variables in `styles/_variables.css`.

## appsettings note
`appsettings.json` has empty `Jwt:SecretKey` and `SendGrid:ApiKey` placeholders
— real values live in `appsettings.Development.json` (gitignored pattern
assumed — verify before committing). Program.cs throws on startup if
`Jwt:SecretKey` is missing.
