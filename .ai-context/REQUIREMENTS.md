# REQUIREMENTS.md

Status per CLAUDE.md build order (§16). ✅ Done · 🟡 Partial · ❌ Not started.

## Step 1 — Master Data APIs + Redis Cache ✅
`/api/master/{skills,locations,experiences}`, all public, 24h Redis cache.
Matches spec.

## Step 2 — User Preferences API ✅
Full CRUD under `/api/preferences`. Delta updates for skills/locations
junction rows (verified, doesn't wipe-and-reinsert). Cache invalidation of
`user:matches:{userId}` on change (target key exists; nothing populates it
yet since matching isn't built — see Step 6).

## Step 3 — Angular Onboarding wired to real APIs ✅
4-step register flow (account → skills → preferences → notifications) calls
real `/api/auth/register`, `/api/master/*`, `/api/preferences`. Landing,
login, register, guards, interceptor all built.

## Step 4 — FetchJobsWorker ✅
Remotive + Arbeitnow + WWR RSS all three sources (spec only mandated
"Remotive first" — all three shipped). Redis lock, dedup via
`(external_id, source)`, skill extraction, `background_tasks` status tracking.
`job.fetched` "publish" is currently just a log line (LoggingMessagePublisher
stub) — real RabbitMQ publish is Step 7.

## Step 5 — Jobs API + Redis Cache ✅
`/api/jobs` (paginated+filtered, 10min cache), `/api/jobs/{id}` (30min cache,
logs "Viewed" history), `/api/jobs/{id}/save` (toggle), `/api/jobs/saved`.
`/api/jobs/matches` exists as a route but returns empty — real matching is
Step 6. jobs-list + job-detail Angular pages built and wired.

## Auth (register/login/JWT) ✅ — not in original numbered steps, built early
`/api/auth/{register,login,refresh,revoke,me}`. BCrypt hashing, JWT
access+refresh rotation, same error message for bad email/password, JWT
blacklist via Redis on revoke (`JwtBlacklistMiddleware`, fails open if Redis
down). Admin role claim works (`role_id=1` → `/api/admin/fetch-jobs`).

## Step 6 — Matching Engine ✅ (2026-09-24)
`IMatchingService`/`MatchingService` built. `CalculateMatchScore` is the
spec's exact formula (`overlap / jobSkillIds.Count * 100`, rounded, 0 if
the job has no skills). `GetTopMatchesAsync(userId, limit=20)`: cache-aside
on `user:matches:{userId}` (15min TTL, matches §12) → on miss, loads the
user's skill ids and `MinMatchPercentage` (defaults to 50 when no
`UserProfile` row exists yet, same convention as `PreferenceService`),
scores every active job in memory, filters by threshold, ranks by
score-then-recency, takes `limit`. `JobsController.GetMatches()` now calls
it for real instead of returning a hardcoded empty list.
`PreferenceService` was *already* invalidating `user:matches:{userId}` on
every preference change (written before this service existed, ready and
waiting) — no changes needed there.

Not implemented, deliberately: location/salary filtering in the ranking
(the CLAUDE.md spec's match formula and MatchAndAlertWorker description
are purely skill-based; adding filters not in the spec would be scope
creep). Scoring is done in-memory over all active jobs rather than in SQL
— matches the simple, non-scaled style CLAUDE.md's own MatchAndAlertWorker
uses, appropriate at this project's real scale; would need revisiting
(a SQL-side aggregate, or moving scoring into the fetch/match pipeline) if
the jobs table ever grew into the tens of thousands.

## Step 7 — RabbitMQ + Alert + Mail Workers ✅ (2026-09-24)
Built per the corrected CLAUDE.md §10/§11 (see DECISIONS.md 2026-09-23 for
what was wrong with the original design and why it was rewritten before
any of this was coded).

- `RabbitMqTopology` (Infrastructure/Messaging) — single source of truth
  for exchange/queue names + `DeclareAll(IModel)`, shared by the publisher
  and all three consumers so the topology is never hand-rolled twice.
- `RabbitMQPublisher` replaces `LoggingMessagePublisher` (deleted — fully
  superseded). Lazily connects, **fails soft**: if RabbitMQ is unreachable,
  a publish is logged and dropped rather than throwing — same
  availability-over-strict-guarantee stance as `JwtBlacklistMiddleware`'s
  Redis fail-open behavior. A dropped `job.fetched` just means that one job
  doesn't get matched until something else touches it; it doesn't take the
  API down.
