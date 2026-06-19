using JobPing.Domain.Entities;

namespace JobPing.Infrastructure.Services;

/// <summary>
/// Extracts skill IDs from a job's title/description by case-insensitive substring match
/// against the known skills list (loaded from the DB once per fetch run).
/// </summary>
public static class SkillMatcher
{
    public static List<int> ExtractSkillIds(string title, string? description, IReadOnlyList<Skill> skills)
    {
        // One lowercased haystack of title + description.
        var haystack = (title + " " + (description ?? string.Empty)).ToLowerInvariant();
        if (haystack.Length == 0) return new List<int>();

        var matched = new List<int>();
        foreach (var skill in skills)
        {
            if (string.IsNullOrWhiteSpace(skill.Name)) continue;
            if (haystack.Contains(skill.Name.ToLowerInvariant(), StringComparison.Ordinal))
                matched.Add(skill.Id);
        }
        return matched;
    }
}
