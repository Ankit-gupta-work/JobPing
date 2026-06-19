using JobPing.Application.DTOs.Common;

namespace JobPing.Application.Interfaces;

public interface IMasterDataService
{
    Task<List<SkillDto>> GetSkillsAsync();
    Task<List<LocationDto>> GetLocationsAsync();
    Task<List<ExperienceDto>> GetExperiencesAsync();
}
