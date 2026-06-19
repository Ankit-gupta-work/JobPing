# Step 5 — Jobs API + Redis Caching + Angular Jobs Pages

**Status:** ✅ Complete · Backend & frontend build clean (0 warnings) · No new migration

Browse, filter, paginate, and save jobs the worker indexed. Lists/details cached in Redis; Angular
gets a jobs list, a job detail page, a working job service, and a populated dashboard.

---

## Backend

| File | Role |
|---|---|
| `Application/DTOs/Jobs/JobDtos.cs` | `JobListItemDto`, `JobDetailDto`, `JobFilterDto`, `PagedResultDto<T>` |
| `Application/Interfaces/IJobService.cs` | 4-method contract |
| `Infrastructure/Services/JobService.cs` | Query + filter + paginate + Redis cache |
| `API/Controllers/JobsController.cs` | 5 endpoints (`[Authorize]`) |
| `Program.cs` | Registered `IJobService` |

### Endpoints
| Method | Route | Cache | Notes |
|---|---|---|---|
| GET | `/api/jobs` | 10 min | filters `source`, `location`, `skillIds[]`, `isRemote`, `page`, `pageSize` |
| GET | `/api/jobs/matches` | — | empty list for now (Step 6) |
| GET | `/api/jobs/saved` | — | user's saved jobs |
| GET | `/api/jobs/{id}` | 30 min | detail + description; logs a `Viewed` `user_job_history` row |
| POST | `/api/jobs/{id}/save` | — | toggles `saved_jobs.is_active` (save → unsave → save) |

### Caching design (important)
- List cache key = `jobs:list:{MD5(filter JSON)}`. The cached payload is **user-agnostic**
  (`isSaved=false`); each user's saved flags are overlaid **after** the cache read. So a cached list
  is shared safely across users without leaking one user's saves into another's.
- `GetJobByIdAsync` caches the (user-agnostic) detail under `jobs:detail:{id}`, then overlays
  `isSaved` and writes the `Viewed` history row.
- The fetch worker (`JobFetchService`, Step 4) already deletes `jobs:list:*` after inserting new jobs
  → no stale lists. (Item 6 satisfied — the call lives in the shared service the worker runs.)

---

## Frontend (`jobping-ui/`)

| File | Role |
|---|---|
| `services/job.service.ts` | `getJobs`, `getJobById`, `getSavedJobs`, `saveJob` |
| `pages/jobs/jobs-list/jobs-list.component.ts` | List + filters + pagination |
| `pages/jobs/job-detail/job-detail.component.ts` | Detail + apply + save |
| `pages/dashboard/dashboard.component.ts` | Count + 3 recent + last-updated |
| `utils/time-ago.ts` | "5 minutes ago" helper |
| `app.routes.ts` | `jobs` / `jobs/:id` now point to real components |

- **Jobs list:** sidebar (source All/Remotive/Arbeitnow/WWR, remote-only, location chips), job cards
  (company initials, title→detail link, source badge, skill tags, ★ save toggle, time-ago),
  pagination, loading skeleton, empty state.
- **Job detail:** back button, title + badges, skill chips, `[innerHTML]` description (Angular
  sanitizes), "Apply Now" opens `sourceUrl` in a new tab, save toggle.
- **Dashboard:** indexed-job count + 3 most recent (one `GET /api/jobs?pageSize=3` call).
  "Jobs last updated" is derived from the newest job's `fetchedAt` (no extra endpoint added).

---

## Swagger — all 5 job endpoints

Open `https://localhost:7230/swagger`. Under **Jobs** you'll see these 5 operations. Click
**Authorize** (top-right) and paste a Bearer token first — every endpoint is 🔒.

### 1. `GET /api/jobs` — paginated, filtered list
Query params (all optional): `source`, `location`, `skillIds` (repeatable), `isRemote`, `page`, `pageSize`.
```
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5052/api/jobs?page=1&pageSize=5"
```
200 response:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 142, "title": "Senior .NET Developer", "company": "Techwave",
        "source": "Remotive", "sourceUrl": "https://remotive.com/...",
        "location": "Europe", "isRemote": true, "jobType": "full_time",
        "minSalary": null, "maxSalary": null, "fetchedAt": "2026-06-19T10:00:00Z",
        "skills": [".NET Core", "PostgreSQL"], "matchPercentage": null, "isSaved": false
      }
    ],
    "totalCount": 293, "page": 1, "pageSize": 5, "totalPages": 59
  },
  "message": null
}
```

### 2. `GET /api/jobs/matches` — top matches (Step 6)
```
curl -H "Authorization: Bearer <token>" "http://localhost:5052/api/jobs/matches"
```
```json
{ "success": true, "data": [], "message": null }   // empty until the matching engine lands
```

### 3. `GET /api/jobs/saved` — the user's saved jobs
```
curl -H "Authorization: Bearer <token>" "http://localhost:5052/api/jobs/saved"
```
```json
{ "success": true, "data": [ { "id": 142, "title": "...", "isSaved": true, ... } ], "message": null }
```

### 4. `GET /api/jobs/{id}` — detail (+ description)
```
curl -H "Authorization: Bearer <token>" "http://localhost:5052/api/jobs/142"
```
```json
{
  "success": true,
  "data": {
    "id": 142, "title": "Senior .NET Developer", "company": "Techwave",
    "source": "Remotive", "isRemote": true, "jobType": "full_time",
    "skills": [".NET Core", "PostgreSQL"], "isSaved": false, "matchPercentage": null,
    "description": "<p>We are looking for…</p>"
  },
  "message": null
}
```
404 when the id doesn't exist: `{ "success": false, "data": null, "message": "Job 999 was not found." }`

### 5. `POST /api/jobs/{id}/save` — toggle saved
```
curl -X POST -H "Authorization: Bearer <token>" "http://localhost:5052/api/jobs/142/save"
```
```json
{ "success": true, "data": null, "message": "Save state toggled." }
```

---

## After building

### Run
```powershell
# Redis must be up for the job caches:
docker run -d -p 6379:6379 redis:7-alpine
dotnet run --project src/JobPing.API --launch-profile http   # http://localhost:5052
cd jobping-ui; ng serve                                       # http://localhost:4200
```

### Test pagination
```
GET /api/jobs?page=1&pageSize=5    → 5 items, totalCount, totalPages
GET /api/jobs?page=2&pageSize=5    → next 5
```

### Test filtering
```
GET /api/jobs?source=Remotive&isRemote=true
GET /api/jobs?skillIds=1&skillIds=2          (Angular or .NET, e.g. Angular + .NET Core)
GET /api/jobs?location=Europe
```

### Verify caching works
1. First `GET /api/jobs?page=1&pageSize=5` → API logs show the SQL `SELECT` (cache miss → DB).
2. Identical call again → **no SQL** in logs (served from Redis `jobs:list:<hash>`).
3. Inspect: `redis-cli KEYS jobs:list:*` shows the cached key; `TTL <key>` ≈ 600s.
4. Run the fetch worker → `jobs:list:*` keys are deleted → next list call rebuilds from DB.

### Known notes
- Needs Redis (cache is a hard dependency here, matching the project spec).
- `matches` endpoint returns `[]` until Step 6 (matching engine).
