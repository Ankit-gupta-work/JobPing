# JobPing — Build Steps

One markdown per build step. Each file = what was built + the "after building, show me…"
deliverables (how to run, endpoints to test, how to verify).

For the high-level "understand + test" overview, see [`../NOTES.md`](../NOTES.md).
For the full spec, see [`../CLAUDE.md`](../CLAUDE.md).

| Step | Title | Status | File |
|---|---|---|---|
| 1 | Master Data APIs + Redis cache | ✅ | [step-1-master-data.md](step-1-master-data.md) |
| 2 | User Preferences API | ✅ | [step-2-preferences.md](step-2-preferences.md) |
| 3 | Angular onboarding wired to APIs | ✅ | [step-3-angular-onboarding.md](step-3-angular-onboarding.md) |
| 4 | FetchJobs background worker | ✅ | [step-4-fetch-jobs-worker.md](step-4-fetch-jobs-worker.md) |
| 5 | Jobs API + Redis cache + UI | ✅ | [step-5-jobs-api.md](step-5-jobs-api.md) |
| — | AuthController (register/login/JWT) | ⏳ next | — |
| 6 | Matching engine | ⏳ | — |
| 7 | RabbitMQ + alert + mail workers | ⏳ | — |
| 8 | Docker Compose (all services) | ⏳ | — |
| 9 | Deploy | ⏳ | — |
| 10 | GitHub Actions CI/CD | ⏳ | — |

> Stack: .NET 9 Web API · PostgreSQL 15 · Redis 7 · EF Core 9 · Angular 21 (Tailwind 3 + Material).
> (Originally specced for .NET 8 / Angular 18 — bumped to 9 / 21 early on; CLAUDE.md updated to match.)
