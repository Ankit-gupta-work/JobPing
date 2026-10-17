using System.Text;
using JobPing.API.Middleware;
using JobPing.Application.Interfaces;
using JobPing.Infrastructure.Data;
using JobPing.Infrastructure.ExternalClients;
using JobPing.Infrastructure.Services;
using JobPing.Infrastructure.Workers;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------
// RUN_MODE — lets docker-compose run "api" (web only) and "worker"
// (background services only) as separate containers from the same image
// (CLAUDE.md §14/§16 Step 8). In Development, always run everything
// together — that's the single-process convenience every local dev/test
// session so far has relied on (`dotnet run` with no RUN_MODE set at all).
// Outside Development, RUN_MODE=worker means background-only; anything
// else (including unset, which is what the api container uses) means
// web-only. Nothing about this changes local dev behavior.
//
// RUN_MODE=all is a third option for single-service hosts (e.g. Railway,
// where running a second always-on service just for the background
// workers costs extra and the docker-compose api/worker split doesn't
// apply) — runs both the web pipeline and the background services in one
// process, same as local dev, without touching the existing api/worker
// split's default (unset) behavior.
// ---------------------------------------------------------------------
var isDevelopment = builder.Environment.IsDevelopment();
var runMode = builder.Configuration["RUN_MODE"];
var isWorkerOnly = !isDevelopment && string.Equals(runMode, "worker", StringComparison.OrdinalIgnoreCase);
var isAllMode = !isDevelopment && string.Equals(runMode, "all", StringComparison.OrdinalIgnoreCase);
var runWebPipeline = isDevelopment || !isWorkerOnly;
var runBackgroundServices = isDevelopment || isWorkerOnly || isAllMode;

// ---------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------
if (runWebPipeline)
{
    builder.Services.AddControllers();
}

// ---------------------------------------------------------------------
// PostgreSQL (EF Core)
// ---------------------------------------------------------------------
// Railway (and most hosted Postgres) injects DATABASE_URL-style connection
// info as a "postgresql://user:pass@host:port/db" URI — Npgsql's own
// connection string parser only understands the ADO.NET
// "Key=Value;Key=Value" format and throws ("Format of the initialization
// string does not conform to specification...") if handed a raw URI.
// Converts only when it looks like a URI; a normal ADO.NET string (local
// dev, Docker Compose) passes through unchanged.
builder.Services.AddDbContext<JobPingDbContext>(options =>
    options.UseNpgsql(ToNpgsqlConnectionString(builder.Configuration.GetConnectionString("DefaultConnection"))));

// ---------------------------------------------------------------------
// Redis (StackExchange.Redis)
// ---------------------------------------------------------------------
// Same URI-vs-ADO.NET mismatch as Postgres above, for Redis add-ons that
// hand back "redis://default:pass@host:port" instead of "host:port".
builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
{
    var connectionString = ToRedisConnectionString(builder.Configuration["Redis:ConnectionString"]) ?? "localhost:6379";
    var options = ConfigurationOptions.Parse(connectionString);

    var password = builder.Configuration["Redis:Password"];
    if (!string.IsNullOrWhiteSpace(password))
        options.Password = password;

    options.AbortOnConnectFail = false;
    return ConnectionMultiplexer.Connect(options);
});

// ---------------------------------------------------------------------
// Application / Infrastructure services
// ---------------------------------------------------------------------
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICacheService, RedisCacheService>();
builder.Services.AddScoped<IMasterDataService, MasterDataService>();
builder.Services.AddScoped<IPreferenceService, PreferenceService>();
builder.Services.AddScoped<IJobService, JobService>();
builder.Services.AddScoped<IMatchingService, MatchingService>();
builder.Services.AddScoped<IAlertService, AlertService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IAuthService, AuthService>();

