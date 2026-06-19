using JobPing.Application.DTOs.Preferences;

namespace JobPing.Application.Interfaces;

public interface IPreferenceService
{
    Task<UserPreferenceResponseDto> GetPreferencesAsync(int userId);
    Task UpdatePreferencesAsync(int userId, UserPreferenceDto dto);
    Task AddSkillAsync(int userId, int skillId);
    Task RemoveSkillAsync(int userId, int skillId);
    Task AddLocationAsync(int userId, int locationId);
    Task RemoveLocationAsync(int userId, int locationId);
}
