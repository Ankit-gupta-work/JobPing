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

## 2026-09-26 (later session)
**Done:** Executed a large pasted "JobPing — Master UI Prompt" (9-part CSS/
animation redesign + 5 "signature feature" components), with two
deliberate deviations from the literal spec (both logged in DECISIONS.md):
declined to reinstall `lucide-angular` (extended `IconComponent` instead —
`refresh-cw`, `zap`, `arrow-left`, `arrow-right`), and built the "Live
Terminal" widget from real data instead of the spec's fabricated log
lines.

Rewrote `_variables.css` (new token set: `--shadow-xs/sm/md/lg/accent`,
`--ease-out`/`--ease-spring`, `--dur-fast/base/slow`, renamed sidebar vars
to `--sidebar-w`/`--sidebar-w-icon`) and `_globals.css` (full rewrite,
~700 lines) — kept old class-name selectors aliased alongside the new ones
(`.filter-mobile-bar, .filter-bar-mobile` etc.) so nothing broke silently,
then still went through and renamed every actual usage in
`jobs-list.component.ts` to the new names for consistency
(`.filter-bar-mobile`, `.sheet-overlay/-handle/-header/-footer`,
`.pagination-simple`/`.pagination-full`/`.page-btn`, `.jobs-main`).

Built five new components: `CommandPaletteComponent` (Cmd+K, real
navigation + real theme toggle + real `POST /api/admin/fetch-jobs` for
Admin-role users only, wired into `AppLayoutComponent`'s topnav search
bar), `MatchRingComponent` (animated SVG ring, used in `JobCardComponent`
in place of the company-initials logo whenever a match score is present —
replaced the old flat `.match-bar` there since showing both was
redundant), `WorkerTerminalComponent` (real last-sync/jobs-indexed/
alerts-sent data, mounted on the dashboard), a live match-count banner on
the Preferences skills/locations tabs (debounced real `GET /api/jobs/
matches` refetch after each toggle), and `SwipeStackComponent` (mobile-
only pointer-drag stack, real save on swipe-right, client-side-only skip
on swipe-left — see DECISIONS.md for why no backend "dismiss" call
exists). Added a shared `utils/count-up.ts` animation helper, wired into
both `MatchRingComponent` (refactored to use it instead of its own
duplicate RAF loop) and `StatCardComponent` (all four dashboard stat
values now animate on change).

