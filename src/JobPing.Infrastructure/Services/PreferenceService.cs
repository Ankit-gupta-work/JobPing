using JobPing.Application.DTOs.Common;
using JobPing.Application.DTOs.Preferences;
using JobPing.Application.Interfaces;
using JobPing.Domain.Entities;
using JobPing.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace JobPing.Infrastructure.Services;

public class PreferenceService : IPreferenceService
{
    private readonly JobPingDbContext _db;
    private readonly ICacheService _cache;

    public PreferenceService(JobPingDbContext db, ICacheService cache)
    {
        _db = db;
        _cache = cache;
    }

    private static string MatchCacheKey(int userId) => $"user:matches:{userId}";

    public async Task<UserPreferenceResponseDto> GetPreferencesAsync(int userId)
    {
        var profile = await _db.UserProfiles
            .Include(p => p.Experience)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId);

        var skills = await _db.UserSkills
            .Where(us => us.UserId == userId)
            .Select(us => new SkillDto { Id = us.Skill.Id, Name = us.Skill.Name })
            .ToListAsync();

        var locations = await _db.UserLocations
            .Where(ul => ul.UserId == userId)
            .Select(ul => new LocationDto { Id = ul.Location.Id, Name = ul.Location.Name })
            .ToListAsync();

        // No profile yet → return empty defaults (CLAUDE.md: null match % handled as 50).
        return new UserPreferenceResponseDto
        {
            ExperienceId = profile?.ExperienceId,
            IsRemoteOnly = profile?.IsRemoteOnly ?? false,
            MinSalary = profile?.MinSalary,
            MaxSalary = profile?.MaxSalary,
            MinMatchPercentage = profile?.MinMatchPercentage ?? 50,
            IsEmailNotification = profile?.IsEmailNotification ?? true,
            SkillIds = skills.Select(s => s.Id).ToList(),
            LocationIds = locations.Select(l => l.Id).ToList(),
            Skills = skills,
            Locations = locations,
            Experience = profile?.Experience is null
                ? null
                : new ExperienceDto { Id = profile.Experience.Id, Name = profile.Experience.Name }
        };
    }

    public async Task UpdatePreferencesAsync(int userId, UserPreferenceDto dto)
    {
        var skillIds = (dto.SkillIds ?? new List<int>()).Distinct().ToList();
        var locationIds = (dto.LocationIds ?? new List<int>()).Distinct().ToList();

        await ValidateExperienceAsync(dto.ExperienceId);
        await ValidateSkillsAsync(skillIds);
        await ValidateLocationsAsync(locationIds);

        // --- Scalar fields on UserProfile (create if first time) ---
        var profile = await _db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile is null)
        {
            profile = new UserProfile { UserId = userId, CreatedOn = DateTime.UtcNow };
            _db.UserProfiles.Add(profile);
        }

        profile.ExperienceId = dto.ExperienceId;
        profile.IsRemoteOnly = dto.IsRemoteOnly;
        profile.MinSalary = dto.MinSalary;
        profile.MaxSalary = dto.MaxSalary;
        profile.MinMatchPercentage = dto.MinMatchPercentage;
        profile.IsEmailNotification = dto.IsEmailNotification;
        profile.UpdatedOn = DateTime.UtcNow;

        // --- Delta-update junction tables (NEVER delete-all then re-insert) ---
        await ApplySkillDeltaAsync(userId, skillIds);
        await ApplyLocationDeltaAsync(userId, locationIds);

        await _db.SaveChangesAsync();

        // Preferences changed → user's cached matches are stale.
        await _cache.RemoveAsync(MatchCacheKey(userId));
    }

    public async Task AddSkillAsync(int userId, int skillId)
    {
        var exists = await _db.Skills.AnyAsync(s => s.Id == skillId && s.IsActive);
        if (!exists)
            throw new KeyNotFoundException($"Skill {skillId} does not exist.");

        var alreadyAdded = await _db.UserSkills.AnyAsync(us => us.UserId == userId && us.SkillId == skillId);
        if (alreadyAdded)
            throw new InvalidOperationException("Skill is already in your preferences.");

        _db.UserSkills.Add(new UserSkill { UserId = userId, SkillId = skillId });
        await _db.SaveChangesAsync();

        await _cache.RemoveAsync(MatchCacheKey(userId));
    }

    public async Task RemoveSkillAsync(int userId, int skillId)
    {
        var row = await _db.UserSkills.FirstOrDefaultAsync(us => us.UserId == userId && us.SkillId == skillId);
        if (row is null)
            throw new KeyNotFoundException("Skill is not in your preferences.");

        _db.UserSkills.Remove(row);
        await _db.SaveChangesAsync();

        await _cache.RemoveAsync(MatchCacheKey(userId));
    }

    public async Task AddLocationAsync(int userId, int locationId)
    {
        var exists = await _db.Locations.AnyAsync(l => l.Id == locationId && l.IsActive);
        if (!exists)
            throw new KeyNotFoundException($"Location {locationId} does not exist.");

        var alreadyAdded = await _db.UserLocations.AnyAsync(ul => ul.UserId == userId && ul.LocationId == locationId);
        if (alreadyAdded)
            throw new InvalidOperationException("Location is already in your preferences.");

        _db.UserLocations.Add(new UserLocation { UserId = userId, LocationId = locationId });
        await _db.SaveChangesAsync();

        await _cache.RemoveAsync(MatchCacheKey(userId));
    }

    public async Task RemoveLocationAsync(int userId, int locationId)
    {
        var row = await _db.UserLocations.FirstOrDefaultAsync(ul => ul.UserId == userId && ul.LocationId == locationId);
        if (row is null)
            throw new KeyNotFoundException("Location is not in your preferences.");

        _db.UserLocations.Remove(row);
        await _db.SaveChangesAsync();

        await _cache.RemoveAsync(MatchCacheKey(userId));
    }

    // -----------------------------------------------------------------
    // Delta helpers — compute (added, removed) and apply only the diff.
    // -----------------------------------------------------------------
    private async Task ApplySkillDeltaAsync(int userId, List<int> desiredSkillIds)
    {
        var current = await _db.UserSkills
            .Where(us => us.UserId == userId)
            .ToListAsync();
        var currentIds = current.Select(us => us.SkillId).ToHashSet();
        var desiredIds = desiredSkillIds.ToHashSet();

        var toAdd = desiredIds.Where(id => !currentIds.Contains(id));
        foreach (var id in toAdd)
            _db.UserSkills.Add(new UserSkill { UserId = userId, SkillId = id });

        var toRemove = current.Where(us => !desiredIds.Contains(us.SkillId));
        _db.UserSkills.RemoveRange(toRemove);
    }

    private async Task ApplyLocationDeltaAsync(int userId, List<int> desiredLocationIds)
    {
        var current = await _db.UserLocations
            .Where(ul => ul.UserId == userId)
            .ToListAsync();
        var currentIds = current.Select(ul => ul.LocationId).ToHashSet();
        var desiredIds = desiredLocationIds.ToHashSet();

        var toAdd = desiredIds.Where(id => !currentIds.Contains(id));
        foreach (var id in toAdd)
            _db.UserLocations.Add(new UserLocation { UserId = userId, LocationId = id });

        var toRemove = current.Where(ul => !desiredIds.Contains(ul.LocationId));
        _db.UserLocations.RemoveRange(toRemove);
    }

    // -----------------------------------------------------------------
    // Validation — reject unknown FK ids up front (clean 404 over FK 500).
    // -----------------------------------------------------------------
    private async Task ValidateExperienceAsync(int? experienceId)
    {
        if (experienceId is null) return;
        var exists = await _db.Experiences.AnyAsync(e => e.Id == experienceId && e.IsActive);
        if (!exists)
            throw new KeyNotFoundException($"Experience {experienceId} does not exist.");
    }

    private async Task ValidateSkillsAsync(List<int> skillIds)
    {
        if (skillIds.Count == 0) return;
        var validCount = await _db.Skills.CountAsync(s => skillIds.Contains(s.Id) && s.IsActive);
        if (validCount != skillIds.Count)
            throw new KeyNotFoundException("One or more skills do not exist.");
    }

    private async Task ValidateLocationsAsync(List<int> locationIds)
    {
        if (locationIds.Count == 0) return;
        var validCount = await _db.Locations.CountAsync(l => locationIds.Contains(l.Id) && l.IsActive);
        if (validCount != locationIds.Count)
            throw new KeyNotFoundException("One or more locations do not exist.");
    }
}