// ---------------------------------------------------------------------
// Job fetching — external source clients, mapping, pipeline, worker
// ---------------------------------------------------------------------
builder.Services.AddHttpClient<RemotiveClient>(c =>
{
    c.BaseAddress = new Uri("https://remotive.com/");
    c.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddHttpClient<ArbeitnowClient>(c =>
{
    c.BaseAddress = new Uri("https://arbeitnow.com/");
    c.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddHttpClient<WWRRssClient>(c =>
{
    c.BaseAddress = new Uri("https://weworkremotely.com/");
    c.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddHttpClient<AdzunaClient>(c =>
{
    c.BaseAddress = new Uri("https://api.adzuna.com/");
    c.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddHttpClient<JSearchClient>(c =>
{
    c.BaseAddress = new Uri("https://jsearch.p.rapidapi.com/");
    c.Timeout = TimeSpan.FromSeconds(30);
});

builder.Services.AddSingleton<JobMappingService>();
builder.Services.AddSingleton<IMessagePublisher, RabbitMQPublisher>();
builder.Services.AddScoped<IJobFetchService, JobFetchService>();
builder.Services.AddScoped<IEmailService, SendGridEmailService>();

if (runBackgroundServices)
{
    builder.Services.AddHostedService<FetchJobsWorker>();
    builder.Services.AddHostedService<MatchAndAlertWorker>();
    builder.Services.AddHostedService<MailWorker>();
    builder.Services.AddHostedService<DeadLetterHandler>();
}

// ---------------------------------------------------------------------
// JWT authentication, CORS, Swagger — web-pipeline only, skipped entirely
// in a worker-only container (nothing there ever receives an HTTP request
// needing auth/CORS/docs).
// ---------------------------------------------------------------------
const string AngularCors = "AngularCors";

if (runWebPipeline)
{
    var jwtSecret = builder.Configuration["Jwt:SecretKey"]
        ?? throw new InvalidOperationException("Jwt:SecretKey is not configured.");

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = builder.Configuration["Jwt:Issuer"],
                ValidateAudience = true,
                ValidAudience = builder.Configuration["Jwt:Audience"],
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
                ClockSkew = TimeSpan.Zero, // no grace period after expiry
                RoleClaimType = "role" // [Authorize(Roles="Admin")] reads the "role" claim
            };
        });
    builder.Services.AddAuthorization();

    builder.Services.AddCors(options =>
    {
        // "Cors:AllowedOrigins" (comma-separated) lets a deployed frontend on a
        // different origin (e.g. Vercel) talk to this API — hardcoding
        // localhost:4200 only worked while nginx served both same-origin.
        // Falls back to localhost:4200 so local `dotnet run`/`ng serve` is
        // unaffected if the setting is never configured.
        var allowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "http://localhost:4200")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        options.AddPolicy(AngularCors, policy =>
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials());
    });

    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new OpenApiInfo { Title = "JobPing API", Version = "v1" });

        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header,
            Description = "Enter the JWT access token (without the 'Bearer ' prefix)."
        });

        c.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
                },
                Array.Empty<string>()
            }
        });
    });
}

var app = builder.Build();

// Global exception handling — must wrap the whole pipeline.
app.UseMiddleware<ExceptionMiddleware>();

// ---------------------------------------------------------------------
// Auto-run migrations on startup (development only — coding rule 14 says
// never in production; the compose stack applies migrations as a
// deliberate separate step, see PENDING.md/README for the command).
// ---------------------------------------------------------------------
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<JobPingDbContext>();
    db.Database.Migrate();
}

if (runWebPipeline)
{
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();

        // Only redirect to HTTPS for direct local access. In compose, nginx
        // terminates TLS and proxies to this container over plain HTTP —
        // redirecting there would break the proxied request entirely.
        app.UseHttpsRedirection();
    }

    app.UseCors(AngularCors);

    app.UseAuthentication();
    app.UseMiddleware<JwtBlacklistMiddleware>(); // reject revoked access tokens
    app.UseAuthorization();

    app.MapControllers();
}

// ---------------------------------------------------------------------
// Health check — always available, even in a worker-only container
// (useful for a liveness probe regardless of mode).
// ---------------------------------------------------------------------
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

app.Run();

// ---------------------------------------------------------------------
// Connection-string URI conversions — see the comments above each
// registration that calls these for why they're needed.
// ---------------------------------------------------------------------

static string? ToNpgsqlConnectionString(string? raw)
{
    if (string.IsNullOrWhiteSpace(raw)) return raw;
    if (!raw.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
        !raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        return raw;

    var uri = new Uri(raw);
    var (username, password) = SplitUserInfo(uri.UserInfo);
    var database = uri.AbsolutePath.TrimStart('/');

    return $"Host={uri.Host};Port={uri.Port};Database={database};" +
           $"Username={username};Password={password};" +
           "SSL Mode=Require;Trust Server Certificate=true;";
}

static string? ToRedisConnectionString(string? raw)
{
    if (string.IsNullOrWhiteSpace(raw)) return raw;
    if (!raw.StartsWith("redis://", StringComparison.OrdinalIgnoreCase) &&
        !raw.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase))
        return raw;

    var uri = new Uri(raw);
    var (_, password) = SplitUserInfo(uri.UserInfo);
    var conn = $"{uri.Host}:{uri.Port}";
    if (!string.IsNullOrEmpty(password))
        conn += $",password={password}";
    if (raw.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase))
        conn += ",ssl=true";
    return conn;
}

// Splits "user:pass" on the FIRST colon only (a generated password can
// itself contain one) and URL-decodes each part — connection URIs
// percent-encode special characters in credentials.
static (string Username, string Password) SplitUserInfo(string userInfo)
{
    var parts = userInfo.Split(':', 2);
    var username = parts.Length > 0 ? Uri.UnescapeDataString(parts[0]) : "";
    var password = parts.Length > 1 ? Uri.UnescapeDataString(parts[1]) : "";
    return (username, password);
}
