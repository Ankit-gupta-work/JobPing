using JobPing.Application.DTOs.Common;

namespace JobPing.Application.DTOs.Preferences;

public class UserPreferenceResponseDto : UserPreferenceDto
{
    public List<SkillDto> Skills { get; set; } = new();
    public List<LocationDto> Locations { get; set; } = new();
    public ExperienceDto? Experience { get; set; }
}
