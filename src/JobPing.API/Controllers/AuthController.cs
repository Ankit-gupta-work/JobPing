using System.Security.Claims;
using JobPing.Application.DTOs.Auth;
using JobPing.Application.DTOs.Common;
using JobPing.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace JobPing.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    private readonly ICacheService _cache;

    public AuthController(IAuthService auth, ICacheService cache)
    {
        _auth = auth;
        _cache = cache;
    }

    // POST /api/auth/register
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponseDto<AuthResponseDto>>> Register([FromBody] RegisterRequestDto dto)
    {
        var result = await _auth.RegisterAsync(dto, GetIpAddress());
        return Ok(ApiResponseDto<AuthResponseDto>.Ok(result, "Registration successful."));
    }

    // POST /api/auth/login
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponseDto<AuthResponseDto>>> Login([FromBody] LoginRequestDto dto)
    {
        var result = await _auth.LoginAsync(dto, GetIpAddress());
        return Ok(ApiResponseDto<AuthResponseDto>.Ok(result, "Login successful."));
    }

    // POST /api/auth/refresh
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponseDto<AuthResponseDto>>> Refresh([FromBody] RefreshTokenRequestDto dto)
    {
        var result = await _auth.RefreshTokenAsync(dto.RefreshToken, GetIpAddress());
        return Ok(ApiResponseDto<AuthResponseDto>.Ok(result));
    }

    // POST /api/auth/revoke
    [HttpPost("revoke")]
    [Authorize]
    public async Task<ActionResult<ApiResponseDto<object>>> Revoke([FromBody] RefreshTokenRequestDto dto)
    {
        await _auth.RevokeTokenAsync(dto.RefreshToken);

        // Blacklist this access token's JTI for its remaining lifetime.
        var jti = User.FindFirst("jti")?.Value;
        if (!string.IsNullOrEmpty(jti))
        {
            var ttl = RemainingTokenLifetime(User.FindFirst("exp")?.Value);
            if (ttl > TimeSpan.Zero)
                await _cache.BlacklistTokenAsync(jti, ttl);
        }

        return Ok(ApiResponseDto<object>.Ok(null!, "Token revoked."));
    }

    private static TimeSpan RemainingTokenLifetime(string? expClaim)
    {
        if (long.TryParse(expClaim, out var expUnix))
        {
            var remaining = DateTimeOffset.FromUnixTimeSeconds(expUnix) - DateTimeOffset.UtcNow;
            if (remaining > TimeSpan.Zero)
                return remaining;
        }
        return TimeSpan.FromMinutes(15);
    }

    // GET /api/auth/me
    [HttpGet("me")]
    [Authorize]
    public ActionResult<ApiResponseDto<object>> Me()
    {
        var me = new
        {
            userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value,
            fullName = User.FindFirst("name")?.Value,
            email = User.FindFirst("email")?.Value,
            role = User.FindFirst("role")?.Value,
        };
        return Ok(ApiResponseDto<object>.Ok(me));
    }

    // X-Forwarded-For first (behind Nginx), then the socket address.
    private string GetIpAddress()
    {
        var forwarded = Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwarded))
            return forwarded.Split(',')[0].Trim();
        return HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
