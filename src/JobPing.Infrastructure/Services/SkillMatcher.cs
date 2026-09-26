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
            if (ContainsWholeWord(haystack, skill.Name.ToLowerInvariant()))
                matched.Add(skill.Id);
        }
        return matched;
    }

    // Plain .Contains matched "Java" inside "JavaScript". A skill only counts if it isn't
    // embedded inside a longer alphanumeric run — punctuation neighbors (".NET Core", "Node.js")
    // are still allowed, so word boundaries are alnum-vs-non-alnum, not regex \b.
    private static bool ContainsWholeWord(string haystack, string needle)
    {
        var index = 0;
        while ((index = haystack.IndexOf(needle, index, StringComparison.Ordinal)) != -1)
        {
            var before = index - 1;
            var after = index + needle.Length;

            var boundaryBefore = before < 0 || !char.IsLetterOrDigit(haystack[before]);
            var boundaryAfter = after >= haystack.Length || !char.IsLetterOrDigit(haystack[after]);

            if (boundaryBefore && boundaryAfter) return true;

            index++;
        }
        return false;
    }
}
