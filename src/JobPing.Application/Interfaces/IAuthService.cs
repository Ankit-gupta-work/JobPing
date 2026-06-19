using JobPing.Application.DTOs.Auth;

namespace JobPing.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponseDto> RegisterAsync(RegisterRequestDto dto, string ipAddress);
    Task<AuthResponseDto> LoginAsync(LoginRequestDto dto, string ipAddress);
    Task<AuthResponseDto> RefreshTokenAsync(string refreshToken, string ipAddress);
    Task RevokeTokenAsync(string refreshToken);
}