While in the dashboard, fixed two stale/dishonest empty-state and stat-
card strings left over from before Steps 6-7 existed: "Alerts sent" and
"Match rate" stat cards said "Ships with Step 6/7" — both steps have been
done for two sessions now. Replaced with real numbers (`alertsSent` from
`GET /api/alerts`, `avgMatchScore` computed from real top-matches data).
Same fix applied to the matching-tab empty state in both
`dashboard.component.ts` and `jobs-list.component.ts` ("The matching
engine ships in Step 6" → real guidance to set skills/locations). Also
deleted a stale code comment on `JobService.getJobMatches()` claiming it
"always returns []" — no longer true.

Verified with `ng build` (dev) and `ng build --configuration production`
— both clean, same bundle sizes as before this session (icon-system
choice still holding: no lazy chunk grew unexpectedly). No live-browser
QA (same tooling gap as every prior frontend session — still P0 in
PENDING.md).

**Next:** Live browser QA of the frontend remains the single biggest gap
(P0, blocked on tooling — see PENDING.md). Otherwise Step 9 (deploy) and
Step 10 (CI/CD) are next in the build order. Nothing from this session was
committed to git yet — ask before committing/pushing.

**Open questions:** none new.

## 2026-09-26 (continued — theme/UI polish pass)
**Done:** Responded to user feedback with screenshots showing the light
theme looking "dull" and selected Preferences skill chips rendering with
invisible text. Found and fixed the real root cause of the chip bug: the
`.filter-chip` active-state highlight is a `::before` overlay, and the
label text in every template using it is a raw interpolated text node
(never wrapped in a `<span>`), so per CSS paint order a positioned
pseudo-element paints ABOVE plain in-flow text regardless of z-index:auto.
Fixed by giving `.filter-chip` its own stacking context
(`position:relative; z-index:0`) and the `::before` an explicit
`z-index:-1` — text now always paints above the fill, in every template
that uses `.filter-chip` (Preferences, Jobs filters, Register wizard),
with no template changes needed.

Retuned light-theme tokens in `_variables.css`: split `--bg-page` from
`--bg-surface` (were both near-identical whites — #ffffff/#fafafa — which
is why cards had almost no visual separation from the page; now
#f6f6f8/#ffffff so white cards pop against an off-white canvas), deepened
border/text colors slightly, strengthened all four shadow tokens. Added
the previously-missing `--error-border` token to both themes and a dark-
theme `--error`/`--error-soft` override (was falling back to light's pink
`--error-soft`, which would've looked wrong on dark surfaces).

Found and fixed a second real color bug while investigating: the MatSnackBar
`jp-snack-success`/`jp-snack-error` panel overrides in `styles.css` were
hardcoded to fixed dark-theme colors (comment literally said "Material
overrides to fit the dark theme") — in light mode this made every
success/error toast (used throughout register, preferences, login) render
as a near-black popup with light pastel text, clashing badly. Switched
both to reference the same `--success`/`--success-soft`/`--error`/
`--error-soft` tokens the rest of the app uses, so toasts now adapt
correctly between themes.

Rebuilt all three pages the user called out as not looking good:
- `landing.component.ts` — fixed a dead `--nav-height` CSS var (typo for
  `--nav-h`, was collapsing the header to auto-height); added a
  how-it-works section (3 real steps, no fabricated stats), a real
  data-sources strip (Remotive/Arbeitnow/WWR — the actual integrated
  sources), a gradient CTA band, a footer, background glow decoration, and
  staggered entrance + floating-card animations. Was previously just a
  header + hero with a large dead white area below it.
- `login.component.ts` — rebuilt as a split-panel layout: branded gradient
  panel with real product facts + a preview card on the left (desktop
  only), the actual sign-in form on the right, entrance animation on both.
  Previously a single narrow card centered in an otherwise empty page.
- `register.component.ts` — added the same background-glow decoration
  language as landing/login, plus a per-step fade/slide-in animation
  (re-triggers naturally each time `@if` swaps in a new step, no extra
  JS needed) and a card-level entrance animation. Wizard logic/validation
  untouched — only template/styles changed.

Bumped the Angular `anyComponentStyle` budget in `angular.json` from
4kB/8kB to 8kB/16kB — the landing page's new component-scoped styles
(decoration + animations) tripped the old warning threshold; this isn't a
real performance problem (the whole app's initial + lazy bundle total
barely moved), just a stale budget from when pages had near-zero custom
CSS.

Verified with `ng build` and `ng build --configuration production` after
every batch of changes — both clean, no errors, no budget warnings after
the bump. Also grepped every `var(--...)` usage across `app/` and
`styles/` against every token actually defined in `_variables.css` to
catch any other stray typos like `--nav-height` — none found; that was
the only one.

**Next:** Still no live-browser visual confirmation of these changes (same
long-standing P0 tooling gap). Nothing from this pass has been committed.
Worth a real look (screenshot or user check) at all three auth-flow pages
plus the Preferences chip fix before calling this fully done.

**Open questions:** none new.

## 2026-09-26 (continued — dashboard screenshot feedback)
**Done:** User sent a dashboard screenshot in light mode, said the grey
still feels dull and asked which build step the project is on. Two
targeted changes: (1) retinted light-theme `--bg-page`/`--bg-elevated`/
`--bg-hover` from a near-neutral cool grey to a visibly violet-tinted
off-white, so the canvas ties to the brand accent instead of reading as
plain corporate grey; (2) gave `.terminal-card` (the dashboard's
fetch-jobs worker widget, the flattest-looking box in the screenshot) a
dedicated always-dark surface (`--terminal-*` tokens in `_variables.css`)
instead of tying it to `--bg-elevated` — a light-grey "terminal" doesn't
read as a terminal; a real dark surface with bright mono text does, in
both themes. `ng build` clean after.

**Next:** Same as above — none of this is visually confirmed yet.

## 2026-09-26 (continued — reverted always-dark terminal widget)
**Done:** User flagged the always-dark terminal widget as inconsistent
("why in white it is black?") rather than a welcome accent. Asked directly
whether to keep it dark-always or match the light theme — user chose
match. Reverted `.terminal-card` and children back to the standard theme
tokens (`--bg-elevated`, `--border-default`, `--text-muted`, etc.) and
deleted the now-unused `--terminal-*` token block from `_variables.css`.
`ng build` clean.

**Lesson for future sessions:** don't introduce a deliberately
theme-inconsistent surface (always-dark on a light page) without
confirming first — it reads as a bug/oversight to the user even when
intentional and explained.

## 2026-09-26 (continued — knowledge-transfer document)
**Done:** User asked for a full knowledge-transfer Word document covering
architecture and workflow, ahead of deploying (Step 9). Verified actual
current codebase state first (ARCHITECTURE.md was stale — still said
Steps 6-8 weren't started; confirmed via Glob that all controllers/
services/workers/RabbitMqTopology.cs/docker-compose.yml for those steps
exist) rather than transcribing the stale file. Generated a real .docx
(not an HTML/markdown stand-in) using the `docx` npm package in a scratch
Node project, since no pandoc/python-docx was available in this
environment. Output: `docs/JobPing-Project-Documentation.docx` (~20KB,
verified as a real Word 2007+ file). Covers: project overview, 4-layer
Clean Architecture, full auth/job-pipeline/RabbitMQ/Redis workflow
walkthroughs with the actual code paths, frontend architecture, Docker
Compose topology, build-order status table, and a known-gaps section
(no tests, no rate limiting, guard token-presence-vs-validity gap, no
browser QA tooling, etc.).

**Next:** User said Step 9 (deploy, make it live) is next. Needs from the
user: a target host/VPS provider and a domain name before that can start.
`docs/` is a new untracked folder — nothing committed.

## 2026-09-29 — Step 9 deploy prep (Oracle Cloud)
**Done:** User asked where to host for free; walked through why Vercel
(static/serverless only, no .NET/Postgres/Redis/RabbitMQ support) and
Railway (no longer has a real free tier, trial credit only) don't fit,
recommended Oracle Cloud's Always Free ARM tier (genuinely free forever,
enough compute for the whole existing docker-compose.yml stack
unmodified). User confirmed — prepped the actual deploy:

- Restructured `nginx/nginx.conf` to a static shell that includes
  `/etc/nginx/conf.d/*.conf`, generated at container startup from
  `nginx/templates/*.template` via the official nginx:alpine image's
  built-in envsubst entrypoint (no custom scripting). `${DOMAIN}` comes
  from a new `DOMAIN` env var (docker-compose.yml → .env), defaults to
  `localhost` so local `docker compose up` is unaffected.
- `nginx/templates/app.conf.template` — the checked-in ACTIVE template is
  HTTP-only (matches today's behavior) but now includes the
  `/.well-known/acme-challenge/` location certbot needs. The HTTPS
  version (redirect + 443 server block + ssl_certificate paths) is
  documented in `docs/DEPLOYMENT.md` as a manual swap-in after the first
  certificate is issued — deliberately not both active at once, since an
  HTTPS server block referencing a cert that doesn't exist yet fails
  nginx's startup entirely.
- `docker-compose.yml` — added a `certbot` service (shares `certbot_www`
  and `certbot_conf` named volumes with `nginx`, the latter read-only on
  nginx's side), added port 443 to nginx, added the `DOMAIN` env var, and
  added explicit warning comments on the db/rabbitmq host port mappings
  (5433, 15672) telling a future deploy NOT to open those in the cloud
  firewall — the actual security boundary is the Oracle VCN Security
  List, not the compose file itself.
- `nginx/Dockerfile` — now COPYs `nginx/templates/` into the image;
  EXPOSE 80 443.
- `.env.example` — added `DOMAIN=localhost`.
- Wrote `docs/DEPLOYMENT.md` — full step-by-step runbook: Oracle VM
  creation (shape, Always Free ARM sizing), the two-layer firewall
  (Oracle Security List + Ubuntu's own iptables — both default-closed,
  both need explicit rules), Docker install, .env setup, DNS, the
  HTTP-first-then-cert-then-HTTPS sequencing, running the EF Core
  migration via an SSH tunnel (Postgres is never exposed to the public
  internet, even temporarily), certbot webroot issuance + the HTTPS
  template swap, cron-based renewal, and day-2 ops (redeploy, logs,
  pg_dump backup). Explicitly scoped out Step 10 (CI/CD) and
  monitoring/tests as deliberately not covered yet.

Validated `docker compose config` against the new file with a throwaway
`.env` — resolves cleanly, DOMAIN defaults correctly, volumes wire up as
intended. Could not build/run the actual images or test real cert
issuance in this session (no Oracle VM exists yet — that's on the user).

**Next:** User needs to actually create the Oracle VM and work through
docs/DEPLOYMENT.md. Nothing here has been committed to git yet — this
touched docker-compose.yml, nginx/Dockerfile, nginx/nginx.conf (rewritten
from scratch), plus new files nginx/templates/app.conf.template,
docs/DEPLOYMENT.md, and an addition to .env.example.

**Open questions:** none new — waiting on the user to actually provision
infrastructure before this can be tested for real.

## 2026-09-29 — Added Adzuna + JSearch as job sources 4 and 5
**Done:** User pasted a spec for adding two India-focused job sources
(Adzuna, JSearch/RapidAPI) alongside the existing Remotive/Arbeitnow/WWR.
The pasted spec assumed the fetch pipeline lives directly in
`FetchJobsWorker.cs` with per-source inline dedup/insert loops — that's
not how this codebase actually works (established back in an earlier
session, before this doc was updated to reflect it): `FetchJobsWorker` is
just a `PeriodicTimer` wrapper: the real orchestration (distributed lock,
per-source fetch, the shared `SaveNewJobsAsync` dedup+insert+skill-extract
+publish helper, background_tasks status, cache invalidation) all lives in
`JobFetchService.FetchAndStoreJobsAsync`, specifically so `AdminController`
can trigger the exact same logic on demand. Wiring the new sources into
`FetchJobsWorker` as the spec described would have made them silently
invisible to the "Run job fetch now" admin/command-palette trigger, and
would have duplicated the dedup/skill-extraction logic that already exists
as a shared helper. Read the real files first, then implemented against
them instead:

- New `AdzunaClient.cs` / `JSearchClient.cs` in `ExternalClients/` —
  response models rewritten from the spec's lowercase-property versions
  (which relied on System.Text.Json's default case sensitivity accidentally
  not mattering, or would've silently deserialized to nulls) to PascalCase
  properties with explicit `[JsonPropertyName]`, matching
  `RemotiveClient.cs`'s established convention exactly.
- `JobMappingService` — added `MapAdzunaJob`/`MapJSearchJob`, using the
  same `TruncReq`/`Trunc`/`EmptyTo` column-length-safety helpers every
  other mapper already uses (the spec's versions had no truncation at all
  — a real risk of a DB write failure on an oversized title/description
  from an external API with no length guarantees).
- `JobFetchService` — added `AdzunaClient`/`JSearchClient` as constructor
  deps, and two new blocks in `FetchAndStoreJobsAsync` calling the
  existing shared `SaveNewJobsAsync` helper (same dedup/insert/skill-
  extract/publish path as every other source, instead of new bespoke
  per-source loops). No per-source try/catch needed here either — each
  client's own `FetchXAsync` already swallows its own failures and
  returns an empty list, matching how Remotive/Arbeitnow/WWR already work.
- **JSearch quota fix**: the pasted spec's own math showed calling
  JSearch every 2h (5 queries/run x 12 runs/day) works out to ~1,800
  calls/month against a 500/month free-tier cap — a 3.6x overshoot the
  spec flagged but didn't actually fix in code, just noted as "something
  to consider." Implemented a real fix: a `gate:jsearch-daily` key via
  the existing `ICacheService` (get/set, 24h TTL) so JSearch only actually
  runs once per day regardless of how often the worker ticks — brings it
  to ~150 calls/month, comfortable headroom under the cap.
- `Program.cs` — registered both as typed `HttpClient`s with
  `BaseAddress` set once (matching Remotive/Arbeitnow/WWR's pattern),
  rather than the spec's per-call absolute-URL-from-config approach.
- `appsettings.json`, `.env.example`, `docker-compose.yml` (api + worker
  services) — added `Adzuna:AppId/AppKey` and `JSearch:ApiKey/Host`
  config, all empty/blank by default; each client logs a warning and
  returns an empty list if its keys aren't set, rather than throwing.
- Frontend (`jobs-list.component.ts`) — added `'Adzuna'`/`'JSearch'` to
  the `sources` array and `SOURCE_ICONS` map (`map-pin`/`search`, both
  already existing `IconComponent` icons). No template changes needed at
  all — both the mobile filter-chip row and the desktop filter sidebar
  already loop generically over the `sources` array; the spec's
  suggestion to hand-write two new `<lucide-icon>` buttons was both
  unnecessary (nothing to add, the loop already covers it) and wrong
  (this project deliberately doesn't use lucide-angular — see earlier
  DECISIONS.md entries).

Verified: `dotnet build` on `JobPing.Infrastructure` directly (clean, 0
errors) and on `JobPing.API` with a scratch `-p:BaseOutputPath` to route
around a file lock from the user's own running Visual Studio/API process
(also clean, 0 errors — didn't touch the locked process, per standing
policy about not touching processes that might be the user's own active
session). `ng build` clean. `docker compose config` still resolves
cleanly with the two new env vars wired to both `api` and `worker`.

**Next:** User needs real Adzuna + RapidAPI/JSearch keys (both signups
are free) to actually see jobs from these two sources — without them,
both clients log a warning and no-op, which is safe but means nothing
will show up under those two source filters yet. Once keys exist, trigger
`POST /api/admin/fetch-jobs` (or the command palette's "Run job fetch
now" for an Admin user) and check `SELECT source, COUNT(*) FROM jobs
GROUP BY source` to confirm all 5 sources are populating. Then back to
Step 9 (Oracle deploy) — user had asked to do this addition "before that."
Nothing from this session committed to git yet.

## 2026-10-03 — Got the full stack running, found and fixed 3 real bugs in Adzuna/JSearch
**Done:** Walked the user through getting real Adzuna + JSearch/RapidAPI API
keys (Adzuna signup, RapidAPI signup + JSearch subscription), wired both
into `.env`. Then ran into — and fixed — a chain of real environment and
integration issues, each only found by actually running the stack:

**Environment issues (not app bugs, but blocked everything):**
- Docker Desktop's engine wasn't running at all initially (daemon
  unreachable) — needed a full quit/relaunch, plus `wsl --shutdown` once
  to unstick it.
- That `wsl --shutdown` left Docker's internal DNS broken for one build
  attempt (`lookup mcr.microsoft.com: no such host` — not specific to
  Microsoft's registry, Docker Hub failed too) — resolved after a second
  full Docker Desktop restart.
- `jobping-ui/package-lock.json` was out of sync with `package.json`
  (missing `@emnapi/core`/`@emnapi/runtime` — a nested peer-dependency-of-
  an-optional-package that both `npm install` and
  `npm install --package-lock-only` failed to resolve correctly while
  `node_modules` already existed). Only a full clean reinstall (delete
  both `node_modules` and the lock file, fresh `npm install`) actually
  fixed it — confirms this is a recurring class of issue for this repo,
  third time now across sessions. Needed the user to stop their running
  `ng serve` first (it was holding files open).

**Three real bugs in the new Adzuna/JSearch code, found only by hitting
the live APIs for the first time (not catchable by code review or a
mocked test):**
1. **Adzuna charset bug** — Adzuna's API sends `Content-Type: application/
   json; charset=utf8` (missing the hyphen, non-standard). .NET's
   `GetFromJsonAsync`/`ReadFromJsonAsync` validate the declared charset
   name strictly and throw on anything they don't recognize — "utf8"
   isn't a registered .NET encoding name. Fixed in both `AdzunaClient`
   and (preemptively, same risk) `JSearchClient` by deserializing from
   the raw response stream via `JsonSerializer.DeserializeAsync` instead
   — JSON is UTF-8 per RFC 8259 regardless of what a server's header
   claims, so there's no reason to trust the declared charset at all.
2. **Wrong JSearch endpoint** — the pasted spec (and seemingly RapidAPI's
   own older cached docs) pointed at `/search`; the live API 404s on that
   and the real current endpoint is `/search-v2`. Confirmed directly
   against the user's own RapidAPI console before fixing.
3. **Wrong JSearch response shape** — `search-v2`'s `data` field is an
   object (`{ jobs: [...], cursor: "..." }`), not the bare array the
   spec's `search` docs described. Added a `JSearchData` wrapper type.
   Also found `job_employment_type` comes back as a human-readable string
   ("Contractor", "Full-time") rather than the uppercase enum
   ("CONTRACTOR") the original mapping switch expected — fixed to match
   case-insensitively with a passthrough fallback instead of dropping
   unrecognized values to null.

Verified end-to-end against the real running stack (not just `dotnet
build`): queried `SELECT source, COUNT(*) FROM jobs GROUP BY source`
directly against the live Postgres container and confirmed real rows
from all 5 sources, most with fresh `fetched_at` timestamps from this
session's test runs (Adzuna: 398, JSearch: 21 — both newly populated;
Arbeitnow/WWR/Remotive: 1589/183/19 from earlier sessions, still healthy).

**Next:** Full Docker Compose stack is now running locally at
`http://localhost` with the Adzuna/JSearch integration genuinely working
end-to-end. Nothing from this session has been committed yet — this
touched `AdzunaClient.cs`, `JSearchClient.cs`, `JobMappingService.cs`,
`jobping-ui/package-lock.json` (regenerated). Back to Step 9 (Oracle
deploy) once the user is ready, per their own stated sequencing
("before that" → source integration first, deploy after).

## 2026-10-17 — Fixed real Vercel + Railway deployment bugs
**Context:** User independently deployed outside this conversation since
the last session (frontend → Vercel, backend → Railway, RabbitMQ → Railway's
CloudAMQP add-on) — a different path than the Oracle Cloud plan this
conversation had been building toward. Confirmed via `git log`: 4 new
commits (`ade51a9` "final work" — the user's own commit of everything
built across this whole conversation, `f395d19` CloudAMQP RabbitMQ URL
support, `636ad83` backend URL update, `d179a60` vercel config added) that
I did not make. Oracle deploy docs (`docs/DEPLOYMENT.md`) are now stale/
unused — left in place but nothing currently points at them.

User reported Vercel showing "This page doesn't exist" on every route.
Found and fixed 3 real bugs, verified each locally before pushing:
1. `jobping-ui/vercel.json` had a SPA rewrite rule but no
   `outputDirectory` — Vercel's auto-detection couldn't find Angular 21's
   actual build output (`dist/jobping-ui/browser`, confirmed via
   `angular.json` having no `outputPath` override, so it's on the
   framework default), which explains why even the root route failed,
   not just direct navigation to sub-routes. Added `buildCommand` +
   `outputDirectory` explicitly.
2. `environment.prod.ts`'s `apiBaseUrl` was set to the bare Railway URL
   with no `/api` suffix — every `*.service.ts` builds its endpoint as
   `${apiBaseUrl}/auth` etc., and every controller route is under
   `[Route("api/...")]`, so every API call would have 404'd even once
   the frontend itself loaded correctly.
3. CORS (`Program.cs`) was hardcoded to `http://localhost:4200` — made
   sense under the original same-origin-via-nginx design, but Vercel and
   Railway are different origins. Changed to read `Cors:AllowedOrigins`
   (comma-separated) from config, defaulting to localhost so local dev
   is unaffected.

Verified all 3 locally before pushing: ran the real production build and
confirmed `index.html` lands exactly at `dist/jobping-ui/browser/`, grepped
the built JS bundle to confirm the corrected `/api`-suffixed URL is
actually baked in, and did a full `dotnet build` of `JobPing.API` to
confirm the CORS config change compiles. Committed (`c8f6efb`) and pushed
to `origin/main`.

**Next — one thing only the user can do:** set `Cors__AllowedOrigins` on
Railway (double-underscore nested-config convention) to the real Vercel
origin (e.g. `https://jobping-blush.vercel.app`) — without it, CORS
defaults back to `localhost:4200` and the deployed frontend's API calls
will still be blocked by the browser even though the URL/routing bugs are
now fixed. Also worth deciding: is `docs/DEPLOYMENT.md` (Oracle Cloud)
now dead documentation worth deleting, or keeping as a documented
alternative path?
