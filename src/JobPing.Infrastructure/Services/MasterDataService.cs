using JobPing.Application.DTOs.Common;
using JobPing.Application.Interfaces;
using JobPing.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace JobPing.Infrastructure.Services;

public class MasterDataService : IMasterDataService
{
    private const string SkillsKey = "skills:all";
    private const string LocationsKey = "locations:all";
    private const string ExperiencesKey = "experiences:all";
    private static readonly TimeSpan Ttl = TimeSpan.FromHours(24);

    private readonly JobPingDbContext _db;
    private readonly ICacheService _cache;

    public MasterDataService(JobPingDbContext db, ICacheService cache)
    {
        _db = db;
        _cache = cache;
    }

    public async Task<List<SkillDto>> GetSkillsAsync()
    {
        var cached = await _cache.GetAsync<List<SkillDto>>(SkillsKey);
        if (cached is not null)
            return cached;

        var skills = await _db.Skills
            .Where(s => s.IsActive)
            .OrderBy(s => s.Name)
            .Select(s => new SkillDto { Id = s.Id, Name = s.Name })
            .ToListAsync();

        await _cache.SetAsync(SkillsKey, skills, Ttl);
        return skills;
    }

    public async Task<List<LocationDto>> GetLocationsAsync()
    {
        var cached = await _cache.GetAsync<List<LocationDto>>(LocationsKey);
        if (cached is not null)
            return cached;

        var locations = await _db.Locations
            .Where(l => l.IsActive)
            .OrderBy(l => l.Id)
            .Select(l => new LocationDto { Id = l.Id, Name = l.Name })
            .ToListAsync();

        await _cache.SetAsync(LocationsKey, locations, Ttl);
        return locations;
    }

    public async Task<List<ExperienceDto>> GetExperiencesAsync()
    {
        var cached = await _cache.GetAsync<List<ExperienceDto>>(ExperiencesKey);
        if (cached is not null)
            return cached;

        var experiences = await _db.Experiences
            .Where(e => e.IsActive)
            .OrderBy(e => e.Id)
            .Select(e => new ExperienceDto { Id = e.Id, Name = e.Name })
            .ToListAsync();

        await _cache.SetAsync(ExperiencesKey, experiences, Ttl);
        return experiences;
    }
}
