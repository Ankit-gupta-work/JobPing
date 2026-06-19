# Step 4 — FetchJobs Background Worker

**Status:** ✅ Complete · Build: 0 warnings / 0 errors · No new migration · Parsers validated vs live APIs

Background worker pulls jobs from 3 free sources every 2 hours → dedupe → tag skills → store.
Worker and a manual admin endpoint share one `JobFetchService`.

---

## What was built

| File | Role |
|---|---|
| `ExternalClients/RemotiveClient.cs` | Typed HttpClient + `RemotiveJob`/`RemotiveResponse` |
| `ExternalClients/ArbeitnowClient.cs` | Typed HttpClient + `ArbeitnowJob`/`ArbeitnowResponse` |
| `ExternalClients/WWRRssClient.cs` | HttpClient + `System.Xml.Linq` RSS parser → `WWRJob` |
| `Services/JobMappingService.cs` | Each source → `Job` entity (truncates to column sizes) |
| `Services/SkillMatcher.cs` | Skill IDs by case-insensitive substring in title+description |
| `Services/JobFetchService.cs` | **The pipeline** (`IJobFetchService`) |
| `Services/LoggingMessagePublisher.cs` | RabbitMQ stub — logs `job.fetched` until Step 7 |
| `Workers/FetchJobsWorker.cs` | `BackgroundService` + `PeriodicTimer(2h)` |
| `Controllers/AdminController.cs` | `POST /api/admin/fetch-jobs` [Admin] |
| `Program.cs` | Typed clients (30s timeout), DI, `AddHostedService`, `RoleClaimType="role"` |

Worker and admin endpoint call the **same** `JobFetchService` — logic exists once. The Redis lock
lives in the service, so a manual trigger can't run concurrently with a scheduled tick.

### Pipeline (per run)
1. Acquire Redis lock `lock:fetch-jobs` (90-min TTL). Held → log "skipping", return 0.
2. `background_tasks` (`FetchJobsTask`) → status `Running`.
3. Per source: fetch → map → dedupe on `(external_id, source)` → insert new only.
4. Per new job: extract skills → save `job_skills` → publish `job.fetched` (logged for now).
5. Invalidate Redis `jobs:list:*` → status `Success`, `next_run_at = +2h` → release lock.
6. Error → status `Failed` + `last_error_msg`; lock always released; worker keeps looping.

---

## After building

### Trigger manually via Swagger
1. Redis must be up: `docker run -d -p 6379:6379 redis:7-alpine`
2. `dotnet run --project src/JobPing.API --launch-profile http`
3. Authorize with an **Admin** JWT (role claim required):
   ```json
   { "nameid": "1", "role": "Admin", "iss": "jobping-api", "aud": "jobping-client", "exp": 1797000000 }
   ```
4. `POST /api/admin/fetch-jobs` →
   ```json
   { "success": true, "data": { "newJobs": 142 }, "message": "Fetch complete — 142 new job(s) inserted." }
   ```
> The worker also auto-runs ~immediately on API startup, so logs show a fetch even without the endpoint.

### Log output to expect
```
info: FetchJobsWorker started — interval 2h.
info: FetchJobs: starting run (lock acquired).
info: FetchJobs[Remotive]: fetched 100, inserted 100 new.
info: [RabbitMQ stub] would publish job.fetched → ... payload={ jobId=1, source=Remotive }
info: FetchJobs[Arbeitnow]: fetched 100, inserted 98 new.
info: FetchJobs[WWR]: fetched 100, inserted 95 new.
info: FetchJobs: completed. 293 new jobs inserted.
```
Lock busy: `FetchJobs: lock held by another run — already running, skipping.`

### Verify jobs in DB
```sql
SELECT source, COUNT(*) FROM jobs GROUP BY source;
SELECT id, source, title, company, is_remote FROM jobs ORDER BY fetched_at DESC LIMIT 10;
SELECT COUNT(*) FROM job_skills;
SELECT task_name, last_status, last_run_at, next_run_at FROM background_tasks WHERE task_name='FetchJobsTask';
```

### Deduplication — how + verify
Job identity = **(external_id, source)** (Remotive `id`, Arbeitnow `slug`, WWR `guid`). Before insert:
```csharp
var exists = await _db.Jobs.AnyAsync(j => j.ExternalId == job.ExternalId && j.Source == job.Source);
if (exists) continue;   // never updates existing jobs
```
Enforced twice: this code check + the `UNIQUE(external_id, source)` index (race-proof).

**Verify:** call `POST /api/admin/fetch-jobs` twice.
- 1st → `newJobs ≈ 293`; 2nd → `newJobs: 0`.
- `SELECT COUNT(*) FROM jobs;` is identical before/after the 2nd run.

### Live-validation note
Couldn't run the full pipeline here (Redis was down, no Docker). Validated the 3 parsers against the
**real** APIs instead: Remotive, Arbeitnow (100 jobs), WWR RSS (`"Company: Job Title"` split confirmed).

### Known limitation
Skill match is plain case-insensitive `Contains` (per spec) → short names like `"Go"`/`"Java"`
over-match (e.g. "Java" inside "JavaScript"). Tighten to word-boundary later if desired.
