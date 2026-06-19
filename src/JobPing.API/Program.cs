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
// Controllers
// ---------------------------------------------------------------------
builder.Services.AddControllers();

// ---------------------------------------------------------------------
// PostgreSQL (EF Core)
// ---------------------------------------------------------------------
builder.Services.AddDbContext<JobPingDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ---------------------------------------------------------------------
// Redis (StackExchange.Redis)
// ---------------------------------------------------------------------
builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
{
    var connectionString = builder.Configuration["Redis:ConnectionString"] ?? "localhost:6379";
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

builder.Services.AddSingleton<JobMappingService>();
// RabbitMQ stub for now — replaced with the real publisher in Step 7.
builder.Services.AddSingleton<IMessagePublisher, LoggingMessagePublisher>();
builder.Services.AddScoped<IJobFetchService, JobFetchService>();
builder.Services.AddHostedService<FetchJobsWorker>();

// ---------------------------------------------------------------------
// JWT authentication
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// CORS — Angular dev server
// ---------------------------------------------------------------------
const string AngularCors = "AngularCors";
builder.Services.AddCors(options =>
{
    options.AddPolicy(AngularCors, policy =>
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// ---------------------------------------------------------------------
// Swagger + JWT bearer support
// ---------------------------------------------------------------------
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

var app = builder.Build();

// Global exception handling — must wrap the whole pipeline.
app.UseMiddleware<ExceptionMiddleware>();

// ---------------------------------------------------------------------
// Auto-run migrations on startup (development only)
// ---------------------------------------------------------------------
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<JobPingDbContext>();
    db.Database.Migrate();

    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors(AngularCors);

app.UseAuthentication();
app.UseMiddleware<JwtBlacklistMiddleware>(); // reject revoked access tokens
app.UseAuthorization();

app.MapControllers();

// ---------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

app.Run();
