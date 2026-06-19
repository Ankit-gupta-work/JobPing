using JobPing.Application.DTOs.Auth;
using JobPing.Application.Interfaces;
using JobPing.Domain.Entities;
using JobPing.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using BCryptNet = BCrypt.Net.BCrypt;

namespace JobPing.Infrastructure.Services;

public class AuthService : IAuthService
{
    private const string InvalidCreds = "Invalid email or password.";

    private readonly JobPingDbContext _db;
    private readonly IJwtService _jwt;
    private readonly IConfiguration _config;

    public AuthService(JobPingDbContext db, IJwtService jwt, IConfiguration config)
    {
        _db = db;
        _jwt = jwt;
        _config = config;
    }

    private int RefreshDays => int.TryParse(_config["Jwt:RefreshTokenExpiryDays"], out var d) ? d : 7;
    private int AccessMinutes => int.TryParse(_config["Jwt:AccessTokenExpiryMinutes"], out var m) ? m : 15;
    private string FromEmail => _config["SendGrid:FromEmail"] ?? "noreply@jobping.dev";
    private string FromName => _config["SendGrid:FromName"] ?? "JobPing";

    public async Task<AuthResponseDto> RegisterAsync(RegisterRequestDto dto, string ipAddress)
    {
        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password) ||
            string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.FullName))
            throw new ArgumentException("All fields are required.");

        var email = dto.Email.Trim().ToLowerInvariant();
        var username = dto.Username.Trim();

        if (await _db.Users.AnyAsync(u => u.Email == email))
            throw new InvalidOperationException("Email is already registered.");
        if (await _db.Users.AnyAsync(u => u.Username == username))
            throw new InvalidOperationException("Username is already taken.");

        var role = await _db.Roles.FirstAsync(r => r.Name == "User");

        var user = new User
        {
            FullName = dto.FullName.Trim(),
            Username = username,
            Email = email,
            PasswordHash = BCryptNet.HashPassword(dto.Password),
            RoleId = role.Id,
            Role = role,
            IsActive = true,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(); // get user.Id

        // Empty profile, successful-attempt log, welcome email.
        _db.UserProfiles.Add(new UserProfile { UserId = user.Id });
        _db.LoginAttempts.Add(new LoginAttempt { UserId = user.Id, IpAddress = ipAddress, IsSuccess = true });
        _db.MailQueues.Add(new MailQueue
        {
            UserId = user.Id,
            Subject = "Welcome to JobPing 🎉",
            Body = $"<p>Hi {user.FullName},</p><p>Welcome to JobPing! Set your skills and preferences to start receiving job matches.</p>",
            Sender = $"{FromName} <{FromEmail}>",
            Receiver = user.Email,
            Status = "Pending",
        });
        await _db.SaveChangesAsync();

        return await BuildAuthResponseAsync(user);
    }

    public async Task<AuthResponseDto> LoginAsync(LoginRequestDto dto, string ipAddress)
    {
        var email = (dto.Email ?? string.Empty).Trim().ToLowerInvariant();
        var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Email == email);

        // Same message whether the email is unknown or the password is wrong.
        if (user is null || !BCryptNet.Verify(dto.Password, user.PasswordHash))
        {
            if (user is not null)
            {
                _db.LoginAttempts.Add(new LoginAttempt
                {
                    UserId = user.Id,
                    IpAddress = ipAddress,
                    IsSuccess = false,
                    ErrorMsg = InvalidCreds,
                });
                await _db.SaveChangesAsync();
            }
            throw new UnauthorizedAccessException(InvalidCreds);
        }

        if (!user.IsActive)
            throw new UnauthorizedAccessException("Your account is disabled.");

        _db.LoginAttempts.Add(new LoginAttempt { UserId = user.Id, IpAddress = ipAddress, IsSuccess = true });
        await _db.SaveChangesAsync();

        return await BuildAuthResponseAsync(user);
    }

    public async Task<AuthResponseDto> RefreshTokenAsync(string refreshToken, string ipAddress)
    {
        var token = await _db.RefreshTokens
            .Include(t => t.User).ThenInclude(u => u.Role)
            .FirstOrDefaultAsync(t => t.Token == refreshToken);

        if (token is null || !token.IsActive)
            throw new UnauthorizedAccessException("Invalid or expired refresh token.");

        // Rotate: revoke the old token, issue a fresh pair.
        token.RevokedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return await BuildAuthResponseAsync(token.User);
    }

    public async Task RevokeTokenAsync(string refreshToken)
    {
        // Revokes the refresh token. The access-token JTI blacklist (which needs the current
        // request's claims) is handled by the AuthController.
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.Token == refreshToken);
        if (token is not null && token.IsActive)
        {
            token.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
    }

    // ---- helpers ----

    private async Task<AuthResponseDto> BuildAuthResponseAsync(User user)
    {
        var accessToken = _jwt.GenerateAccessToken(user);
        var refreshToken = _jwt.GenerateRefreshToken();

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            Token = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshDays),
        });
        await _db.SaveChangesAsync();

        return new AuthResponseDto
        {
            UserId = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            Role = user.Role?.Name ?? "User",
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            AccessTokenExpiresAt = DateTime.UtcNow.AddMinutes(AccessMinutes),
        };
    }
}
