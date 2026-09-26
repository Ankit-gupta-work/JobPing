using JobPing.Application.DTOs.Jobs;
using JobPing.Application.Interfaces;
using JobPing.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace JobPing.Infrastructure.Services;

public class MatchingService : IMatchingService
{
    private static readonly TimeSpan MatchesTtl = TimeSpan.FromMinutes(15);

    private readonly JobPingDbContext _db;
    private readonly ICacheService _cache;

    public MatchingService(JobPingDbContext db, ICacheService cache)
    {
        _db = db;
        _cache = cache;
    }

    // (userSkillIds ∩ jobSkillIds).Count / jobSkillIds.Count * 100, rounded. No job skills → 0.
    public int CalculateMatchScore(IEnumerable<int> userSkillIds, IEnumerable<int> jobSkillIds)
    {
        var jobIds = jobSkillIds as ICollection<int> ?? jobSkillIds.ToList();
        if (jobIds.Count == 0)
            return 0;

        var overlap = userSkillIds.Intersect(jobIds).Count();
        return (int)Math.Round(overlap / (double)jobIds.Count * 100);
    }

    public async Task<List<JobListItemDto>> GetTopMatchesAsync(int userId, int limit = 20)
    {
        var cacheKey = MatchCacheKey(userId);

        var cached = await _cache.GetAsync<List<JobListItemDto>>(cacheKey);
        if (cached is not null)
            return cached;

        var userSkillIds = await _db.UserSkills
            .Where(us => us.UserId == userId)
            .Select(us => us.SkillId)
            .ToListAsync();

        var profile = await _db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId);
        var threshold = profile?.MinMatchPercentage ?? 50;

        var candidates = await _db.Jobs.AsNoTracking()
            .Where(j => j.IsActive)
            .Select(j => new
            {
                j.Id,
                j.FetchedAt,
                SkillIds = j.JobSkills.Select(js => js.SkillId).ToList(),
            })
            .ToListAsync();

        var ranked = candidates
            .Select(j => new { j.Id, j.FetchedAt, Score = CalculateMatchScore(userSkillIds, j.SkillIds) })
            .Where(j => j.Score >= threshold)
            .OrderByDescending(j => j.Score)
            .ThenByDescending(j => j.FetchedAt)
            .Take(limit)
            .ToList();

        if (ranked.Count == 0)
        {
            await _cache.SetAsync(cacheKey, new List<JobListItemDto>(), MatchesTtl);
            return new List<JobListItemDto>();
        }

        var scoreById = ranked.ToDictionary(j => j.Id, j => j.Score);
        var ids = ranked.Select(j => j.Id).ToList();

        var dtosById = await _db.Jobs.AsNoTracking()
            .Where(j => ids.Contains(j.Id))
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
            .ToDictionaryAsync(j => j.Id);

        var savedIds = (await _db.SavedJobs
            .Where(s => s.UserId == userId && s.IsActive && ids.Contains(s.JobId))
            .Select(s => s.JobId)
            .ToListAsync())
            .ToHashSet();

        // Preserve rank order from `ranked` — the dictionary lookup above doesn't.
        var result = ranked
            .Select(r =>
            {
                var dto = dtosById[r.Id];
                dto.MatchPercentage = scoreById[r.Id];
                dto.IsSaved = savedIds.Contains(r.Id);
                return dto;
            })
            .ToList();

        await _cache.SetAsync(cacheKey, result, MatchesTtl);
        return result;
    }

    private static string MatchCacheKey(int userId) => $"user:matches:{userId}";
}
