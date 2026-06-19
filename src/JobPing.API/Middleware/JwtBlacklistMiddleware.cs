using System.Net;
using JobPing.Application.DTOs.Common;
using JobPing.Application.Interfaces;

namespace JobPing.API.Middleware;

/// <summary>
/// Rejects authenticated requests whose access-token JTI has been blacklisted (via /auth/revoke).
/// Runs after authentication, before authorization. Fails open on cache errors so a Redis outage
/// can't lock everyone out.
/// </summary>
public class JwtBlacklistMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<JwtBlacklistMiddleware> _logger;

    public JwtBlacklistMiddleware(RequestDelegate next, ILogger<JwtBlacklistMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, ICacheService cache)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var jti = context.User.FindFirst("jti")?.Value;
            if (!string.IsNullOrEmpty(jti))
            {
                bool blacklisted = false;
                try
                {
                    blacklisted = await cache.IsBlacklistedAsync(jti);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Blacklist check failed (treating token as valid).");
                }

                if (blacklisted)
                {
                    context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsJsonAsync(
                        ApiResponseDto<object>.Fail("Token has been revoked."));
                    return;
                }
            }
        }

        await _next(context);
    }
}
