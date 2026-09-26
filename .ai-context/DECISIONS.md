# DECISIONS.md

Append-only log of technical decisions and why. Newest at bottom.

---

**Bumped stack versions early.** Originally specced for .NET 8 / Angular 18
(per `steps/README.md` note); moved to .NET 9 / Angular 21 before/during
Step 1. `CLAUDE.md` was updated to match — treat the versions in CLAUDE.md
(not the ones in this note) as current truth.

**All three job sources shipped in Step 4, not just Remotive.** Spec said
"Remotive first" implying staged rollout; Remotive + Arbeitnow + WWR RSS were
all built together in one pass.

**IMessagePublisher stubbed with LoggingMessagePublisher instead of real
RabbitMQ.** Lets FetchJobsWorker (Step 4) and later the matching engine
(Step 6) be built and tested against the `IMessagePublisher` interface
without RabbitMQ infrastructure being ready yet. Swap to a real
`RabbitMQPublisher` in Step 7 — the interface contract shouldn't need to
change.

**JwtBlacklistMiddleware fails open if Redis is down.** Deliberate
availability-over-strict-revocation tradeoff: if Redis is unreachable, a
revoked-but-not-yet-expired token is still accepted rather than the whole API
going down. Noted explicitly in NOTES.md §11.

**Snake_case column names applied automatically via a `ToSnakeCase()` helper
in `OnModelCreating`**, not per-property `.HasColumnName()` calls. Iterates
`mb.Model.GetEntityTypes()` after all Fluent config is applied. Means new
entities/properties get snake_case columns for free — don't hand-roll it.

**Migrations live at `Infrastructure/Migrations/`, not
`Infrastructure/Data/Migrations/`** as CLAUDE.md's solution-structure diagram
shows. Minor deviation from spec, not worth fixing retroactively (migration
history would break).

---

**2026-09-23 — Fixed a broken retry/DLQ design in CLAUDE.md §10/§11 before
Step 7 was ever coded.** The original spec had MailWorker call
`nack(requeue: false)` on any failed attempt, on a queue whose own
`x-dead-letter-exchange` routed straight to `email.dead`. That
dead-letters on attempt 1, every time — there was no mechanism that ever
brought a message back to `email.send` for a 2nd/3rd try, despite the spec
(and JobPing_Vision_Prompt.md) claiming "3 retries with exponential
backoff." The queue also carried a blanket 5-minute message TTL, which
would silently dead-letter any message that simply sat unconsumed (e.g.
MailWorker briefly down), independent of whether it had ever been
attempted.

Replaced with a standard TTL+DLX retry ladder (no RabbitMQ plugin needed):
`email.send` (no TTL, working queue) → on failure, MailWorker explicitly
re-publishes a copy of the message into `email.retry.5s` or
`email.retry.30s` (consumer-less queues whose only job is to expire and
DLX back into `email.send`) → after 3 total attempts, publish to
`email.dead` (terminal, logging-only sink, never auto-populated). Attempt
count is tracked in `mail_queue.no_of_attempts` (Postgres), not in the
RabbitMQ message, since the message is disposable and gets recreated on
every retry. See PENDING.md's Step 7 entry — build against this corrected
version, not the original CLAUDE.md wording.

**2026-09-26 — nginx builds the Angular app itself instead of a bare
`image: nginx:alpine`.** CLAUDE.md's spec never actually builds the
frontend anywhere — the plain image would have just served nginx's
default page forever. `nginx/Dockerfile` is now multi-stage: `node:20-alpine`
runs `npm ci && npm run build`, then `nginx:alpine` serves the output.
Angular 21's application builder outputs to `dist/<project>/browser/`, not
`dist/<project>/` — copying the wrong path would silently serve nothing.

**2026-09-26 — nginx.conf is HTTP-only, no SSL block, for now.** CLAUDE.md's
version hardcodes cert paths (`/etc/nginx/ssl/fullchain.pem`) that don't
exist — Step 9 (deploy to a real domain) hasn't happened. Shipping a
config that references certs that were never generated would be an
untested half-measure masquerading as done. Add the 80→443 redirect and
SSL server block back once jobping.dev + a real cert exist.

**2026-09-26 — `Program.cs` gained a `RUN_MODE` split, gated to
Development only.** CLAUDE.md's compose spec runs `api` and `worker` as
genuinely separate containers from the same image (`RUN_MODE=worker` on
one). Implementing that required conditionally skipping the whole
controller/auth/CORS/Swagger pipeline in a worker-only container, and
skipping the four `BackgroundService`s in an api-only container. Gated the
whole split behind `!builder.Environment.IsDevelopment()` specifically so
every prior session's plain `dotnet run` (no RUN_MODE set, relies on
getting everything in one process) keeps working exactly as it always
has — only the containerized Production deployment actually splits.

**2026-09-24 — Notification delivery stays in-process rather than going
through `notification.exchange`.** CLAUDE.md §11's architecture diagram
shows a fanout `notification.exchange` → `notification.create` queue → a
`NotificationWorker` that inserts into `notifications`. But §10's literal
MatchAndAlertWorker steps just say "insert notifications row" as one of
several direct DB writes alongside `mail_queue`/`alert_history`, in the
same worker, no queue round-trip. Built it per §10 (direct insert,
same DB call as the alert) since round-tripping through a queue for
something already happening in-process would add latency and a failure
mode for no behavioral benefit. The exchange/queue are still declared in
`RabbitMqTopology` (keeps the topology matching the diagram) and
`IMessagePublisher.PublishNotificationAsync` is still implemented, just
unused by the current flow — if a future reason emerges to decouple
notification creation from the match/alert path, the plumbing is already
there.

**2026-09-24 — RabbitMQ publishing fails soft, matching the Redis
precedent.** `JwtBlacklistMiddleware` already fails open if Redis is
down (documented earlier). Applied the same philosophy to
`RabbitMQPublisher`: if RabbitMQ is unreachable, a publish is logged and
dropped rather than thrown. The alternative — letting a `PublishAsync`
call throw — would mean a RabbitMQ outage takes down job fetching (and
everything downstream of it) entirely, for a personal-scale tool where a
missed `job.fetched` event is far cheaper than an API that won't start.
Consumers (`MatchAndAlertWorker`, `MailWorker`, `DeadLetterHandler`) apply
the mirror image: if they can't connect at startup, they retry every 10s
in a loop inside `ExecuteAsync` rather than throwing and stopping the
hosted service permanently.

**Also fixed `SkillMatcher.ExtractSkillIds` — was a raw `.Contains`
substring match, so skill "Java" matched inside "JavaScript" for every job.**
Replaced with a boundary-aware scan: a match only counts if the characters
immediately before/after aren't alphanumeric, so embedded matches
("Java" in "JavaScript") are rejected while punctuation-adjacent skill
names (".NET Core", "Node.js", "CI/CD") still match normally.
