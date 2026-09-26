using JobPing.Application.DTOs.Jobs;

namespace JobPing.Application.Interfaces;

public interface IMatchingService
{
    int CalculateMatchScore(IEnumerable<int> userSkillIds, IEnumerable<int> jobSkillIds);
    Task<List<JobListItemDto>> GetTopMatchesAsync(int userId, int limit = 20);
}
