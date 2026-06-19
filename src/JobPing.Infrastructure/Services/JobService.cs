using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using JobPing.Application.DTOs.Jobs;
using JobPing.Application.Interfaces;
using JobPing.Domain.Entities;
using JobPing.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace JobPing.Infrastructure.Services;

public class JobService : IJobService
{
    private static readonly TimeSpan ListTtl = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan DetailTtl = TimeSpan.FromMinutes(30);
    private const int MaxPageSize = 100;

    private readonly JobPingDbContext _db;
    private readonly ICacheService _cache;

    public JobService(JobPingDbContext db, ICacheService cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<PagedResultDto<JobListItemDto>> GetJobsAsync(JobFilterDto filter, int? userId)
    {
        var page = filter.Page < 1 ? 1 : filter.Page;
        var pageSize = filter.PageSize is < 1 or > MaxPageSize ? 20 : filter.PageSize;
        filter.Page = page;
        filter.PageSize = pageSize;

        var cacheKey = BuildListCacheKey(filter);

        // User-agnostic page (IsSaved always false in cache) — overlay per user afterwards.
        var result = await _cache.GetAsync<PagedResultDto<JobListItemDto>>(cacheKey);
        if (result is null)
        {
            var query = _db.Jobs.AsNoTracking().Where(j => j.IsActive);

            if (!string.IsNullOrWhiteSpace(filter.Source))
                query = query.Where(j => j.Source == filter.Source);

            if (filter.IsRemote.HasValue)
                query = query.Where(j => j.IsRemote == filter.IsRemote.Value);

            if (!string.IsNullOrWhiteSpace(filter.Location))
                query = query.Where(j => j.Location != null && EF.Functions.ILike(j.Location, $"%{filter.Location}%"));

            if (filter.SkillIds is { Count: > 0 })
                query = query.Where(j => j.JobSkills.Any(js => filter.SkillIds.Contains(js.SkillId)));

            var totalCount = await query.CountAsync();

            var items = await query
                .OrderByDescending(j => j.FetchedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(j => new JobListItemDto
                {
                    Id = j.Id,
                    Title = j.Title,
                    Company = j.Company,
                    Source = j.Source,
                    SourceUrl = j.SourceUrl,
                    Location = j.Location,
                    IsRemote = j.IsRemote,
                    JobType = j.JobType,
                    MinSalary = j.MinSalary,
                    MaxSalary = j.MaxSalary,
                    FetchedAt = j.FetchedAt,
                    Skills = j.JobSkills.Select(js => js.Skill.Name).ToList(),
                    MatchPercentage = null,
                    IsSaved = false,
                })
                .ToListAsync();

            result = new PagedResultDto<JobListItemDto>
            {
                Items = items,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
            };

            await _cache.SetAsync(cacheKey, result, ListTtl);
        }

        await OverlaySavedAsync(result.Items, userId);
        return result;
    }

    public async Task<JobDetailDto?> GetJobByIdAsync(int id, int? userId)
    {
        var cacheKey = $"jobs:detail:{id}";

        var detail = await _cache.GetAsync<JobDetailDto>(cacheKey);
        if (detail is null)
        {
            detail = await _db.Jobs.AsNoTracking()
                .Where(j => j.Id == id && j.IsActive)
                .Select(j => new JobDetailDto
                {
                    Id = j.Id,
                    Title = j.Title,
                    Company = j.Company,
                    Source = j.Source,
                    SourceUrl = j.SourceUrl,
                    Location = j.Location,
                    IsRemote = j.IsRemote,
                    JobType = j.JobType,
                    MinSalary = j.MinSalary,
                    MaxSalary = j.MaxSalary,
                    FetchedAt = j.FetchedAt,
                    Description = j.Description,
                    Skills = j.JobSkills.Select(js => js.Skill.Name).ToList(),
                    MatchPercentage = null,
                    IsSaved = false,
                })
                .FirstOrDefaultAsync();

            if (detail is null)
                return null;

            await _cache.SetAsync(cacheKey, detail, DetailTtl);
        }

        if (userId.HasValue)
        {
            detail.IsSaved = await _db.SavedJobs
                .AnyAsync(s => s.UserId == userId.Value && s.JobId == id && s.IsActive);

            // Record a "Viewed" history entry.
            _db.UserJobHistories.Add(new UserJobHistory
            {
                UserId = userId.Value,
                JobId = id,
                Status = "Viewed",
            });
            await _db.SaveChangesAsync();
        }

        return detail;
    }

    public async Task<List<JobListItemDto>> GetSavedJobsAsync(int userId)
    {
        return await _db.SavedJobs.AsNoTracking()
            .Where(s => s.UserId == userId && s.IsActive)
            .OrderByDescending(s => s.CreatedOn)
            .Select(s => new JobListItemDto
            {
                Id = s.Job.Id,
                Title = s.Job.Title,
                Company = s.Job.Company,
                Source = s.Job.Source,
                SourceUrl = s.Job.SourceUrl,
                Location = s.Job.Location,
                IsRemote = s.Job.IsRemote,
                JobType = s.Job.JobType,
                MinSalary = s.Job.MinSalary,
                MaxSalary = s.Job.MaxSalary,
                FetchedAt = s.Job.FetchedAt,
                Skills = s.Job.JobSkills.Select(js => js.Skill.Name).ToList(),
                MatchPercentage = null,
                IsSaved = true,
            })
            .ToListAsync();
    }

    public async Task ToggleSaveJobAsync(int userId, int jobId)
    {
        var existing = await _db.SavedJobs.FirstOrDefaultAsync(s => s.UserId == userId && s.JobId == jobId);
        if (existing is not null)
        {
            // save → unsave → save
            existing.IsActive = !existing.IsActive;
        }
        else
        {
            var jobExists = await _db.Jobs.AnyAsync(j => j.Id == jobId);
            if (!jobExists)
                throw new KeyNotFoundException($"Job {jobId} does not exist.");

            _db.SavedJobs.Add(new SavedJob { UserId = userId, JobId = jobId, IsActive = true });
        }

        await _db.SaveChangesAsync();
    }

    // ---- helpers ----

    private async Task OverlaySavedAsync(List<JobListItemDto> items, int? userId)
    {
        if (userId is null || items.Count == 0)
            return;

        var ids = items.Select(i => i.Id).ToList();
        var savedIds = await _db.SavedJobs
            .Where(s => s.UserId == userId.Value && s.IsActive && ids.Contains(s.JobId))
            .Select(s => s.JobId)
            .ToListAsync();

        var savedSet = savedIds.ToHashSet();
        foreach (var item in items)
            item.IsSaved = savedSet.Contains(item.Id);
    }

    private static string BuildListCacheKey(JobFilterDto filter)
    {
        var json = JsonSerializer.Serialize(filter);
        var hash = MD5.HashData(Encoding.UTF8.GetBytes(json));
        return $"jobs:list:{Convert.ToHexString(hash)}";
    }
}
