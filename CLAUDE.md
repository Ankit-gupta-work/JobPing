# JobPing — Full Project Requirements (Claude Code Instructions)

> **Read this entire file before writing a single line of code.**
> This is the complete specification for the JobPing project.
> Build in the exact order described. Do not skip steps.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Solution Structure](#3-solution-structure)
4. [Database Schema](#4-database-schema)
5. [Entity Classes](#5-entity-classes)
6. [DbContext & Fluent API](#6-dbcontext--fluent-api)
7. [DTOs](#7-dtos)
8. [Services & Interfaces](#8-services--interfaces)
9. [Controllers & Endpoints](#9-controllers--endpoints)
10. [Background Workers](#10-background-workers)
11. [RabbitMQ Architecture](#11-rabbitmq-architecture)
12. [Redis Usage](#12-redis-usage)
13. [Angular Frontend](#13-angular-frontend)
14. [Docker Setup](#14-docker-setup)
15. [CI/CD Pipeline](#15-cicd-pipeline)
16. [Build Order](#16-build-order)
17. [Environment Variables](#17-environment-variables)
18. [Coding Rules](#18-coding-rules)

---

## 1. Project Overview

**JobPing** is a developer-focused job alert platform.

- Fetches job listings from 3 external APIs every 2 hours
- Calculates a match score between each job and each user's skill profile
- Sends email alerts via SendGrid for jobs above the user's match threshold
- Uses RabbitMQ for event-driven worker communication
- Uses Redis for caching, distributed locking, rate limiting, and JWT blacklisting
- Fully containerized with Docker Compose
- Deployed via GitHub Actions CI/CD

**The core user journey:**
1. User registers → sets skills + location preferences → receives email alerts for matching jobs

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend API | .NET Core Web API | 9.0 |
| Frontend | Angular (standalone components) | 21 |
| Primary DB | PostgreSQL | 15 |
| Message Broker | RabbitMQ | 3.x (with management UI) |
| Cache / Lock / Rate Limit | Redis | 7 |
| Email | SendGrid | v3 API |
| ORM | EF Core Code-First | 9.0 |
| Auth | JWT + Refresh Token rotation | — |
| Password Hashing | BCrypt (BCrypt.Net-Next) | — |
| Containerization | Docker + Docker Compose | latest |
| Reverse Proxy | Nginx | alpine |
| CI/CD | GitHub Actions | — |
| CSS Framework | Tailwind CSS + custom CSS variables | 3.x |

### NuGet Packages Required

```xml
<!-- JobPing.API -->
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="9.0.0" />
<PackageReference Include="Swashbuckle.AspNetCore" Version="6.6.2" />
<PackageReference Include="AspNetCoreRateLimit" Version="5.0.0" />

<!-- JobPing.Infrastructure -->
<PackageReference Include="Microsoft.EntityFrameworkCore" Version="9.0.0" />
<PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="9.0.0" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="9.0.0" />
<PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
<PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="8.0.0" />
<PackageReference Include="StackExchange.Redis" Version="2.8.0" />
<PackageReference Include="RabbitMQ.Client" Version="6.8.1" />
<PackageReference Include="SendGrid" Version="9.29.3" />
<PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
<PackageReference Include="Hangfire.Core" Version="1.8.14" />
```

---

## 3. Solution Structure

```
JobPing.sln
├── src/
│   ├── JobPing.Domain/                 ← Entity classes only. Zero dependencies.
│   │   └── Entities/
│   │       ├── Role.cs
│   │       ├── User.cs
│   │       ├── RefreshToken.cs
│   │       ├── LoginAttempt.cs
│   │       ├── Skill.cs
│   │       ├── Experience.cs
│   │       ├── Location.cs
│   │       ├── UserProfile.cs
│   │       ├── UserSkill.cs
│   │       ├── UserLocation.cs
│   │       ├── Job.cs
│   │       ├── JobSkill.cs
│   │       ├── SavedJob.cs
│   │       ├── UserJobHistory.cs
│   │       ├── AlertHistory.cs
│   │       ├── MailQueue.cs
│   │       ├── Notification.cs
│   │       └── BackgroundTask.cs
│   │
│   ├── JobPing.Application/            ← Interfaces, DTOs, business rules
│   │   ├── DTOs/
│   │   │   ├── Auth/
│   │   │   ├── Jobs/
│   │   │   ├── Preferences/
│   │   │   ├── Alerts/
│   │   │   └── Common/
│   │   ├── Interfaces/
│   │   │   ├── IAuthService.cs
│   │   │   ├── IJwtService.cs
│   │   │   ├── IJobService.cs
│   │   │   ├── IPreferenceService.cs
│   │   │   ├── IMatchingService.cs
│   │   │   ├── IAlertService.cs
│   │   │   ├── ICacheService.cs
│   │   │   ├── IMessagePublisher.cs
│   │   │   └── IEmailService.cs
│   │   └── Validators/
│   │
│   ├── JobPing.Infrastructure/         ← EF Core, Redis, RabbitMQ, SendGrid, HTTP clients
│   │   ├── Data/
│   │   │   ├── JobPingDbContext.cs
│   │   │   └── Migrations/
│   │   ├── Services/
│   │   │   ├── AuthService.cs
│   │   │   ├── JwtService.cs
│   │   │   ├── JobService.cs
│   │   │   ├── PreferenceService.cs
│   │   │   ├── MatchingService.cs
│   │   │   ├── AlertService.cs
│   │   │   ├── RedisCacheService.cs
│   │   │   ├── RabbitMQPublisher.cs
│   │   │   └── SendGridEmailService.cs
│   │   ├── Workers/
│   │   │   ├── FetchJobsWorker.cs
│   │   │   ├── MatchAndAlertWorker.cs
│   │   │   └── MailWorker.cs
│   │   └── ExternalClients/
│   │       ├── RemotiveClient.cs
│   │       ├── ArbeitnowClient.cs
│   │       └── WWRRssClient.cs
│   │
│   └── JobPing.API/                    ← Controllers, middleware, startup
│       ├── Controllers/
│       │   ├── AuthController.cs
│       │   ├── JobsController.cs
│       │   ├── PreferencesController.cs
│       │   ├── AlertsController.cs
│       │   ├── NotificationsController.cs
│       │   ├── MasterDataController.cs
│       │   └── AdminController.cs
│       ├── Middleware/
│       │   └── ExceptionMiddleware.cs
│       ├── Filters/
│       │   └── ValidationFilter.cs
│       ├── Program.cs
│       └── appsettings.json
│
├── jobping-ui/                         ← Angular 21 frontend
│   └── src/
│       ├── app/
│       │   ├── pages/
│       │   │   ├── landing/
│       │   │   ├── auth/
│       │   │   │   ├── login/
│       │   │   │   └── register/
│       │   │   ├── dashboard/
│       │   │   ├── jobs/
│       │   │   │   ├── jobs-list/
│       │   │   │   └── job-detail/
│       │   │   ├── alerts/
│       │   │   ├── saved/
│       │   │   ├── preferences/
│       │   │   └── profile/
│       │   ├── services/
│       │   │   ├── auth.service.ts
│       │   │   ├── job.service.ts
│       │   │   ├── preference.service.ts
│       │   │   ├── alert.service.ts
│       │   │   └── master-data.service.ts
│       │   ├── guards/
│       │   │   ├── auth.guard.ts
│       │   │   └── guest.guard.ts
│       │   ├── interceptors/
│       │   │   └── auth.interceptor.ts
│       │   ├── models/
│       │   ├── app.routes.ts
│       │   ├── app.config.ts
│       │   └── app.component.ts
│       ├── styles/
│       │   ├── _variables.css
│       │   └── _globals.css
│       └── styles.css
│
├── docker-compose.yml
├── docker-compose.override.yml
├── Dockerfile
├── nginx/
│   └── nginx.conf
└── .github/
    └── workflows/
        └── deploy.yml
```

---

## 4. Database Schema

### All Tables

#### Master Tables
```sql
roles           (id SERIAL PK, name VARCHAR(50) UNIQUE NOT NULL)
skills          (id SERIAL PK, name VARCHAR(100) UNIQUE NOT NULL, is_active BOOL DEFAULT true)
experiences     (id SERIAL PK, name VARCHAR(50) NOT NULL, is_active BOOL DEFAULT true)
locations       (id SERIAL PK, name VARCHAR(100) NOT NULL, is_active BOOL DEFAULT true)
```

#### User Tables
```sql
users (
  id              SERIAL PRIMARY KEY,
  full_name       VARCHAR(150) NOT NULL,
  username        VARCHAR(50)  NOT NULL UNIQUE,
  email           VARCHAR(200) NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role_id         INT NOT NULL REFERENCES roles(id),
  is_active       BOOL DEFAULT true,
  created_on      TIMESTAMPTZ DEFAULT NOW()
)

refresh_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_on  TIMESTAMPTZ DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ NULL
)

login_attempts (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address    VARCHAR(50),
  attempted_at  TIMESTAMPTZ DEFAULT NOW(),
  is_success    BOOL NOT NULL,
  error_msg     VARCHAR(300)
)
```

#### User Preference Tables
```sql
user_profiles (
  id                      SERIAL PRIMARY KEY,
  user_id                 INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  experience_id           INT REFERENCES experiences(id),
  is_remote_only          BOOL DEFAULT false,
  min_salary              DECIMAL(10,2),
  max_salary              DECIMAL(10,2),
  min_match_percentage    INT DEFAULT 50,    -- null handled as 50 in code
  is_email_notification   BOOL DEFAULT true,
  is_push_notification    BOOL DEFAULT false,
  created_on              TIMESTAMPTZ DEFAULT NOW(),
  updated_on              TIMESTAMPTZ DEFAULT NOW()
)

user_skills (
  id        SERIAL PRIMARY KEY,
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id  INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  UNIQUE(user_id, skill_id)
)

user_locations (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id INT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  UNIQUE(user_id, location_id)
)
```

#### Job Tables
```sql
jobs (
  id           SERIAL PRIMARY KEY,
  external_id  VARCHAR(200) NOT NULL,
  source       VARCHAR(50)  NOT NULL,           -- "Remotive" | "Arbeitnow" | "WWR"
  source_url   TEXT,
  title        VARCHAR(300) NOT NULL,
  company      VARCHAR(200) NOT NULL,
  description  TEXT,
  job_type     VARCHAR(50),                     -- "Full-time" | "Part-time" | "Contract"
  location     VARCHAR(200),
  is_remote    BOOL DEFAULT false,
  min_salary   DECIMAL(10,2),
  max_salary   DECIMAL(10,2),
  is_active    BOOL DEFAULT true,
  fetched_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(external_id, source)
)

job_skills (
  id        SERIAL PRIMARY KEY,
  job_id    INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id  INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  UNIQUE(job_id, skill_id)
)
```

#### User-Job Interaction Tables
```sql
saved_jobs (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id      INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_on  TIMESTAMPTZ DEFAULT NOW(),
  is_active   BOOL DEFAULT true
)

user_job_history (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id      INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status      VARCHAR(50) NOT NULL,   -- "Viewed"|"Applied"|"Interview"|"Offered"|"Rejected"
  created_on  TIMESTAMPTZ DEFAULT NOW()
)

-- CRITICAL: Unique constraint prevents duplicate alerts
alert_history (
  id        SERIAL PRIMARY KEY,
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id    INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sent_at   TIMESTAMPTZ DEFAULT NOW(),
  status    VARCHAR(50) NOT NULL,    -- "Sent" | "Failed"
  UNIQUE(user_id, job_id)
)
```

#### Queue & Task Tables
```sql
mail_queue (
  id              SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id          INT REFERENCES jobs(id) ON DELETE SET NULL,   -- nullable
  subject         VARCHAR(300) NOT NULL,
  body            TEXT NOT NULL,
  sender          VARCHAR(200) NOT NULL,
  receiver        VARCHAR(200) NOT NULL,
  status          VARCHAR(50) DEFAULT 'Pending',  -- Pending|Processing|Sent|Failed
  no_of_attempts  INT DEFAULT 0,
  next_retry_at   TIMESTAMPTZ,
  error_msg       TEXT,
  created_on      TIMESTAMPTZ DEFAULT NOW(),
  sent_at         TIMESTAMPTZ
)

notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  message     TEXT NOT NULL,
  type        VARCHAR(50) NOT NULL,   -- "job_match"|"alert_sent"|"system"
  is_read     BOOL DEFAULT false,
  created_on  TIMESTAMPTZ DEFAULT NOW()
)

background_tasks (
  id              SERIAL PRIMARY KEY,
  task_name       VARCHAR(100) NOT NULL,
  cron_expression VARCHAR(100),
  is_active       BOOL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  last_status     VARCHAR(50),   -- "Success"|"Failed"|"Running"
  last_error_msg  TEXT,
  created_on      TIMESTAMPTZ DEFAULT NOW()
)
```

### Required Indexes
```sql
-- Jobs: worker queries
CREATE INDEX idx_jobs_active_fetched ON jobs(is_active, fetched_at);

-- Mail queue: worker polling
CREATE INDEX idx_mail_queue_status ON mail_queue(status, created_on);

-- Notifications: user feed
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_on);

-- Alert history: duplicate check
-- Already covered by UNIQUE(user_id, job_id)
```

### Seed Data
```sql
INSERT INTO roles (name) VALUES ('Admin'), ('User');

INSERT INTO experiences (name) VALUES
  ('Fresher'), ('1-2 years'), ('2-5 years'), ('5+ years');

INSERT INTO skills (name) VALUES
  ('Angular'), ('.NET Core'), ('React'), ('TypeScript'), ('JavaScript'),
  ('PostgreSQL'), ('SQL Server'), ('MongoDB'), ('Redis'), ('Docker'),
  ('Node.js'), ('Python'), ('Go'), ('Java'), ('Azure'), ('AWS'),
  ('Kubernetes'), ('CI/CD'), ('Vue'), ('Next.js');

INSERT INTO locations (name) VALUES
  ('Remote'), ('Pune'), ('Hyderabad'), ('Bangalore'), ('Mumbai'), ('Delhi');

INSERT INTO background_tasks (task_name, cron_expression) VALUES
  ('FetchJobsTask', '0 */2 * * *'),
  ('MatchAndAlertTask', '30 */2 * * *');
```

---

## 5. Entity Classes

All entities in `JobPing.Domain/Entities/`. No data annotations. No framework references. Pure C# classes.

### Key Rules for Entities
- Every entity has `int Id` as primary key
- Every foreign key has BOTH a scalar property AND a navigation property
- Computed properties (like `IsActive` on RefreshToken) use `=>` expression syntax
- Collections use `ICollection<T>` not `List<T>`

```csharp
// Example pattern for ALL entities:
public class User
{
    public int Id { get; set; }
    public string Email { get; set; }
    public int RoleId { get; set; }          // FK scalar

    public Role Role { get; set; }            // FK navigation
    public UserProfile UserProfile { get; set; }
    public ICollection<RefreshToken> RefreshTokens { get; set; }
    public ICollection<UserSkill> UserSkills { get; set; }
    // ... etc
}

// RefreshToken computed properties
public class RefreshToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Token { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; }

    // NOT stored in DB — EF will ignore these
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsRevoked => RevokedAt != null;
    public bool IsActive => !IsRevoked && !IsExpired;

    public User User { get; set; }
}
```

---

## 6. DbContext & Fluent API

**File:** `JobPing.Infrastructure/Data/JobPingDbContext.cs`

### Rules
- ALL configuration via Fluent API in `OnModelCreating` — zero data annotations
- Table names in snake_case (e.g., `e.ToTable("user_skills")`)
- Every unique index defined explicitly
- Cascade delete rules defined explicitly
- Computed properties ignored with `e.Ignore()`
- Seed data defined here for roles, skills, locations, experiences, background_tasks

### Critical Configurations

```csharp
// Junction tables — composite unique indexes
mb.Entity<UserSkill>().HasIndex(x => new { x.UserId, x.SkillId }).IsUnique();
mb.Entity<UserLocation>().HasIndex(x => new { x.UserId, x.LocationId }).IsUnique();
mb.Entity<JobSkill>().HasIndex(x => new { x.JobId, x.SkillId }).IsUnique();

// Jobs deduplication
mb.Entity<Job>().HasIndex(x => new { x.ExternalId, x.Source }).IsUnique();

// AlertHistory — prevents duplicate emails (most critical index)
mb.Entity<AlertHistory>().HasIndex(x => new { x.UserId, x.JobId }).IsUnique();

// RefreshToken — ignore computed properties
mb.Entity<RefreshToken>().Ignore(x => x.IsExpired).Ignore(x => x.IsRevoked).Ignore(x => x.IsActive);

// UserProfile — one-to-one
mb.Entity<UserProfile>()
    .HasOne(x => x.User)
    .WithOne(u => u.UserProfile)
    .HasForeignKey<UserProfile>(x => x.UserId)
    .OnDelete(DeleteBehavior.Cascade);

// ExperienceId on UserProfile is optional
mb.Entity<UserProfile>()
    .HasOne(x => x.Experience)
    .WithMany(e => e.UserProfiles)
    .HasForeignKey(x => x.ExperienceId)
    .IsRequired(false)
    .OnDelete(DeleteBehavior.SetNull);

// MailQueue.JobId is nullable
mb.Entity<MailQueue>()
    .HasOne(x => x.Job)
    .WithMany(j => j.MailQueues)
    .HasForeignKey(x => x.JobId)
    .IsRequired(false)
    .OnDelete(DeleteBehavior.SetNull);
```

---

## 7. DTOs

### Auth DTOs
```csharp
// Request DTOs
public class RegisterRequestDto
{
    public string FullName { get; set; }
    public string Username { get; set; }
    public string Email { get; set; }
    public string Password { get; set; }
}

public class LoginRequestDto
{
    public string Email { get; set; }
    public string Password { get; set; }
}

public class RefreshTokenRequestDto
{
    public string RefreshToken { get; set; }
}

// Response DTO
public class AuthResponseDto
{
    public int UserId { get; set; }
    public string FullName { get; set; }
    public string Email { get; set; }
    public string Role { get; set; }
    public string AccessToken { get; set; }
    public string RefreshToken { get; set; }
    public DateTime AccessTokenExpiresAt { get; set; }
}
```

### Job DTOs
```csharp
public class JobListItemDto
{
    public int Id { get; set; }
    public string Title { get; set; }
    public string Company { get; set; }
    public string Source { get; set; }
    public string SourceUrl { get; set; }
    public string Location { get; set; }
    public bool IsRemote { get; set; }
    public string JobType { get; set; }
    public decimal? MinSalary { get; set; }
    public decimal? MaxSalary { get; set; }
    public DateTime FetchedAt { get; set; }
    public List<string> Skills { get; set; }
    public int? MatchPercentage { get; set; }  // null if not calculating match
    public bool IsSaved { get; set; }
}

public class JobDetailDto : JobListItemDto
{
    public string Description { get; set; }
}

public class PagedResultDto<T>
{
    public List<T> Items { get; set; }
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}

public class JobFilterDto
{
    public string? Source { get; set; }
    public string? Location { get; set; }
    public List<int>? SkillIds { get; set; }
    public bool? IsRemote { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
```

### Preference DTOs
```csharp
public class UserPreferenceDto
{
    public int? ExperienceId { get; set; }
    public bool IsRemoteOnly { get; set; }
    public decimal? MinSalary { get; set; }
    public decimal? MaxSalary { get; set; }
    public int MinMatchPercentage { get; set; } = 50;
    public bool IsEmailNotification { get; set; }
    public List<int> SkillIds { get; set; }
    public List<int> LocationIds { get; set; }
}

public class UserPreferenceResponseDto : UserPreferenceDto
{
    public List<SkillDto> Skills { get; set; }
    public List<LocationDto> Locations { get; set; }
    public ExperienceDto Experience { get; set; }
}
```

### Common DTOs
```csharp
public class SkillDto       { public int Id { get; set; } public string Name { get; set; } }
public class LocationDto    { public int Id { get; set; } public string Name { get; set; } }
public class ExperienceDto  { public int Id { get; set; } public string Name { get; set; } }

public class ApiResponseDto<T>
{
    public bool Success { get; set; }
    public T Data { get; set; }
    public string Message { get; set; }
}
```

---

## 8. Services & Interfaces

### IAuthService
```csharp
public interface IAuthService
{
    Task<AuthResponseDto> RegisterAsync(RegisterRequestDto dto, string ipAddress);
    Task<AuthResponseDto> LoginAsync(LoginRequestDto dto, string ipAddress);
    Task<AuthResponseDto> RefreshTokenAsync(string refreshToken, string ipAddress);
    Task RevokeTokenAsync(string refreshToken);
}
```

### IJwtService
```csharp
public interface IJwtService
{
    string GenerateAccessToken(User user);
    string GenerateRefreshToken();
    ClaimsPrincipal GetPrincipalFromExpiredToken(string token);
}
```

### ICacheService
```csharp
public interface ICacheService
{
    Task<T?> GetAsync<T>(string key);
    Task SetAsync<T>(string key, T value, TimeSpan? ttl = null);
    Task RemoveAsync(string key);
    Task RemoveByPatternAsync(string pattern);
    Task<bool> AcquireLockAsync(string key, string value, TimeSpan ttl);
    Task ReleaseLockAsync(string key, string value);
    Task<bool> IsBlacklistedAsync(string jti);
    Task BlacklistTokenAsync(string jti, TimeSpan ttl);
}
```

### IMatchingService
```csharp
public interface IMatchingService
{
    int CalculateMatchScore(IEnumerable<int> userSkillIds, IEnumerable<int> jobSkillIds);
    Task<List<JobListItemDto>> GetTopMatchesAsync(int userId, int limit = 20);
}
```

### IMessagePublisher
```csharp
public interface IMessagePublisher
{
    Task PublishJobFetchedAsync(int jobId);
    Task PublishEmailSendAsync(EmailSendMessage message);
    Task PublishNotificationAsync(NotificationMessage message);
}

public class EmailSendMessage
{
    public int UserId { get; set; }
    public int JobId { get; set; }
    public int MailQueueId { get; set; }
    public string To { get; set; }
    public string Subject { get; set; }
    public string Body { get; set; }
}

public class NotificationMessage
{
    public int UserId { get; set; }
    public string Title { get; set; }
    public string Message { get; set; }
    public string Type { get; set; }
}
```

### AuthService — Key Implementation Rules

```csharp
// Register flow:
// 1. Check email uniqueness
// 2. Check username uniqueness
// 3. Get "User" role from DB
// 4. Hash password with BCrypt.HashPassword(dto.Password)
// 5. Save User entity
// 6. Create empty UserProfile
// 7. Log successful attempt in LoginAttempts
// 8. Queue welcome email in mail_queue with status = Pending
// 9. Generate and return tokens

// Login flow:
// 1. Find user by email
// 2. If not found OR BCrypt.Verify fails → SAME error message "Invalid email or password"
//    (never reveal which was wrong)
// 3. Check user.IsActive
// 4. Log attempt (success or failure)
// 5. Generate and return tokens

// RefreshToken flow:
// 1. Find token by value, include User + Role
// 2. Check token.IsActive (not expired, not revoked)
// 3. Revoke old token (set RevokedAt = now)
// 4. Generate new access token + new refresh token
// 5. Return both

// Revoke flow:
// 1. Find token, check IsActive
// 2. Set RevokedAt = now
// 3. Store JTI in Redis blacklist with TTL = remaining access token lifetime
```

---

## 9. Controllers & Endpoints

### Rules for ALL Controllers
- Controllers are THIN — zero business logic
- Only: receive request → call service → return response
- Always return `ApiResponseDto<T>` wrapper
- Extract user ID from JWT claims: `User.FindFirst(ClaimTypes.NameIdentifier)?.Value`
- IP address extracted from `X-Forwarded-For` header first, then `RemoteIpAddress`

### AuthController — `/api/auth`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/register` | Public | Register user |
| POST | `/login` | Public | Login, returns tokens |
| POST | `/refresh` | Public | Refresh access token |
| POST | `/revoke` | Bearer | Logout / revoke token |
| GET | `/me` | Bearer | Current user from JWT claims |

### MasterDataController — `/api/master`

| Method | Route | Auth | Cache TTL | Description |
|---|---|---|---|---|
| GET | `/skills` | Public | 24 hours | All active skills |
| GET | `/locations` | Public | 24 hours | All active locations |
| GET | `/experiences` | Public | 24 hours | All experience levels |

### PreferencesController — `/api/preferences`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/` | Bearer | Get full preference profile |
| PUT | `/` | Bearer | Update all preferences at once |
| POST | `/skills` | Bearer | Add a skill |
| DELETE | `/skills/{skillId}` | Bearer | Remove a skill |
| POST | `/locations` | Bearer | Add a location |
| DELETE | `/locations/{locationId}` | Bearer | Remove a location |

### JobsController — `/api/jobs`

| Method | Route | Auth | Cache | Description |
|---|---|---|---|---|
| GET | `/` | Bearer | 10 min | Paginated job list with filters |
| GET | `/matches` | Bearer | 15 min per user | Top matched jobs for user |
| GET | `/{id}` | Bearer | 30 min | Job detail |
| POST | `/{id}/save` | Bearer | — | Save / unsave a job |
| GET | `/saved` | Bearer | — | All saved jobs |

### AlertsController — `/api/alerts`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/` | Bearer | Alert history with job details |

### NotificationsController — `/api/notifications`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/` | Bearer | Notification feed (supports ?unread=true) |
| PATCH | `/{id}/read` | Bearer | Mark one as read |
| PATCH | `/read-all` | Bearer | Mark all as read |

### AdminController — `/api/admin`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/fetch-jobs` | Bearer + Admin Role | Manually trigger FetchJobsWorker |

### Health Check

```csharp
// Add to Program.cs
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));
```

---

## 10. Background Workers

All workers implement `BackgroundService` (which extends `IHostedService`).

### FetchJobsWorker

**Schedule:** Every 2 hours (use `PeriodicTimer`)

**Steps in order:**
1. Try to acquire Redis lock: key = `lock:fetch-jobs`, TTL = 90 minutes
2. If lock not acquired → skip this run (another instance is running)
3. Update `background_tasks` — set `last_status = Running`, `last_run_at = now`
4. Fetch from Remotive: `GET https://remotive.com/api/remote-jobs?category=software-dev&limit=100`
5. Fetch from Arbeitnow: `GET https://arbeitnow.com/api/job-board-api`
6. Parse WWR RSS: `https://weworkremotely.com/remote-jobs.rss`
7. For each job from each source:
   - Check if `(external_id, source)` already exists in DB → skip if yes
   - Map API response to Job entity
   - Extract skills: check job title + description for known skill names (case-insensitive contains)
   - Save job to DB
   - Save job_skills rows
8. Publish `job.fetched` message to RabbitMQ for each new job ID
9. Invalidate Redis cache keys matching `jobs:list:*`
10. Release Redis lock
11. Update `background_tasks` — set `last_status = Success` or `Failed`, `next_run_at`

**Remotive API response mapping:**
```
response.jobs[i].id          → ExternalId
"Remotive"                   → Source
response.jobs[i].url         → SourceUrl
response.jobs[i].title       → Title
response.jobs[i].company_name → Company
response.jobs[i].description → Description
response.jobs[i].job_type    → JobType
response.jobs[i].candidate_required_location → Location
true                         → IsRemote (Remotive is always remote)
```

**Skill extraction logic:**
```csharp
// Load all skill names from DB once at start
// For each job, check title + description:
var matchedSkillIds = allSkills
    .Where(s => 
        job.Title.Contains(s.Name, StringComparison.OrdinalIgnoreCase) ||
        job.Description.Contains(s.Name, StringComparison.OrdinalIgnoreCase))
    .Select(s => s.Id)
    .ToList();
```

---

### MatchAndAlertWorker

**Trigger:** Consumes `jobs.new` queue from RabbitMQ (NOT a scheduled timer)

**Steps per message (message contains jobId):**
1. Load job + job skill IDs from DB
2. Load all active users with `IsEmailNotification = true`
3. For each user:
   - Load user skill IDs and preferred location IDs
   - Calculate match score: `(userSkillIds ∩ jobSkillIds).Count / jobSkillIds.Count * 100`
   - If score < user.MinMatchPercentage (default 50) → skip
   - Check `alert_history` for (userId, jobId) — if exists → skip
   - Insert `mail_queue` row with status = Pending
   - Publish `email.send` message to RabbitMQ
   - Insert `alert_history` row
   - Insert `notifications` row
4. Acknowledge the RabbitMQ message

**Match calculation:**
```csharp
private int CalculateMatch(List<int> userSkillIds, List<int> jobSkillIds)
{
    if (!jobSkillIds.Any()) return 0;
    var overlap = userSkillIds.Intersect(jobSkillIds).Count();
    return (int)Math.Round((double)overlap / jobSkillIds.Count * 100);
}
```

---

### MailWorker

**Trigger:** Consumes `email.send` queue from RabbitMQ

**Steps per message:**
1. Update `mail_queue` row — set `status = Processing`
2. Call SendGrid API with subject, body, receiver
3. On success:
   - Update `mail_queue` — set `status = Sent`, `sent_at = now`
   - Acknowledge (ack) the RabbitMQ message
4. On failure:
   - Increment `no_of_attempts`
   - If attempts < 3: nack with requeue=false (RabbitMQ handles retry via dead letter)
   - If attempts >= 3: Update `mail_queue` — set `status = Failed`, `error_msg`
   - Route to dead letter exchange

---

## 11. RabbitMQ Architecture

### Exchanges & Queues

```
Exchange: jobs.exchange      (type: direct)
  └── Queue: jobs.new        (routing key: job.fetched)
      └── Consumer: MatchAndAlertWorker

Exchange: email.exchange     (type: direct)
  ├── Queue: email.send      (routing key: email.send)
  │   └── Consumer: MailWorker
  └── Queue: email.dead      (routing key: email.failed)
      └── Consumer: DeadLetterHandler (logs + updates mail_queue)

Exchange: notification.exchange  (type: fanout)
  └── Queue: notification.create
      └── Consumer: NotificationWorker (inserts into notifications table)
```

### Queue Configuration

```csharp
// Dead letter exchange setup for email.send queue
var queueArgs = new Dictionary<string, object>
{
    { "x-dead-letter-exchange", "email.exchange" },
    { "x-dead-letter-routing-key", "email.failed" },
    { "x-message-ttl", 300000 }  // 5 min TTL before going to dead letter
};
channel.QueueDeclare("email.send", durable: true, exclusive: false, autoDelete: false, arguments: queueArgs);
```

### Message Payload Formats

```json
// job.fetched message
{ "jobId": 142, "fetchedAt": "2026-06-01T10:00:00Z", "source": "Remotive" }

// email.send message
{
  "userId": 5,
  "jobId": 142,
  "mailQueueId": 89,
  "to": "user@example.com",
  "subject": "New match: Senior .NET Developer at Techwave (92%)",
  "body": "<html>...</html>"
}

// notification message
{
  "userId": 5,
  "title": "New job match — 92%",
  "message": "Senior .NET Developer at Techwave GmbH matches your profile",
  "type": "job_match"
}
```

---

## 12. Redis Usage

### 4 Responsibilities

#### 1. Read Cache
```
Key pattern              TTL        Content
─────────────────────────────────────────────────────────
skills:all               24 hrs     Full skills list
locations:all            24 hrs     Full locations list
experiences:all          24 hrs     Full experiences list
jobs:list:{filterHash}   10 min     Paginated filtered job list
jobs:detail:{jobId}      30 min     Single job + skills
user:matches:{userId}    15 min     Top job matches for user
notifications:{uid}:count 5 min    Unread notification count
```

#### 2. Distributed Lock
```
Key: lock:fetch-jobs       TTL: 90 min
Key: lock:match-alert      TTL: 60 min

// Acquire: SET key value NX EX {seconds}
// Returns null if already held by another instance
// Release: only if value matches (to avoid releasing another instance's lock)
```

#### 3. Rate Limiter
```
Key: ratelimit:{userId}:{minuteBucket}    TTL: 1 min

Limits:
  /auth/*              → 10 req/min
  /api/jobs            → 100 req/min
  /api/preferences     → 20 req/min
  General              → 200 req/min
```

#### 4. JWT Blacklist
```
Key: blacklist:jwt:{jti}    Value: "revoked"    TTL: remaining token lifetime

// Set when user calls POST /auth/revoke
// Checked in JWT validation middleware on every request
// TTL matches access token remaining lifetime (max 15 min)
```

---

## 13. Angular Frontend

### App Configuration

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withInterceptors([authInterceptor])),
  ]
};
```

### Routes

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent) },
  {
    path: 'auth', canActivate: [guestGuard], children: [
      { path: 'login',    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./pages/auth/register/register.component').then(m => m.RegisterComponent) },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },
  { path: 'dashboard',   canActivate: [authGuard], loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'jobs',        canActivate: [authGuard], loadComponent: () => import('./pages/jobs/jobs-list/jobs-list.component').then(m => m.JobsListComponent) },
  { path: 'jobs/:id',    canActivate: [authGuard], loadComponent: () => import('./pages/jobs/job-detail/job-detail.component').then(m => m.JobDetailComponent) },
  { path: 'alerts',      canActivate: [authGuard], loadComponent: () => import('./pages/alerts/alerts.component').then(m => m.AlertsComponent) },
  { path: 'saved',       canActivate: [authGuard], loadComponent: () => import('./pages/saved/saved.component').then(m => m.SavedComponent) },
  { path: 'preferences', canActivate: [authGuard], loadComponent: () => import('./pages/preferences/preferences.component').then(m => m.PreferencesComponent) },
  { path: '**', redirectTo: '' }
];
```

### Auth Interceptor

```typescript
// Attaches Bearer token to every request
// Skips auth endpoints
// On 401 → clear tokens → redirect to /auth/login
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/register') || req.url.includes('/auth/refresh');
  const token = localStorage.getItem('accessToken');
  const authReq = (token && !isAuthEndpoint)
    ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
    : req;
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    })
  );
};
```

### Angular Services

```typescript
// auth.service.ts — methods:
register(dto: RegisterRequestDto): Observable<AuthResponseDto>
login(dto: LoginRequestDto): Observable<AuthResponseDto>
logout(): Observable<void>
refreshToken(): Observable<AuthResponseDto>
isLoggedIn(): boolean
getCurrentUser(): CurrentUserDto | null

// job.service.ts — methods:
getJobs(filters: JobFilterDto): Observable<PagedResultDto<JobListItemDto>>
getJobMatches(): Observable<JobListItemDto[]>
getJobById(id: number): Observable<JobDetailDto>
saveJob(id: number): Observable<void>
getSavedJobs(): Observable<JobListItemDto[]>

// preference.service.ts — methods:
getPreferences(): Observable<UserPreferenceResponseDto>
updatePreferences(dto: UserPreferenceDto): Observable<void>
addSkill(skillId: number): Observable<void>
removeSkill(skillId: number): Observable<void>
addLocation(locationId: number): Observable<void>
removeLocation(locationId: number): Observable<void>

// master-data.service.ts — methods:
getSkills(): Observable<SkillDto[]>
getLocations(): Observable<LocationDto[]>
getExperiences(): Observable<ExperienceDto[]>
```

### Pages to Build

| Page | Route | Key Features |
|---|---|---|
| Landing | `/` | Hero, floating cards, how-it-works, CTA |
| Login | `/auth/login` | Email/password form, social auth buttons (Phase 2), JWT |
| Register | `/auth/register` | 4-step onboarding: account → skills → preferences → notifications |
| Dashboard | `/dashboard` | Stats cards, recent matches, worker status badge |
| Jobs List | `/jobs` | Filters sidebar, paginated cards with match %, save button |
| Job Detail | `/jobs/:id` | Full description, skills, apply button, match bar |
| Alerts | `/alerts` | Email alert history, delivered/failed status |
| Saved Jobs | `/saved` | Saved job cards with unsave option |
| Preferences | `/preferences` | Edit skills, locations, salary, match threshold |

### CSS Design System

**Color tokens in `src/styles/_variables.css`:**
```css
:root {
  --bg-base:        #09080f;
  --bg-surface:     #100e1a;
  --bg-elevated:    #18152a;
  --bg-overlay:     #1f1b30;
  --border-subtle:  #1e1a2e;
  --border-default: #2a2440;
  --border-strong:  #3d3560;
  --accent:         #7c3aed;
  --accent-hover:   #6d28d9;
  --accent-light:   #a78bfa;
  --accent-muted:   #2d1f52;
  --accent-border:  #4c3580;
  --text-primary:   #f0eaff;
  --text-secondary: #9d8fbb;
  --text-muted:     #5a4f73;
  --color-success:  #10b981;
  --color-warning:  #f59e0b;
  --color-error:    #f87171;
  --font-base:      'Outfit', sans-serif;
  --font-mono:      'DM Mono', monospace;
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px;
  --shadow-glow: 0 0 30px rgba(124,58,237,0.3);
}
```

**`tailwind.config.js` must extend with these hex values as named colors**
so you can use `bg-bg-surface`, `text-text-primary`, `border-border-default` etc.

---

## 14. Docker Setup

### docker-compose.yml

```yaml
version: '3.8'

services:

  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime
    ports:
      - "5000:80"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ConnectionStrings__DefaultConnection=${DB_CONNECTION}
      - Jwt__SecretKey=${JWT_SECRET}
      - Jwt__Issuer=jobping-api
      - Jwt__Audience=jobping-client
      - Jwt__AccessTokenExpiryMinutes=15
      - Redis__ConnectionString=redis:6379
      - RabbitMQ__Host=rabbitmq
      - RabbitMQ__Username=${RABBITMQ_USER}
      - RabbitMQ__Password=${RABBITMQ_PASSWORD}
      - SendGrid__ApiKey=${SENDGRID_API_KEY}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    restart: unless-stopped

  worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: runtime
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - RUN_MODE=worker
      - ConnectionStrings__DefaultConnection=${DB_CONNECTION}
      - Redis__ConnectionString=redis:6379
      - RabbitMQ__Host=rabbitmq
      - RabbitMQ__Username=${RABBITMQ_USER}
      - RabbitMQ__Password=${RABBITMQ_PASSWORD}
      - SendGrid__ApiKey=${SENDGRID_API_KEY}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: jobping
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d jobping"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  rabbitmq:
    image: rabbitmq:3-management
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    ports:
      - "15672:15672"  # Management UI — only in dev
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
```

### Dockerfile (Multi-Stage)

```dockerfile
# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY ["src/JobPing.API/JobPing.API.csproj", "src/JobPing.API/"]
COPY ["src/JobPing.Application/JobPing.Application.csproj", "src/JobPing.Application/"]
COPY ["src/JobPing.Infrastructure/JobPing.Infrastructure.csproj", "src/JobPing.Infrastructure/"]
COPY ["src/JobPing.Domain/JobPing.Domain.csproj", "src/JobPing.Domain/"]

RUN dotnet restore "src/JobPing.API/JobPing.API.csproj"

COPY . .
RUN dotnet publish "src/JobPing.API/JobPing.API.csproj" -c Release -o /app/publish

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 80

ENTRYPOINT ["dotnet", "JobPing.API.dll"]
```

### nginx.conf

```nginx
events { worker_connections 1024; }

http {
  upstream api {
    server api:80;
  }

  server {
    listen 80;
    server_name jobping.dev www.jobping.dev;
    return 301 https://$server_name$request_uri;
  }

  server {
    listen 443 ssl;
    server_name jobping.dev www.jobping.dev;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # API
    location /api/ {
      proxy_pass http://api;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Health check
    location /health {
      proxy_pass http://api;
    }

    # Angular static files
    location / {
      root /usr/share/nginx/html;
      try_files $uri $uri/ /index.html;
    }
  }
}
```

---

## 15. CI/CD Pipeline

### `.github/workflows/deploy.yml`

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  release:
    types: [published]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/jobping-api

jobs:

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v3
        with:
          dotnet-version: '9.0.x'
      - run: dotnet restore
      - run: dotnet build --no-restore
      - run: dotnet test --no-build --verbosity normal

  build-push:
    needs: test
    if: github.ref == 'refs/heads/main' || github.event_name == 'release'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest

  deploy-staging:
    needs: build-push
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: root
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/jobping
            echo "IMAGE_TAG=${{ github.sha }}" > .env.tag
            docker compose pull api worker
            docker compose up -d --no-deps api worker
            sleep 15
            curl -f http://localhost/health || (docker compose rollback && exit 1)

  deploy-production:
    needs: build-push
    if: github.event_name == 'release'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://jobping.dev
    steps:
      - name: Deploy to production
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_HOST }}
          username: root
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/jobping
            echo "IMAGE_TAG=${{ github.sha }}" > .env.tag
            docker compose pull api worker
            docker compose up -d --no-deps api worker
            sleep 20
            curl -f https://jobping.dev/health || (docker compose rollback && exit 1)
```

---

## 16. Build Order

Build in this exact order. Do not skip. Do not reorder.

```
Step 1  — Master Data APIs + Redis Cache            (2–3 days)
Step 2  — User Preferences API                      (3–4 days)
Step 3  — Angular Onboarding wired to real APIs     (3–4 days)
Step 4  — FetchJobsWorker (Remotive first)           (4–5 days)
Step 5  — Jobs API + Redis Cache                    (2–3 days)
Step 6  — Matching Engine                           (4–5 days)
Step 7  — RabbitMQ + Alert + Mail Workers           (5–6 days)
Step 8  — Docker Compose all 6 services             (2–3 days)
Step 9  — Deploy to live server                     (2–3 days)
Step 10 — GitHub Actions CI/CD                      (2–3 days)
```

---

## 17. Environment Variables

### `.env` file (never commit this)

```env
# Database
DB_USER=postgres
DB_PASSWORD=your_strong_password
DB_CONNECTION=Host=db;Port=5432;Database=jobping;Username=postgres;Password=your_strong_password

# JWT
JWT_SECRET=YourSuperSecretKeyMustBeAtLeast32CharactersLong!

# Redis
REDIS_PASSWORD=your_redis_password

# RabbitMQ
RABBITMQ_USER=jobping
RABBITMQ_PASSWORD=your_rabbitmq_password

# SendGrid
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@jobping.dev
SENDGRID_FROM_NAME=JobPing
```

### `appsettings.json` structure

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=jobping;Username=postgres;Password=password"
  },
  "Jwt": {
    "SecretKey": "",
    "Issuer": "jobping-api",
    "Audience": "jobping-client",
    "AccessTokenExpiryMinutes": "15",
    "RefreshTokenExpiryDays": "7"
  },
  "Redis": {
    "ConnectionString": "localhost:6379",
    "Password": ""
  },
  "RabbitMQ": {
    "Host": "localhost",
    "Port": 5672,
    "Username": "guest",
    "Password": "guest",
    "VirtualHost": "/"
  },
  "SendGrid": {
    "ApiKey": "",
    "FromEmail": "noreply@jobping.dev",
    "FromName": "JobPing"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}
```

---

## 18. Coding Rules

### General
1. **Clean Architecture is mandatory.** Controllers call services. Services call repositories/DbContext. No business logic in controllers. No EF queries in controllers.
2. **Never hardcode secrets.** Use `IConfiguration` to read from `appsettings.json` or environment variables.
3. **All DateTime values use `DateTime.UtcNow`** — never `DateTime.Now`.
4. **All DB column names in snake_case**, entity properties in PascalCase.
5. **Use `async/await` everywhere** that touches DB, Redis, RabbitMQ, or HTTP.

### Error Handling
6. Use global exception middleware — catch all unhandled exceptions, return consistent `ApiResponseDto` with error message.
7. Never expose stack traces in production responses.
8. Log all exceptions with structured logging (`ILogger<T>`).

### Security
9. Never return `User.PasswordHash` in any response DTO.
10. Use the same error message for wrong email AND wrong password — `"Invalid email or password."` — never say which one was wrong.
11. Validate all incoming DTOs. Return `400` with field-level errors if invalid.
12. JWT auth: `ClockSkew = TimeSpan.Zero` — no grace period after expiry.

### Database
13. **Never store arrays in columns.** Always use junction tables.
14. Run `db.Database.Migrate()` on startup in development. Never in production CI/CD.
15. Never delete and re-insert junction rows when updating. Find the delta (added, removed) and apply only that.

### Redis
16. Always set a TTL on every Redis key. Never store without expiry.
17. Cache keys must be deterministic and namespaced: `{entity}:{identifier}:{variant}`.
18. On cache miss: query DB, store result in Redis, return result.

### RabbitMQ
19. Always `ack()` a message only after processing completes successfully.
20. `nack()` with `requeue=false` on failure — let the dead letter exchange handle retry.
21. Messages must be serialized as JSON.
22. Exchanges and queues declared as `durable: true`.

### Angular
23. All components are standalone. No NgModule.
24. Use `inject()` function for dependency injection in components (not constructor injection).
25. Every HTTP call goes through a service — never call `HttpClient` directly from a component.
26. Loading state and error state must be handled on every API call.
27. Use Angular Material `MatSnackBar` for success/error toasts.

---

## Quick Reference: EF Core Migration Commands

```bash
# From solution root:
dotnet ef migrations add InitialCreate \
  --project src/JobPing.Infrastructure \
  --startup-project src/JobPing.API

dotnet ef database update \
  --project src/JobPing.Infrastructure \
  --startup-project src/JobPing.API
```

## Quick Reference: Docker Commands

```bash
# Start everything
docker compose up -d

# View logs
docker compose logs -f api
docker compose logs -f worker

# Rebuild after code change
docker compose up -d --build api worker

# Stop everything
docker compose down

# Stop and remove volumes (wipes DB)
docker compose down -v
```

---

*This document covers the complete specification for JobPing v1.0.*
*Build in the order specified. Ask for clarification on specific steps before implementing.*
*The goal is a live, deployed, working product at https://jobping.dev by October 2026.*
