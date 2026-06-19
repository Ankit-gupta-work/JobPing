# JobPing — Quick Notes (Understanding + Testing)

A skim-friendly overview of what's built so far and how to test it.
For full spec see `CLAUDE.md`. This file = the "get the idea" version.

> **Status:** Step 1 ✅ Master Data · Step 2 ✅ Preferences · Step 3 ✅ Angular onboarding · Step 4 ✅ FetchJobs worker · Step 5 ✅ Jobs API + UI · Auth ✅ (register/login/JWT) · rest pending.
> **Stack:** .NET 9 Web API · PostgreSQL 15 · Redis 7 · EF Core 9 · Angular 21 (Tailwind 3 + Material)

---

## 1. The big picture

```
Browser / Swagger
      │  HTTP + JWT
      ▼
┌─────────────────────────────────────────────┐
│  JobPing.API        Controllers, Program.cs  │  ← thin, no logic
├─────────────────────────────────────────────┤
│  JobPing.Application  Interfaces + DTOs       │  ← contracts only
├─────────────────────────────────────────────┤
│  JobPing.Infrastructure  Services (the logic) │  ← talks to DB + Redis
├─────────────────────────────────────────────┤
│  JobPing.Domain      Entities (plain classes) │  ← no dependencies
└─────────────────────────────────────────────┘
      │                         │
      ▼                         ▼
  PostgreSQL                  Redis
 (source of truth)        (cache + locks)
```

**Rule of thumb:** Controller → Service → DbContext/Redis. Controllers never touch the DB directly.

---

## 2. What each project holds

| Project | What's inside | Think of it as |
|---|---|---|
| **Domain** | 18 entity classes (User, Job, Skill, UserSkill…) | The database shape, as C# |
| **Application** | Interfaces (`IPreferenceService`…) + DTOs | The "menu" — what can be done |
| **Infrastructure** | `JobPingDbContext`, Services, Redis cache | The actual work |
| **API** | Controllers, `Program.cs`, middleware | The front door |

---

## 3. Core ideas to understand the code

- **DTO vs Entity** — Entities = DB rows. DTOs = what the API sends/receives. We never expose entities (e.g. password hash) directly.
- **`ApiResponseDto<T>`** — every endpoint returns the same envelope:
  ```json
  { "success": true, "data": { ... }, "message": null }
  ```
- **Cache-aside (Redis)** — read flow: check Redis → if missing, read DB → store in Redis with a TTL → return. Master data is cached 24h.
- **Cache invalidation** — when a user changes preferences, we delete their `user:matches:{userId}` Redis key so stale matches don't linger.
- **Delta updates** — when updating a list (skills/locations) we add only what's new and remove only what's gone. We never wipe and re-insert. (Keeps row ids stable + avoids churn.)
- **JWT auth** — protected endpoints need a Bearer token. User id comes from the token's `nameid` claim, not from the request body.
- **ExceptionMiddleware** — turns thrown errors into clean JSON: missing thing → 404, duplicate → 409, unknown → 500 (no stack traces leaked).

---

## 4. Endpoints so far

### Public (no token)
| Method | Route | Returns |
|---|---|---|
| GET | `/health` | `{ status, timestamp }` |
| GET | `/api/master/skills` | 20 seeded skills (cached 24h) |
| GET | `/api/master/locations` | 6 locations |
| GET | `/api/master/experiences` | 4 experience levels |

### Protected (need Bearer token)
| Method | Route | Body | Does |
|---|---|---|---|
| GET | `/api/preferences` | — | Full profile + skills/locations/experience |
| PUT | `/api/preferences` | `UserPreferenceDto` | Update everything (delta) |
| POST | `/api/preferences/skills` | `{ "skillId": 3 }` | Add a skill |
| DELETE | `/api/preferences/skills/{id}` | — | Remove a skill |
| POST | `/api/preferences/locations` | `{ "locationId": 2 }` | Add a location |
| DELETE | `/api/preferences/locations/{id}` | — | Remove a location |

---

## 5. How to run

**1. Start dependencies (Docker):**
```bash
docker run -d --name jp-postgres -e POSTGRES_DB=jobping -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:15
docker run -d --name jp-redis -p 6379:6379 redis:7-alpine
```

**2. Run the API** (auto-applies migrations + seed data in Development):
```bash
dotnet run --project src/JobPing.API
```

**3. Open Swagger:** `https://localhost:<port>/swagger`

---

## 6. How to test

### A. Public endpoints — zero setup
Just hit them in Swagger or browser:
- `GET /health` → healthy
- `GET /api/master/skills` → list of 20 skills
- Call skills twice → 2nd call comes from Redis (faster). Check: `redis-cli KEYS *` shows `skills:all`.