- `MatchAndAlertWorker` — consumes `jobs.new`. Per job: scores it against
  every active, email-opted-in user (`CalculateMatchScore` from Step 6's
  `IMatchingService`, not reimplemented), skips users already alerted for
  that job (`alert_history` dedup), inserts `mail_queue`
  (`status=Pending`) + `alert_history` (`status=Sent`) + `notifications`
  rows, publishes `email.send`. Malformed/failed messages `nack` with
  `requeue: true` (this queue has no DLX configured — a genuine processing
  error should retry via redelivery, not vanish).
- `MailWorker` — consumes `email.send`. Implements the corrected retry
  ladder exactly: attempt count from `mail_queue.no_of_attempts`, not the
  message; on failure, republishes to `email.retry.5s` → `email.retry.30s`
  → `email.dead` by attempt number; **always acks the original message**,
  success or failure — never relies on RabbitMQ redelivery for retries.
  The retry-queue publish is done directly on the worker's own channel
  (not through `IMessagePublisher`) since it's retry-ladder plumbing
  specific to this worker, not a general business event.
- `DeadLetterHandler` — consumes `email.dead`. Logs the permanent failure
  and idempotently confirms `mail_queue.status = Failed` (safety net —
  `MailWorker` already set this; here in case that write itself failed).
- `IEmailService`/`SendGridEmailService` — real SendGrid API call via the
  already-referenced `SendGrid` NuGet package. `appsettings.Development.json`
  has an **empty** `SendGrid:ApiKey`, so real sends will legitimately fail
  with a 401 until a real key is configured — that's correct behavior, not
  a bug, and a good way to see the retry ladder actually exercise itself.

**Not implemented, deliberately:** `notification.exchange`/
`notification.create`/a `NotificationWorker` consumer are declared in the
topology (matches the architecture diagram) but nothing publishes to them
— `MatchAndAlertWorker` follows §10's literal steps and inserts the
`notifications` row directly in the same DB transaction as the alert,
rather than round-tripping through a queue for something already
happening in-process. `IMessagePublisher.PublishNotificationAsync` is
still fully implemented for interface completeness, just unused by the
current flow.

**Verified live end-to-end on 2026-09-24** (Postgres native service, Redis
container, `jp-rabbitmq` container, and the API all run at once — see
PENDING.md for exact commands). Real run against Remotive/Arbeitnow/WWR:
239 new jobs → 239 `job.fetched` messages consumed by
`MatchAndAlertWorker` (queue drained to 0) → 62 real matches → 62
`alert_history`/`notifications`/`mail_queue` rows written correctly. Then
manually replayed one `mail_queue` row through `email.send` (via the
RabbitMQ HTTP API) with a syntactically-valid-but-fake SendGrid key to
force a real `401` instead of a same-node connection failure, and watched
the full retry ladder fire for real: attempt 1 fails → republished to
`email.retry.5s` → TTL expiry → attempt 2 fails → republished to
`email.retry.30s` → TTL expiry → attempt 3 fails → `mail_queue.status`
→ `Failed` with the actual SendGrid error text captured → message lands
on `email.dead` → `DeadLetterHandler` logs it. Exactly the designed
behavior, timed exactly as the 5s/30s ladder specifies.

**One real bug found and fixed by this test, not by review:**
`MailWorker.OnMessageReceived` only wrapped the `SendAsync` call in
try/catch — DI resolution and the DB lookup were unprotected. With no
SendGrid key configured, `new SendGridClient("")` throws inside
`SendGridEmailService`'s constructor, and that exception occurred before
the wrapped section, escaped the handler entirely, and was silently
swallowed by RabbitMQ.Client's consumer dispatch: no ack, no nack, no log,
no crash — 68 messages just sat un-processed with `mail_queue.no_of_attempts`
never leaving 0, indistinguishable from "nothing is happening" until
checked directly. `MatchAndAlertWorker`/`DeadLetterHandler` already wrapped
their entire handler bodies and were unaffected. Fixed by wrapping all of
`MailWorker`'s handler in an outer try/catch that logs and
`nack(requeue:false)`s on anything outside the legitimate-send-failure
retry ladder — an unrecoverable config/DI error shouldn't spin-retry
forever, it should drop that delivery loudly and leave the `mail_queue`
row for manual recovery once the actual config is fixed.

Test artifacts intentionally left in the dev DB as-is (not cleaned up):
68 `mail_queue` rows from the first live run sit at `status=Pending`,
`no_of_attempts=0` — their RabbitMQ messages were dropped by the bug
above before the fix landed, so nothing will pick them up again without
manually republishing. `mail_queue.id=1` (the real welcome-email row from
registration) now shows `status=Failed` from the manual retry-ladder test.
Harmless local dev data — the user can wipe it whenever they reset the
dev DB.

