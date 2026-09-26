# PENDING.md

Prioritized task list. Update as tasks complete or priorities shift.

~~Untrack `appsettings.Development.json` from git~~ — **done**
(2026-09-26), commit `c43c6af` (local only, not pushed yet — see below).
Turned out the real DB password (`ankit123`) had never actually been
pushed — the public GitHub repo still had the original placeholder
(`Password=password`) from the initial commit, so this closed the gap
before it ever leaked, not after.

- **The dev JWT secret string is still live on the public GitHub repo**
  (`Ankit-gupta-work/JobPing`, confirmed public via the GitHub API) —
  it was in the very first commit, before this session's `.gitignore` fix
  existed to prevent it. Low real risk (obviously a "Dev..."-prefixed
  placeholder value, never used for anything but local dev, not a
  production secret), but it's still sitting in public history. Untracking
  going forward doesn't remove it from history — that needs either (a)
  rotating the string to a new value (cheap, doesn't touch history, just
  makes the old public one useless) or (b) a full history rewrite +
  force-push (higher effort, and force-pushing a public repo needs
  explicit confirmation before ever attempting it — not something to do
  as a side effect of a "clean up secrets" task). Recommend (a) unless the
  user specifically wants the string gone from history too.
- **Local commit `c43c6af` (the gitignore/untrack fix) has not been
  pushed.** It only exists locally right now — confirm with the user
  before pushing, since it changes the public repo's tracked file list.

~~Build the Matching Engine (Step 6)~~ — **done** (2026-09-24). See
REQUIREMENTS.md.

## P1
~~RabbitMQ + MatchAndAlertWorker + MailWorker (Step 7)~~ — **done and
verified live** (2026-09-24). See REQUIREMENTS.md for the full test
results (239 real jobs matched, retry ladder timed and confirmed, one real
bug found and fixed by the test). To run the full stack locally:
Postgres runs as a native Windows service already; Redis is
`docker start redis`; RabbitMQ needs
`docker run -d --name jp-rabbitmq -p 5672:5672 -p 15672:15672 -e
RABBITMQ_DEFAULT_USER=guest -e RABBITMQ_DEFAULT_PASS=guest
rabbitmq:3-management` the first time, `docker start jp-rabbitmq` after
(no `--restart` policy on any of these yet — they all need manually
restarting after a machine/Docker Desktop restart, same gap noted for
Redis in an earlier session). Docker Desktop itself isn't set to
autostart either.

~~AlertsController + NotificationsController~~ — **done and verified**
(2026-09-25). See REQUIREMENTS.md. Frontend also wired: `alert.service.ts`,
`notification.service.ts`, `AlertsComponent`'s history section, and the
notification bell dropdown all now call the real endpoints instead of
showing the honest "not built yet" empty states from the redesign
sessions.

~~Wire up Angular `/preferences` page~~ — **done** (2026-09-24). Full tabs
UI, wired to the real `PreferencesController`.
~~Wire up Angular `/saved` page~~ — **done** (2026-09-24). Wired to the
real `GET /api/jobs/saved`.

~~Docker Compose (Step 8)~~ — **done and verified live** (2026-09-26).
See REQUIREMENTS.md for the full test (346 real jobs through the actual
containerized pipeline) and the 3 real bugs it caught. The compose stack
was left **running** at `http://localhost` after this session — `cd` to
the repo root and `docker compose down` when done with it. `.env` (local,
gitignored, real generated secrets) already exists from this session; a
new local setup should `cp .env.example .env` and fill in real values.

## P0
- **Live browser QA of the frontend.** Four sessions now (build, visual
  redesign, responsive, this one) have only ever verified the frontend
  with `ng build`/curl-level checks — genuinely never opened in a real
  browser and clicked through. This session tried to close it and
  couldn't: no browser-automation tool was available (checked the
  deferred tool registry directly — only `WebFetch` exists, and it
  explicitly refuses `localhost`). The compose stack is live at
  `http://localhost` right now specifically so this can happen — either
  the user checks it directly, or a future session with real browser
  tooling does. Promoted to P0 since it's now the single largest gap
  between "built" and "actually verified" in the whole project.

## P1
- **Deploy to live server (Step 9)** — depends on Step 8, which is done.
  Needs jobping.dev (or similar) + a real server + a real TLS cert before
  nginx.conf's SSL block can be added back (see DECISIONS.md for why it's
  not there yet).
- **GitHub Actions CI/CD (Step 10)** — depends on Step 8/9. No
  `.github/workflows/` directory exists yet. Note for whoever builds this:
  the CI `dotnet test`/`npm test` steps will need a real Postgres/Redis/
  RabbitMQ available to the runner (or mocks) — nothing in this project
  has real automated tests yet either (separate long-standing gap, never
  explicitly flagged before now).

## P2
- **Redis rate limiting.** Spec'd in CLAUDE.md §12.3 but not implemented —
  no `AspNetCoreRateLimit` wiring found in Program.cs despite being listed
  as a required NuGet package.
- **`/profile` Angular page** — still a placeholder. Never in scope for any
  of the frontend passes so far; lowest priority since nothing downstream
  depends on it. (`/alerts` is done.)
- **Decide whether to keep the `db` service's `5433:5432` host port
  mapping.** Added for local `dotnet ef database update` convenience
  (Production never auto-migrates). Fine for local/dev; worth reconsidering
  before an actual public deployment (Step 9) — no reason to expose the DB
  port on a real server.
- **`docker-compose.override.yml`** — named in CLAUDE.md's file tree but
  no content ever specified for it. Nothing concrete to build unless a
  real dev-vs-prod override need shows up (e.g. hot-reload mounts).