### B. Preferences — need a user + a token
1. **Create a test user** (login isn't built yet):
   ```sql
   INSERT INTO users (full_name, username, email, password_hash, role_id, is_active, created_on)
   VALUES ('Test User','testuser','test@jobping.dev','x',2,true,NOW());  -- becomes id 1
   ```
2. **Make a token** at [jwt.io](https://jwt.io) — algorithm HS256, secret =
   `DevSuperSecretKeyMustBeAtLeast32CharactersLong!`, payload:
   ```json
   { "nameid": "1", "iss": "jobping-api", "aud": "jobping-client", "exp": 1797000000 }
   ```
3. In Swagger click **Authorize**, paste the token.
4. Try the 6 preference endpoints.

### C. Prove the delta-update works (the interesting part)
```sql
-- after PUT with skillIds [1,2,3]
SELECT id, skill_id FROM user_skills WHERE user_id=1 ORDER BY skill_id;
-- (10,1) (11,2) (12,3)

-- after PUT with skillIds [2,3,4]
SELECT id, skill_id FROM user_skills WHERE user_id=1 ORDER BY skill_id;
-- (11,2) (12,3) (13,4)   ← skill 1 removed, 4 added, 2 & 3 keep ids
```
Same ids for 2 & 3 = proof we did NOT delete-all-and-reinsert.

### D. Prove cache invalidation
```bash
redis-cli SET user:matches:1 "stale"
# call any preference change (PUT / add / remove)
redis-cli GET user:matches:1   →  (nil)
```

---

## 7. Common gotchas

- **401 on preferences** → token missing/expired, or wrong secret/issuer/audience.
- **500 on add skill** → the user id in the token doesn't exist in `users` (FK). Create the user first.
- **404 on add skill** → that skill id isn't seeded/active (valid skills are 1–20).
- **Can't connect** → Postgres/Redis containers not running.

---

## 8. Frontend (Angular 21) — Step 3

Lives in `jobping-ui/`. Standalone components, Tailwind 3 for layout, Angular Material only
for the spinner + snackbar. Dark theme via CSS variables (no light mode).

### How it's wired
```
Component  →  Service (HttpClient)  →  Backend API
   ▲              │
   │         authInterceptor  ── attaches Bearer token, redirects on 401
guards (auth/guest) protect routes by checking localStorage token
```
- **Never** call HttpClient from a component — always a service.
- Tokens live in `localStorage` (`accessToken`, `refreshToken`, `currentUser`).
- Design tokens: edit `src/styles/_variables.css`; Tailwind colors in `tailwind.config.js`
  (so `bg-bg-surface`, `text-text-primary` work as classes).

### Pages
| Route | Page | State |
|---|---|---|
| `/` | Landing (hero + CTA) | done |
| `/auth/login` | Login | done |
| `/auth/register` | 4-step onboarding | done |
| `/dashboard` | Welcome placeholder | stub |
| `/jobs` `/alerts` `/saved` `/preferences` `/profile` | shared "Coming soon" | stub |

### Onboarding API calls (in order)
1. **Step 0 Account** → `POST /api/auth/register` (stores tokens)
2. **Step 1 Skills** → `GET /api/master/skills`
3. **Step 2 Preferences** → `GET /api/master/locations` + `GET /api/master/experiences`
4. **Step 3 Finish** → `PUT /api/preferences` → go to `/dashboard`

### Run it
```bash
cd jobping-ui
ng serve                 # http://localhost:4200
```
Backend must run on port 5052 (CORS allows 4200):
```bash
dotnet run --project src/JobPing.API --launch-profile http
```
API base URL is set in `src/environments/environment.ts`.

> ⚠️ `register` / `login` hit `AuthController`, which isn't built yet — those two buttons
> error until the auth backend step. Everything else (guards, master-data chips, layout) works now.

---

## 9. Job fetching (Step 4)

A background worker pulls jobs from 3 free sources every 2 hours, dedupes, tags skills, stores them.

### Pieces
| File | Role |
|---|---|
| `ExternalClients/RemotiveClient` `ArbeitnowClient` `WWRRssClient` | Typed HttpClients (30s timeout) per source |
| `Services/JobMappingService` | Maps each source's shape → `Job` entity (truncates to column sizes) |
| `Services/SkillMatcher` | Finds skill IDs by case-insensitive substring in title+description |
| `Services/JobFetchService` | **The pipeline** — lock → fetch → dedup → save → skills → publish → invalidate cache |
| `Workers/FetchJobsWorker` | `BackgroundService` + `PeriodicTimer(2h)`, runs once on startup then every 2h |
| `Controllers/AdminController` | `POST /api/admin/fetch-jobs` (Admin only) → runs the same pipeline on demand |

The worker and the admin endpoint call the **same** `JobFetchService` — no duplicated logic.

### How a run works
1. Grab Redis lock `lock:fetch-jobs` (90-min TTL). If held → log "skipping", exit. ← prevents double runs
2. `background_tasks` row for `FetchJobsTask` → status `Running`.
3. For each source: fetch → map → for each job check `(external_id, source)` exists → skip if yes, else insert.
4. Per new job: extract skill IDs, save `job_skills`, publish `job.fetched` (just logged until Step 7).
5. Delete Redis keys `jobs:list:*`; status → `Success`, `next_run_at = now + 2h`; release lock.
6. Any error → status `Failed` + `last_error_msg`; lock still released; worker keeps looping.

### Dedup (the important bit)
Key is the unique pair **(external_id, source)** — enforced both in code (`AnyAsync` check before insert)
and by a DB unique index. Same job seen twice = inserted once. Re-running the fetch inserts **0** new
rows for jobs already stored.

### Test it
> ⚠️ Needs **Redis running** (the lock). Needs an **Admin JWT** for the manual endpoint
> (`"role": "Admin"` claim). The worker also auto-runs ~immediately on API startup.
```
POST /api/admin/fetch-jobs        → { "data": { "newJobs": 142 }, ... }
```
Verify in DB:
```sql
SELECT source, COUNT(*) FROM jobs GROUP BY source;        -- Remotive / Arbeitnow / WWR
SELECT COUNT(*) FROM job_skills;                          -- skills tagged
```
Run it twice — second call returns `newJobs: 0` (dedup working).

---

## 10. Jobs API + UI (Step 5)

Browse/filter/save the jobs the worker indexed. Backend caches lists/details in Redis; Angular has
a jobs list, a detail page, and a populated dashboard.

### Endpoints (all `[Authorize]`, under `api/jobs`)
| Method | Route | Notes |
|---|---|---|
| GET | `/api/jobs` | filters: `source`, `location`, `skillIds`, `isRemote`, `page`, `pageSize` — cached 10 min |
| GET | `/api/jobs/matches` | empty for now (Step 6) |
| GET | `/api/jobs/saved` | the user's saved jobs |
| GET | `/api/jobs/{id}` | detail (+ description) — cached 30 min, logs a "Viewed" history row |
| POST | `/api/jobs/{id}/save` | toggles save → unsave → save |

### Caching detail worth knowing
- List cache key = **MD5 of the filter JSON** → `jobs:list:{hash}`. The cached page is
  **user-agnostic** (`isSaved=false`); the user's saved flags are overlaid *after* reading cache,
  so one user's saves never leak into another's cached list.
- The fetch worker clears `jobs:list:*` after inserting new jobs, so lists stay fresh.

### Frontend
`jobs-list` (sidebar: source / remote / location chips · cards with save toggle, skill tags, time-ago ·
pagination · skeleton · empty state), `job-detail` (badges, skills, `[innerHTML]` description,
Apply opens `sourceUrl`, save toggle), and the dashboard now shows indexed-job count + 3 recent jobs.

### Test
```
GET /api/jobs?page=1&pageSize=5                  # pagination
GET /api/jobs?source=Remotive&isRemote=true      # filter
```
Cache check: 1st call → SQL in API logs; 2nd identical call → no SQL (served from Redis key
`jobs:list:<hash>`).

> ⚠️ Needs Redis up (list/detail cache). Needs a JWT (any logged-in user).

---

## 11. Auth (register / login / JWT)

Unblocks the onboarding flow and issues real tokens (incl. the Admin token for `/api/admin/*`).

### Endpoints (`api/auth`)
| Method | Route | Auth | Does |
|---|---|---|---|
| POST | `/register` | public | create user + empty profile + welcome mail row → returns tokens |
| POST | `/login` | public | verify BCrypt password → tokens (same error for bad email *or* password) |
| POST | `/refresh` | public | rotate: revoke old refresh token, issue a new pair |
| POST | `/revoke` | bearer | revoke refresh token + blacklist this access token's JTI in Redis |
| GET | `/me` | bearer | current user from JWT claims |

### How tokens work
- **Access token** = short-lived JWT (15 min) with claims `nameid` (user id), `role`, `email`,
  `name`, `jti`. Signed HS256 with `Jwt:SecretKey`.
- **Refresh token** = random 64-byte string stored in `refresh_tokens` (7-day expiry). Rotated on
  every `/refresh` (old one revoked) — so a stolen refresh token has a short useful life.
- **Revoke / blacklist:** `/revoke` revokes the refresh row *and* puts the access token's `jti` in
  Redis (`blacklist:jwt:{jti}`). `JwtBlacklistMiddleware` checks every authenticated request and
  401s revoked tokens — it **fails open** if Redis is down (availability over strict revocation).
- Password hashing = BCrypt. Wrong email and wrong password return the **same** message.

### Now real, not hand-made tokens
The Angular register/login buttons work end-to-end. To get an **Admin** token, set a user's
`role_id = 1` then log in (the JWT carries `role: "Admin"` → `/api/admin/fetch-jobs` works).

---

## 12. What's next (from CLAUDE.md build order)

Step 6 Matching · Step 7 RabbitMQ + mail · Step 8 Docker Compose · Step 9 Deploy · Step 10 CI/CD.
