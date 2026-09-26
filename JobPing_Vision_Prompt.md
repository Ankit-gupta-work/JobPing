# JobPing — Project Vision & What We Are Building

## Who I Am

My name is Ankit. I am a 23-year-old full stack developer with 3 years of experience based in Vapi, Gujarat, India. My core stack is Angular, .NET Core Web API, and PostgreSQL. I currently work at a small company where I independently handle the entire product lifecycle — requirements, development, deployment, and server management.

I am building JobPing as my primary portfolio project to transition to a larger product company in Pune or Hyderabad targeting 10–18 LPA by October 2026. This project is not a tutorial app. It is a real product that I personally need and will actually use. It must be production-quality, fully deployed, and demonstrable in an interview.

---

## The Problem I Am Solving

As a developer actively looking for better opportunities, I currently have to check multiple job websites manually every day — Remotive, Arbeitnow, We Work Remotely — and filter through hundreds of irrelevant listings. There is no tool that understands my specific stack (Angular + .NET Core + PostgreSQL) and only shows me jobs that actually match what I know.

I want a system that does this automatically in the background and emails me only the relevant matches. I should be able to set my preferences once and then just receive alerts.

---

## What JobPing Is

JobPing is a **developer-focused job alert platform**.

The core idea in one sentence: **Set your stack once. Get matched job alerts delivered to your inbox every 2 hours.**

A developer registers, selects their skills (Angular, .NET Core, PostgreSQL, Docker etc.), sets their preferred locations (Remote, Pune, Hyderabad) and salary range. JobPing then runs a background worker every 2 hours that fetches new job listings from 3 real job sources, calculates a match score between each job and the developer's skill profile, and sends an email alert for every job that scores above the developer's match threshold (default 50%).

The developer never has to open the app unless they want to. The system works entirely in the background and pushes relevant opportunities to them.

---

## The Full User Journey

```
1. Developer opens jobping.dev
2. Clicks "Get Started Free"
3. Creates account (email + password)
4. Onboarding Step 1: Selects skills from chips (Angular, .NET Core, PostgreSQL, Docker...)
5. Onboarding Step 2: Sets location (Remote / Pune / Hyderabad), experience level, salary range (10–18 LPA), minimum match % (default 50%)
6. Onboarding Step 3: Sets alert preference (Instant / Daily digest / Weekly)
7. Redirected to dashboard

--- Background system runs automatically ---

8. Every 2 hours: worker fetches jobs from Remotive, Arbeitnow, WWR
9. For each new job: calculates match score against ALL users' profiles
10. If score >= user's threshold AND user hasn't been alerted about this job before → queue email
11. Email sent via SendGrid with job title, company, match %, skills needed, and apply link
12. User opens email → sees "Senior .NET Developer at Techwave — 92% match" → clicks apply

--- User can also browse manually ---

13. Dashboard shows top matched jobs sorted by match %
14. Jobs page lets them browse/filter all indexed jobs
15. They can save jobs, track application status, view alert history
```

---

## What Makes This Different From a CRUD App

Most portfolio projects are: user creates items, user reads items, user updates items, user deletes items. JobPing is fundamentally different because:

**The core value is delivered when the user is NOT using the app.** The background workers are the product. The email alert is the product. The match engine is the product. The UI is just a way to configure preferences and browse results.

This means the project requires real engineering decisions:

- **Event-driven architecture** — workers communicate via RabbitMQ message queues, not database polling
- **Background processing at scale** — FetchJobsWorker, MatchAndAlertWorker, MailWorker all running independently
- **Deduplication** — same job must never be inserted twice, same user must never get the same alert twice
- **Match scoring engine** — real algorithm: overlap between user skills and job skills as a percentage
- **Caching layer** — Redis for job listings, user matches, master data, rate limiting, JWT blacklist, distributed locks
- **Retry logic** — if SendGrid fails, the system retries 3 times with exponential backoff before marking as failed

---

## Tech Stack and Why Each Technology

| Technology | Why It's Here |
|---|---|
| **.NET Core 8 Web API** | My primary backend skill. Going deeper into clean architecture, background services, middleware. |
| **Angular 18 (standalone)** | My primary frontend skill. Using it for real API integration, not a tutorial app. |
| **PostgreSQL 15** | Migrating from SQL Server. Deeper learning: indexing, EXPLAIN ANALYZE, EF Core migrations. |
| **RabbitMQ** | Replaces database polling. Workers communicate via events not timers. Most asked-about topic in senior .NET interviews. First real message queue implementation. |
| **Redis** | Four uses in one project: read cache, distributed locks (prevent duplicate worker runs), rate limiting, JWT blacklist. First production-grade Redis usage. |
| **SendGrid** | Real email delivery. Async via queue — not called directly in API request. |
| **Docker + Docker Compose** | The single biggest gap in my current profile. Containerize all 6 services, one command starts everything. |
| **GitHub Actions** | CI/CD pipeline. Every push auto-deploys to staging. Releases deploy to production with manual approval gate. |