## AlertsController + NotificationsController ✅ (2026-09-25)
Not one of the 10 numbered CLAUDE.md steps, but PENDING.md's natural
follow-up to Step 7 now that `alert_history`/`notifications` have real
rows. Per CLAUDE.md §9: `IAlertService`/`AlertService.GetAlertHistoryAsync`
(join to `jobs` for title/company/sourceUrl, same `AsNoTracking().Select()`
pattern as `JobService`), `INotificationService`/`NotificationService`
(`GetNotificationsAsync` with `?unread=true` support, `MarkAsReadAsync`,
`MarkAllAsReadAsync`). New DTOs under `Application/DTOs/Alerts/`.

**Verified live**, not just built: registered a throwaway test user via
`/api/auth/register`, hit `GET /api/alerts`, `GET /api/notifications`, and
`PATCH /api/notifications/read-all` with its real JWT — correct
`{success,data,message}` envelope and empty arrays for a user with no
history. Then verified the join logic itself directly against the real
62-row dataset from Step 7's live test (user id 6, 26 real alert rows) —
correct job titles/companies/match-scored notification titles came through
via SQL equivalent to the EF query, confirming the untested-via-HTTP path
(no real user's password was available to log in as them) still produces
correct data.

**Frontend wired too**, closing the loop from the redesign sessions:
`alert.service.ts`, `notification.service.ts` (new — `models/index.ts`
gained `AlertHistoryItem`/`Notification`), `AlertsComponent`'s history
section (was a permanent honest empty-state, now calls `GET /api/alerts`
and renders real rows via the `.alert-row`/`.alert-meta` classes that were
added — unused — during the responsive pass specifically for this),
`NotificationDropdownComponent` (was a permanent "no notifications"
stub, now fetches real notifications on open, shows an unread-count badge
on the bell, supports mark-one/mark-all-read with optimistic UI + rollback
on failure, same pattern as every other optimistic update in this
codebase). `ng build` passes clean.

## Step 8 — Docker Compose (all 6 services) ✅ (2026-09-26)
Built and **verified live** — `docker compose up -d` brings up all 6
services (api, worker, db, redis, rabbitmq, nginx), and a real end-to-end
run (346 real jobs fetched, matched, and correctly zero-alerted against a
fresh empty-of-users DB) proved the whole chain works, not just that it
compiles.

**Three real bugs found and fixed by actually running it, none of which
`dotnet build`/`ng build` could have caught:**
1. **Container port mismatch.** `mcr.microsoft.com/dotnet/aspnet:9.0`
   defaults to `ASPNETCORE_HTTP_PORTS=8080` since .NET 8, not 80 — CLAUDE.md's
   `EXPOSE 80` / compose's `"5000:80"` / nginx's `server api:80` all silently
   assumed port 80. nginx returned 502 until `ENV ASPNETCORE_HTTP_PORTS=80`
   was added to the Dockerfile.
2. **`Redis__Password` was never passed to `api`/`worker`.** CLAUDE.md's own
   docker-compose spec sets `--requirepass` on the redis service but never
   passes the password to the app services that connect to it — every Redis
   op would have silently auth-failed in that config (caught by cross-checking
   the spec while assembling the file, before it was ever run).
3. **`JobFetchService`'s Redis lock could be orphaned.** The "mark
   background_task as Running" DB write happened *before* the try/finally
   that releases the lock. Against a freshly-migrated-but-not-yet-schema'd
   compose DB, that write threw ("relation background_tasks does not
   exist"), the exception skipped the finally entirely, and `lock:fetch-jobs`
   sat held for its full 90-minute TTL with nothing actually running.
   Fixed by moving lock acquisition to cover everything, including that
   first write. Manually cleared the orphaned lock (`redis-cli DEL
   lock:fetch-jobs`) to confirm the fix — re-ran, worked, released
   correctly.

**Also fixed:** `jobping-ui/package-lock.json` was out of sync with
`package.json` (leftover from installing/uninstalling icon libraries in an
earlier session) — `npm ci` (which Docker/CI always uses for
reproducibility, unlike the `npm install` used everywhere so far) failed
outright. Regenerated from a clean `node_modules`. Separately, the
*production* Angular build config had never actually been exercised before
(every prior verification used `--configuration development`) — its
font-inlining optimization tries to fetch Google Fonts at *build* time,
which failed inside the Docker build sandbox; disabled font inlining
(`optimization.fonts: false`) rather than depend on build-time internet
access, which is fragile for Docker/CI either way. Also added the
`environment.prod.ts` + `angular.json` `fileReplacements` that never
existed — without it, the containerized build would have hardcoded
`http://localhost:5052/api`, unreachable from another user's browser.

**Deviations from the literal CLAUDE.md spec, documented in DECISIONS.md:**
nginx builds the actual Angular app (multi-stage, node+nginx) instead of a
bare `image: nginx:alpine` that was never going to serve anything but the
default nginx page; nginx.conf is HTTP-only for now (no SSL block — no
real cert exists since Step 9/jobping.dev hasn't happened, and a fake one
would just be an untested half-measure); `Program.cs` gained a `RUN_MODE`
split so `api`/`worker` are genuinely separate processes per the spec's own
two-container design, gated to only apply outside Development so every
prior single-process local-dev session's behavior is unaffected; `db`
service temporarily exposes `5433:5432` to the host for running
`dotnet ef database update` (Production deliberately never
auto-migrates, per coding rule 14) — worth reconsidering before an actual
public deployment.

**Not done:** `docker-compose.override.yml` (mentioned in CLAUDE.md's file
tree, no actual content ever specified for it — nothing concrete to
build). SSL/HTTPS (Step 9's job). Whether to keep or drop the `db` port
exposure long-term.
Currently run via `dotnet run` + standalone Postgres/Redis containers.

## Step 9 — Deploy to live server ❌
Not started. No deploy target configured, jobping.dev not live.

## Step 10 — GitHub Actions CI/CD ❌
Not started. No `.github/workflows/` directory exists.

## Frontend — dashboard/jobs/saved/alerts/preferences UI (2026-09-23) ✅ (adapted)
Built per `JobPing_Vision_Prompt.md`'s frontend design prompt: `AppLayoutComponent`
(sidebar + top bar + mobile bottom tab bar), `JobCardComponent`,
`MatchBadgeComponent`, `SkillChipComponent`, `StatCardComponent`,
`EmptyStateComponent`, `LoadingSkeletonComponent`, `NotificationDropdownComponent`.
Dashboard/Jobs List/Job Detail rebuilt on the new shell; `/saved` and
`/preferences` are now real pages wired to their (already-working) backend
APIs; `/profile` still routes to a shared placeholder (not in the page list
that prompt asked for).

**Deliberately adapted, not built as literally specced, where the backend
doesn't exist:** `/alerts` shows real preference settings but an honest
"no alerts sent yet" empty state instead of calling a nonexistent
`GET /api/alerts` — there is no `alert.service.ts`. `NotificationDropdownComponent`
is a real, wired bell/panel but always shows "no notifications" — no
`GET /api/notifications` call, since `NotificationsController` doesn't exist.
Dashboard's "Alerts sent"/"Match rate" stat cards show real zero/dash state
with a "ships in Step X" caption rather than inventing numbers. Skills tab
on Preferences is a flat grid, not grouped by category — `Skill` has no
category field in the schema. Job list's search box and sort dropdown are
not built — no backend support for either. `job.service.ts` gained a real
`getJobMatches()` call to the existing (empty-for-now) `/api/jobs/matches`
route.

`app.routes.ts` was touched narrowly — `saved`/`alerts`/`preferences`
routes now `loadComponent` their real pages instead of the shared
`PlaceholderComponent`; route structure/guards otherwise untouched.

## Frontend — visual redesign + light/dark theme (2026-09-24)
Full visual rewrite of Dashboard/Jobs List/Job Detail/Saved/Alerts/
Preferences/Placeholder per a second pasted design prompt: new CSS variable
system in `_variables.css` (light-mode default tokens + a `[data-theme="dark"]`
override block), new class-based `_globals.css` (`.card`, `.stat-card`,
`.job-card`, `.tab-bar`, `.filter-chip`, `.toggle`, `.empty-state`, etc.,
replacing the old Tailwind-utility-heavy approach for these pages), Inter +
JetBrains Mono fonts (was Outfit + DM Mono — swapped in the shared
`@import`, so it also applies to untouched pages), and a `ThemeService`
(`src/app/services/theme.service.ts`) + toggle button in `AppLayoutComponent`,
default dark, persisted to `localStorage`, initialized from `AppComponent`.

**Landing/login/register/onboarding were left untouched** (not in the
redesign's page list) — they still use the old dark-only design system
(`.text-gradient`, `.glow-orb`, `.chip`/`.chip-active`, etc.), which is why
`_variables.css`/`_globals.css` carry an explicit "legacy" block preserving
those old token names/classes rather than deleting them. Those 3 pages
still contain emoji (landing: 2, login: 2, register: 3) — out of scope for
this pass, not missed.

**`@lucide/angular` was installed then removed.** It ships as a single
12.5MB `fesm2022` bundle with no per-icon subpath exports; Angular's esbuild
pipeline couldn't tree-shake the Angular-decorated icon classes out of it,
so importing even a handful of icons added ~14.8MB to whatever lazy chunk
used them. Replaced with `src/app/components/icon/icon.component.ts` — a
small `<app-icon name="...">` wrapper with inline SVG paths sourced from
Lucide's open icon set, adding a few KB instead. If a future session
reaches for an icon library again, verify tree-shaking with a real build
(check lazy chunk sizes) before committing to the approach — don't trust
`sideEffects: false` in package.json alone.

**Worker status bar shows a derived, not literal, "last synced".** The
prompt's checklist said it should show "real data from `background_tasks`" —
no endpoint exposes that table to the frontend, so (same policy as the
prior session) it's derived from the most recent indexed job's `fetchedAt`
instead of faking a call to a route that doesn't exist.

**Mobile navigation:** the redesign's own CSS only hides `.sidebar` under
768px with no replacement, which would leave mobile with no primary nav.
Kept a small bottom tab bar (scoped styles in `AppLayoutComponent`, not
part of the prompt's global CSS) so mobile isn't regressed.

**Follow-up same day: landing/login/register brought onto the new system
too**, on request (the redesign prompt hadn't listed them). Same logic in
all three, template/styling only. Landing dropped `.text-gradient` for
`var(--accent)` used sparingly (matches the new system's own stated
philosophy — a gradient hero treatment reads as exactly the "vibe-coded"
look the redesign brief was reacting against). Login/register moved from
the old split-panel-with-glow-orb layout to a centered card, consistent
with the new minimal aesthetic (no `.glow-orb` equivalent exists in the new
system, and re-inventing one for just these two pages wasn't worth it for
a decorative flourish). Register's `🎉` in a success snackbar was the last
emoji in the whole app — removed. Once all 9 pages were on the new system,
the "legacy" CSS block/tokens preserved earlier in `_variables.css`/
`_globals.css` (`.text-gradient`, `.glow-orb`, `.chip`, `--bg-base`,
`--accent-light`, etc.) were verified fully unreferenced (`grep` across
`src/app`) and deleted rather than left as dead code.

Full app-wide sweep confirms **zero emoji remain in any `.ts` file**, and
`ng build` passes clean with the largest lazy chunk still 292KB.

## Frontend — responsive pass (2026-09-24, same day)
Third pasted prompt, scoped to layout/breakpoints only (no color/typography/
logic changes, per the prompt's own instruction). Added a real mobile →
tablet (icon-only sidebar, 768–1023px) → desktop (full sidebar) breakpoint
system to `AppLayoutComponent`/`_globals.css`: `--sidebar-width-tablet`
(56px, replaces the old single `--sidebar-width`) / `--sidebar-width-desktop`
(220px), `--bottom-bar-height`, `--screen-sm/md/lg/xl` tokens. Sidebar links
now carry `[attr.data-label]` for a CSS-only hover tooltip on tablet where
labels are hidden. My earlier `.mobile-tabbar` (scoped component styles,
built in the redesign pass before this system existed) was replaced by the
prompt's own `.bottom-bar`/`.bottom-tab` global classes.

Jobs List gained real mobile UX: a horizontal-scroll filter chip bar plus a
bottom-sheet filter panel (`.bottom-sheet`/`.bottom-sheet-overlay`, toggles
`body.sheet-open` to lock background scroll) on top of the existing desktop
filter sidebar — same underlying filter state/API calls, no new endpoints.
Numbered pagination added for desktop/tablet (`.pagination-desktop`, a
computed 5-page sliding window) alongside the existing mobile Prev/Next.

Dashboard's "Your top matches"/"Recently fetched" moved from a single
stacked `.job-list` to `.matches-grid` (1/2/3 responsive columns) and
`.recent-scroll` (horizontal scroll on mobile, 3-col grid tablet+). Job
Detail's two-column Tailwind grid became `.job-detail-layout` (stacked
mobile with the match/apply panel pushed above the description via
`order: -1`, side-by-side from 768px). Job cards get 2-line title clamping
and hidden skill tags below 640px to stay compact on phones.

Preferences/Alerts/Saved needed **no template changes** — they already used
the shared `.tab-bar`/`.settings-row`/`.job-list` classes from the redesign
pass, so the new responsive rules apply automatically.

`ng build` passes clean; largest lazy chunk unchanged at 292KB (this pass
was CSS/template restructuring, no new dependencies).
