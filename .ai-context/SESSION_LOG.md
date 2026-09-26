# SESSION_LOG.md

Dated log: what was done, what's next, open questions. Newest at top.

---

## 2026-09-26 (Step 8 — Docker Compose, live-verified; browser QA blocked)
**Done:** Built the full Step 8 stack — `Dockerfile`, `nginx/Dockerfile`
(builds Angular itself, spec never did), `nginx/nginx.conf` (HTTP-only for
now), `docker-compose.yml`, `.env.example`, plus a `RUN_MODE` split in
`Program.cs` so `api`/`worker` are genuinely separate per the spec (gated
to Development-off only — every prior session's plain `dotnet run` still
works unchanged). Actually ran it — `docker compose up -d`, all 6 healthy,
applied migrations against the fresh compose DB, real fetch cycle (346
jobs), watched `MatchAndAlertWorker` process them live inside the
container. Found and fixed 3 real bugs that only running it (not just
building it) could catch: `ASPNETCORE_HTTP_PORTS` defaulting to 8080 not
80 (nginx 502'd until fixed), `Redis__Password` missing from CLAUDE.md's
own api/worker env list despite `--requirepass` being set on redis,
`JobFetchService`'s lock-release try/finally not covering its first DB
write (orphaned a 90-min Redis lock, caught against a not-yet-migrated
DB). Also fixed `package-lock.json` drift (`npm ci` failed, unlike the
`npm install` used everywhere so far) and the production Angular build
config being exercised for the very first time in this project (Google
Fonts inlining needs network *during the build*, failed in the Docker
sandbox — disabled font inlining rather than depend on that).

Verified via curl afterward: index.html serves with correct inlined
critical CSS, JS/CSS chunks load with correct content-types, SPA
client-side routing fallback works, `/api/*` proxies through nginx to the
api container correctly. Full details and every fix in
REQUIREMENTS.md/DECISIONS.md.

**Could not do:** the other half of "do both" — an actual browser
click-through — because no browser-automation tool is available in this
session (checked the deferred tool registry directly; only `WebFetch`
exists, and it explicitly refuses `localhost`). Said so plainly instead of
either skipping it silently or treating the curl-level checks as
equivalent — they prove the serving/routing plumbing works, not that the
UI actually renders or behaves correctly. The compose stack was left
running at `http://localhost` so the user can look themselves.

**Next:** Live browser QA is still the one genuinely unclosed gap across
four frontend-touching sessions now — needs either the user doing it
directly, or a session with real browser tooling available.
`docker-compose.override.yml` was never built (spec names it but never
specifies contents — nothing concrete to build). Step 9 (deploy) is next
in the numbered order once QA closes.

---

## 2026-09-26 (.gitignore / secrets cleanup)
**Done:** Finally acted on the P0 flagged 5 sessions running. Before
touching anything, checked whether this mattered more than assumed: repo
has a real `origin` remote (`Ankit-gupta-work/JobPing`, confirmed **public**
via the GitHub API), and `origin/main` matches local history exactly — so
everything committed so far really is already live on GitHub, not just a
theoretical risk. Good news on inspection: the real DB password
(`ankit123`) was only ever in the *uncommitted* working tree —
`git show origin/main:.../appsettings.Development.json` showed the
original placeholder (`Password=password`) still there. So the fix closed
the gap before that password ever leaked, not after.

Added root `.gitignore` (bin/obj/.vs, `appsettings.*.json` except the safe
`appsettings.json` template, plus standard Angular/env/OS patterns as a
safety net alongside jobping-ui's own). `git rm --cached` on 224 tracked
bin/obj files + `appsettings.Development.json` (files stay on disk, just
untracked). Committed as a single scoped commit (`c43c6af`) — verified
nothing else got swept in; every other in-progress file from prior
sessions is still sitting unstaged, untouched.

**Not done / flagged instead of assumed away:** the dev JWT secret string
*is* already sitting in the first public commit (before any of this
existed to stop it) — noted in PENDING.md with the honest tradeoff
(rotate the string vs. rewrite history + force-push; recommended rotating
since force-pushing a public repo needs explicit confirmation, not
something to bundle into a "clean up secrets" task on my own judgment).
**Did not push `c43c6af`** — it only exists locally; that's a separate
decision for the user since it changes the public repo's tracked file
list.

**Next:** Ask the user whether to push this commit, and whether to rotate
the exposed dev JWT secret. Otherwise unchanged: Step 8 (Docker Compose) is
next in the build order, live browser QA of the frontend is still
outstanding.

---

## 2026-09-25 (AlertsController + NotificationsController)
**Done:** Built the natural Step 7 follow-up — `IAlertService`/`AlertService`,
`INotificationService`/`NotificationService`, `AlertsController`,
`NotificationsController`, new `Application/DTOs/Alerts/` DTOs. Registered
in DI, `dotnet build` clean. Verified live (not just compiled): restarted
the API (Redis/RabbitMQ containers were still up from the prior
verification pass), registered a throwaway test user for a real JWT, hit
all three endpoints over real HTTP — correct envelope, correct empty
states. Since that fresh user had no history, separately verified the
join-based query logic directly against the real 62-row dataset from the
Step 7 test (user id 6) via an equivalent SQL query — confirmed real job
titles/companies/notification text come through correctly, closing the
one gap the HTTP test couldn't reach (no real user's password was
available to log in as them and get their actual data through the API).

Also wired the frontend, since the whole point of the honest-stub design
in the redesign sessions was "ready to swap a real call in the moment
these ship": `alert.service.ts`, `notification.service.ts` (new),
`AlertsComponent`'s history section and the notification bell dropdown
both now call real endpoints instead of showing permanent "not built yet"
empty states. `ng build` passes clean.

Stopped the test API instance afterward. Left the throwaway test user
(`smoketest_step7b@example.com`) in the DB — harmless, same category as
the other test artifacts already noted from the Step 7 verification pass.

**Next:** Step 8 (Docker Compose) is next in the numbered build order.
Standing items unchanged: `.gitignore`/secrets (6 sessions now — this one
included several more `docker run`/`psql` commands touching the same
never-gitignored config) and live browser QA of the frontend (still
`ng build`-only, though the *backend* half of this session's work was
verified live twice now).

---

## 2026-09-24/25 (Step 7 — live verification)
**Done:** Ran the whole stack for real instead of stopping at `dotnet
build`. Docker Desktop wasn't running — started it. No RabbitMQ container
existed at all (first time it's been needed) — created `jp-rabbitmq`.
Discovered Postgres runs as a native Windows service (`postgresql-x64-18`),
not a container — explains why no `jp-postgres` container was ever found
in prior sessions' `docker ps` checks; nothing to fix, just a fact worth
recording so a future session doesn't go looking for a Postgres container
that was never going to exist.

Ran the real fetch pipeline: 239 new jobs from Remotive/Arbeitnow/WWR →
239 `job.fetched` messages → `MatchAndAlertWorker` drained the queue to 0
→ 62 real matches written to `alert_history`/`notifications`/`mail_queue`.
Then found, live, that `MailWorker` was silently wedged — a DI/construction
exception (empty SendGrid key) thrown outside its inner try/catch was
swallowed entirely by RabbitMQ.Client's consumer dispatch, no ack, no nack,
no log, 68 messages stuck at `no_of_attempts=0` indefinitely. This is
exactly the kind of bug `dotnet build` can never catch — full root cause
and fix in REQUIREMENTS.md/the code itself. After fixing, replayed one
message with a fake-but-validly-shaped SendGrid key (temporary — reverted
immediately after) to force a real 401 instead of a constructor throw, and
watched the complete retry ladder fire correctly and on-schedule: attempt
1 → 5s → attempt 2 → 30s → attempt 3 → `Failed`, real SendGrid error text
captured, `DeadLetterHandler` logged it. Every piece of the corrected
§10/§11 design is now proven, not just compiled.

Stopped the test API instance and the temporary key edit was reverted.
Left RabbitMQ/Redis containers running (Postgres was already running as a
service) since restarting them is now a known quick step, not a blocker.
Did not clean up test data in the dev DB (68 orphaned `mail_queue` rows
from before the fix, one manually-failed test row) — harmless, noted in
REQUIREMENTS.md, left for the user to wipe whenever convenient.

**Next:** Same as before this verification pass — AlertsController/
NotificationsController are next and now have real data to read.
`.gitignore`/secrets flagged 5 sessions now. Live browser QA of the
frontend still outstanding (this session only proved the *backend*
actually works live — the frontend claim is still `ng build`-only).

---

## 2026-09-24 (Step 7 — RabbitMQ + Alert + Mail Workers)
**Done:** Built Step 7 against the already-corrected CLAUDE.md §10/§11
design (fixed in an earlier session, before any of this was coded — see
DECISIONS.md 2026-09-23). `RabbitMqTopology` (shared exchange/queue
declarations), `RabbitMQPublisher` (replaces the deleted
`LoggingMessagePublisher`, fails soft if RabbitMQ is unreachable — same
philosophy as the Redis fail-open precedent), `MatchAndAlertWorker`
(consumes `jobs.new`, uses Step 6's `IMatchingService`, dedups via
`alert_history`), `MailWorker` (implements the 3-attempt 5s→30s retry
ladder exactly as corrected, attempt count from `mail_queue.no_of_attempts`
not the message, always acks the original), `DeadLetterHandler` (logging
safety net on `email.dead`), `IEmailService`/`SendGridEmailService` (real
SendGrid call — will legitimately 401 until a real API key is configured,
which is correct, not a bug). One deliberate deviation from the
architecture diagram logged in DECISIONS.md: notifications are inserted
directly by MatchAndAlertWorker per §10's literal steps, not round-tripped
through `notification.exchange`, even though that exchange/queue are still
declared for completeness.

`dotnet build` on the full API project: 0 errors, 0 warnings (fixed 3
nullable-reference warnings by capturing `_channel` into a local after
`Connect()` in all three workers). **Not tested against a live RabbitMQ**
— no container exists locally yet, unlike Redis where one just needed
restarting. Gave the exact `docker run` command in PENDING.md but didn't
run it unprompted, consistent with not touching the user's environment
without being asked.

**Next:** AlertsController + NotificationsController are now genuinely
trivial (PENDING.md P1) — thin reads over tables that actually get
populated now. Docker Compose (Step 8) is next in the numbered build order
after that. Standing items, unchanged: `.gitignore`/secrets (5 sessions
now) and live browser QA of the frontend.

---

## 2026-09-24 (Step 6 — Matching Engine)
**Done:** Built the matching engine per CLAUDE.md §8/§10/§12 —
`IMatchingService`/`MatchingService`, wired into
`JobsController.GetMatches()` (was hardcoded to return `[]`), registered in
`Program.cs`. Cache-aside on `user:matches:{userId}` (15min TTL);
`PreferenceService` was already invalidating that key on every preference
change from a prior session, so it just started working once this landed
— no changes needed there. Verified with a real `dotnet build` this time
(a .NET 10 SDK is now on this machine alongside the 8.0 one from before,
and it can target net9.0 fine) — 0 errors, 0 warnings, both
`JobPing.Infrastructure` alone and the full `JobPing.API` (built to a
throwaway output dir since the real one was locked by a running dev
instance + Visual Studio, not by an actual conflict).

Frontend already has real consumers for this waiting: Dashboard's "New
matches" stat + "Your top matches" section, Jobs List's "Best Matches" tab,
and Job Detail's match-percentage panel all call `getJobMatches()` already
— they were built against the empty-array stub over the last three
sessions and will just start showing real data now.

**Next:** Step 7 (RabbitMQ + MatchAndAlertWorker + MailWorker) is next in
the build order and its P0 blocker (this) is now clear — see PENDING.md.
Same two items as always still open: `.gitignore`/committed secrets
(4 sessions flagged, untouched) and a live browser QA pass on the frontend
(3 sessions of `ng build`-only verification).

---

## 2026-09-24 (UI redesign)
**Done:** Executed a second pasted design prompt ("JobPing UI Redesign") —
full visual rewrite of the 6 pages built the prior session, plus a new
light/dark theme system (dark default, toggle in the top bar, persisted to
localStorage). See REQUIREMENTS.md's new entry for the full breakdown.
Headline technical finding: `@lucide/angular` (installed per the prompt's
Step 1) ships as one un-tree-shakeable 12.5MB bundle — importing it added
~14.8MB to a lazy chunk regardless of how few icons were used. Caught this
via `ng build` chunk-size output, not by assumption. Removed it and built a
small inline-SVG `IconComponent` instead; final build's largest lazy chunk
is 292KB. Also fixed a smaller bug while porting the dashboard: the
worker-status line would have read "...synced 5 minutes ago ago" since
`timeAgo()` already appends "ago". Deleted `navbar.component.ts` — fully
orphaned once `AppLayoutComponent` replaced it in the prior session, still
had the exact emoji pattern this redesign was meant to remove.
Landing/login/register were correctly left untouched (out of scope) and
still carry the old dark-only aesthetic and some emoji — not an oversight.
`ng build --configuration development` passes clean.

**Later same session:** user asked for landing/login/register too ("yes
every components"). Brought all three onto the new design system —
centered-card auth pages replacing the old split-panel/glow-orb layout,
`var(--accent)` used sparingly on landing instead of `.text-gradient`,
last remaining emoji (`🎉` in a register success toast) removed. Once
every page was migrated, deleted the "legacy" CSS block/tokens that had
been kept in `_variables.css`/`_globals.css` for these pages — verified
genuinely unreferenced first via `grep` across `src/app`. Full app-wide
sweep now confirms zero emoji in any `.ts` file. `ng build` still passes,
largest lazy chunk still 292KB.

**Later still: third pasted prompt, responsive design pass.** Scoped to
layout/breakpoints only. Built a real mobile/tablet/desktop breakpoint
system (icon-only tablet sidebar with hover tooltips, bottom-sheet mobile
filters on Jobs List, numbered desktop pagination, horizontal-scroll
"recently fetched" on mobile). Full details in REQUIREMENTS.md. No new
dependencies, `ng build` still clean, bundle size unchanged. Given
straight-through pacing without re-asking, since the user had confirmed
that preference twice already in this session.

**Next:** No live browser click-through has been done across any of the
three frontend passes — only `ng build` each time. That's the one
meaningful gap left, and it matters more now that there's real responsive
behavior (bottom sheet, tablet tooltips, numbered pagination) that
`ng build` can't verify — it only proves the code compiles, not that the
CSS actually looks right at 375/768/1280px. `.gitignore`/committed-secrets
(P0) has now gone three sessions without being acted on — worth just doing
it next time rather than re-flagging again.

---

## 2026-09-23 (frontend build)
**Done:** Executed the pasted "JobPing — Frontend Design & Development
Prompt" (build order: layout shell → shared components → dashboard → jobs
list → job detail → saved → alerts → preferences → notification dropdown).
Built `AppLayoutComponent` + 7 shared components, rebuilt Dashboard/Jobs
List/Job Detail on the new shell, built real Saved and Preferences pages,
built an honestly-adapted Alerts page and NotificationDropdown (see
REQUIREMENTS.md for exactly what was adapted vs. built as specced — short
version: anything requiring a backend endpoint that doesn't exist yet
[`/api/alerts`, `/api/notifications`, `/api/master/worker-status`] got a
real UI shell with an honest empty state instead of a fake wired-up call).
Extended `job.service.ts` with `getJobMatches()`. Narrowly edited
`app.routes.ts` to point `saved`/`alerts`/`preferences` at their real pages.
`ng build --configuration development` passes clean (fixed one real bug
along the way — `MatchBadgeComponent` originally mixed an `@Input` setter
with a `get` accessor of the same name, which doesn't compile as a signal
input; simplified to a plain `@Input` + method).

**Next:** Visual QA pass in the browser hasn't happened yet (only
`ng build` was verified, not `ng serve` + manual click-through) — do that
before calling this done. Also still open: `/profile` page (out of scope
for this build), and everything already listed in PENDING.md P0/P1
(secrets/gitignore, matching engine, RabbitMQ workers).

---

## 2026-09-23 (later same day)
**Done:** User asked for a blunt market-standard review of the project
(read `JobPing_Vision_Prompt.md`). Flagged: RabbitMQ retry/DLQ design was
broken as specced (dead-lettered on attempt 1, no actual retry path despite
claiming "3 retries with backoff"), `SkillMatcher` had a live substring bug
(Java matched inside JavaScript), zero test coverage anywhere, secrets
committed to git (carried over from morning session, still unresolved), and
the vision doc's own stated reason for RabbitMQ ("most asked-about topic in
senior interviews") undercuts its claim of being purely needs-driven.
Fixed two of these on request: (1) `SkillMatcher.cs` now uses a
boundary-aware match instead of raw `.Contains`; (2) rewrote CLAUDE.md
§10/§11 with a working TTL+DLX retry ladder
(`email.send` → `email.retry.5s` → `email.retry.30s` → `email.dead`),
attempt count tracked in `mail_queue.no_of_attempts` — this is a
spec/design fix only, Step 7 code doesn't exist yet so nothing downstream
needed changing. Full reasoning logged in DECISIONS.md.

**Next:** Still unresolved from this review: `.gitignore`/committed secrets
(P0, flagged in the morning session too — two sessions now without action),
zero test coverage, RabbitMQ being justified in the vision doc partly by
"gets asked about in interviews" rather than genuine need (worth rewriting
that framing before saying it out loud anywhere). Timeline concern from
earlier in this session was explicitly waived by the user (they were
unavailable the last 2 months, so elapsed-time-since-first-migration is not
a reliable signal of remaining runway) — don't re-raise it as a blocker.

**Open questions:** none new.

---

## 2026-09-23
**Done:** First context-scan session. Read CLAUDE.md (full spec), NOTES.md
(existing status doc — already high quality), `steps/*.md` (per-step build
logs). Verified actual repo state against docs: confirmed Steps 1-5 + Auth
are genuinely implemented (checked file existence for all controllers/
services/workers/entities, grepped for TODO/FIXME/NotImplementedException —
none found). Confirmed Steps 6-10 have zero code (no MatchingService, no
RabbitMQ wiring beyond a logging stub, no Docker/CI files anywhere in repo).
Found `appsettings.Development.json` is tracked in git with a real local
dev DB password + JWT secret, and no `.gitignore` exists at repo root (bin/,
obj/, .vs/, node_modules/ all showing as tracked in git status). Created
`.ai-context/` (PROJECT, ARCHITECTURE, REQUIREMENTS, PENDING, DECISIONS,
this file) and added a short pointer block to root `CLAUDE.md` (see open
question #1 below on whether that's the right target file).

**Next:** Step 6 (Matching Engine) is the critical path — everything in
Step 7 and the dashboard's "recent matches" depend on it. P0 gitignore/secret
cleanup should happen first since it's cheap and the repo will only grow.

**Open questions for the user:**
1. `CLAUDE.md` is the full spec (1660 lines) and is explicitly marked
   "auto-loaded each session" territory already — the pasted task asked to
   add a 5-line summary + pointers to it, which would mean *editing* the
   existing spec file rather than replacing it. Confirm that's the intent
   (vs. leaving CLAUDE.md untouched and putting the pointer logic somewhere
   else).
2. Confirm whether `appsettings.Development.json`'s committed password is
   just a throwaway local dev value (safe to rotate/ignore) or something
   reused elsewhere (in which case treat as higher priority to rotate, not
   just gitignore going forward).
3. `.gitignore` doesn't exist at all — worth creating one now (bin/obj/.vs/
   node_modules/.angular) as part of the P0 cleanup, or is that intentionally
   out of scope for this pass?