Every technology is here because the product genuinely needs it — not to pad a resume. RabbitMQ exists because without it FetchJobsWorker would have to poll the database for new jobs constantly. Redis exists because without it every job list request would hit PostgreSQL. Docker exists because without it deploying this 6-service system would be a manual nightmare.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Angular 18 UI                         │
│  Landing · Login · Register (4-step) · Dashboard · Jobs     │
│  Alerts · Saved · Preferences · Profile                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS via Nginx
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   .NET Core 8 Web API                        │
│  Auth · Jobs · Preferences · Alerts · Notifications         │
│  Master Data · Admin                                        │
└──────┬────────────────┬──────────────────────────────────────┘
       │                │
       ▼                ▼
┌──────────┐    ┌───────────────┐
│ PostgreSQL│    │     Redis     │
│  (main   │    │ cache · locks │
│   data)  │    │ rate limit    │
└──────────┘    │ JWT blacklist │
                └───────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      RabbitMQ                                │
│  jobs.exchange → jobs.new queue                             │
│  email.exchange → email.send queue → email.dead queue       │
│  notification.exchange → notification.create queue          │
└──────┬────────────────┬──────────────────────────────────────┘
       │                │
       ▼                ▼
┌─────────────┐  ┌─────────────────┐  ┌──────────────────┐
│FetchJobs    │  │MatchAndAlert    │  │   MailWorker     │
│Worker       │  │Worker           │  │                  │
│Every 2 hrs  │  │Triggered by MQ  │  │Triggered by MQ   │
│Remotive +   │  │Calculates match │  │Calls SendGrid    │
│Arbeitnow +  │  │Checks history   │  │Retry 3 times     │
│WWR RSS      │  │Queues emails    │  │Dead letter queue  │
└─────────────┘  └─────────────────┘  └──────────────────┘
```

**Clean Architecture — 4 layers:**
- `JobPing.Domain` — Entity classes only. Zero dependencies.
- `JobPing.Application` — Interfaces, DTOs, business rules.
- `JobPing.Infrastructure` — EF Core, Redis, RabbitMQ, SendGrid, HTTP clients.
- `JobPing.API` — Controllers, middleware, startup.

---

## The Match Scoring Algorithm

```
matchScore = (userSkillIds ∩ jobSkillIds).Count
             ÷ jobSkillIds.Count × 100

Example:
  Job requires: Angular, .NET Core, PostgreSQL, Docker  (4 skills)
  User has: Angular, .NET Core, PostgreSQL, Redis       (4 skills)
  Overlap: Angular, .NET Core, PostgreSQL               (3 skills)
  Score: 3 ÷ 4 × 100 = 75%

Score display:
  90–100% → green badge → alert sent
  70–89%  → amber badge → alert sent (if threshold ≤ 70)
  50–69%  → gray badge  → alert sent (if threshold ≤ 50, the default)
  < 50%   → never shown, never alerted
```

---

## The 3 Job Sources

| Source | URL | Type | Cost |
|---|---|---|---|
| Remotive | remotive.com/api/remote-jobs | REST API JSON | Free, no auth |
| Arbeitnow | arbeitnow.com/api/job-board-api | REST API JSON | Free, no auth |
| We Work Remotely | weworkremotely.com/remote-jobs.rss | RSS XML feed | Free |

All three are fetched every 2 hours. New jobs are deduplicated by `(external_id, source)` unique constraint in PostgreSQL. Skills are extracted from job title and description by matching against the master skills list.

---

## What the Final Product Looks Like

When this is done, I will have:

1. **A live URL** — `https://jobping.dev` (or similar) that anyone can open
2. **A real product** — register, set preferences, receive actual job alert emails
3. **A GitHub repository** — clean commit history showing 10 build steps, CI/CD pipeline badge showing green
4. **A demo story** — "I register as a developer with Angular and .NET Core skills. I set my match threshold to 70%. Two hours later I receive an email with 3 job matches, all above 70%, from 3 different job sources."

In an interview I can:
- Open the live URL and demo it in real time
- Walk through the architecture diagram and explain every decision
- Explain why RabbitMQ (event-driven vs polling)
- Explain why Redis for 4 different concerns
- Show the matching algorithm and how deduplication prevents duplicate alerts
- Show the GitHub Actions pipeline and explain the staging → production flow

---

## What This Project Is NOT

- Not a tutorial app — no artificial features added just to use a technology
- Not a microservices project — clean architecture monolith is appropriate for this scale
- Not a social media clone or e-commerce app — those are CRUD, this has real business logic
- Not a half-finished proof of concept — it must be deployed and working end-to-end by October 2026

---

## The Goal

By October 2026, I walk into an interview at a product company in Pune or Hyderabad and say:

*"I built a job alert platform for developers called JobPing. It fetches jobs from 3 external sources every 2 hours using a .NET Core background worker, calculates match scores against each user's skill profile, and sends email alerts via a RabbitMQ-driven pipeline. The system uses Redis for caching and distributed locking, is fully containerized with Docker Compose, and has a GitHub Actions CI/CD pipeline that auto-deploys on every push to main."*

Then I open my laptop and show them the live product.

That is what we are building.
