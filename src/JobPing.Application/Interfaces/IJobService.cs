using JobPing.Application.DTOs.Jobs;

namespace JobPing.Application.Interfaces;

public interface IJobService
{
    Task<PagedResultDto<JobListItemDto>> GetJobsAsync(JobFilterDto filter, int? userId);
    Task<JobDetailDto?> GetJobByIdAsync(int id, int? userId);
    Task<List<JobListItemDto>> GetSavedJobsAsync(int userId);
    Task ToggleSaveJobAsync(int userId, int jobId);
}
