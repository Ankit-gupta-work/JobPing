using JobPing.Domain.Entities;
using JobPing.Infrastructure.ExternalClients;

namespace JobPing.Infrastructure.Services;

/// <summary>
/// Maps each external source's response model onto the <see cref="Job"/> entity.
/// Strings are truncated to the DB column limits so external data can't overflow.
/// </summary>
public class JobMappingService
{
    public Job MapRemotiveJob(RemotiveJob j) => new()
    {
        ExternalId = TruncReq(j.Id.ToString(), 200),
        Source = "Remotive",
        SourceUrl = j.Url,
        Title = TruncReq(EmptyTo(j.Title, "Untitled"), 300),
        Company = TruncReq(EmptyTo(j.CompanyName, "Unknown"), 200),
        Description = j.Description,
        JobType = Trunc(j.JobType, 50),
        Location = Trunc(j.CandidateRequiredLocation, 200),
        IsRemote = true, // Remotive is remote-only
    };

    public Job MapArbeitnowJob(ArbeitnowJob j) => new()
    {
        ExternalId = TruncReq(j.Slug, 200),
        Source = "Arbeitnow",
        SourceUrl = j.Url,
        Title = TruncReq(EmptyTo(j.Title, "Untitled"), 300),
        Company = TruncReq(EmptyTo(j.CompanyName, "Unknown"), 200),
        Description = j.Description,
        JobType = Trunc(j.JobTypes is { Count: > 0 } ? j.JobTypes[0] : null, 50),
        Location = Trunc(j.Location, 200),
        IsRemote = j.Remote,
    };

    public Job MapWWRJob(WWRJob j) => new()
    {
        ExternalId = TruncReq(j.ExternalId, 200),
        Source = "WWR",
        SourceUrl = j.Link,
        Title = TruncReq(EmptyTo(j.Title, "Untitled"), 300),
        Company = TruncReq(EmptyTo(j.Company, "We Work Remotely"), 200),
        Description = j.Description,
        JobType = null,
        Location = "Remote",
        IsRemote = true, // WWR is remote-only
    };

    public Job MapAdzunaJob(AdzunaJob j) => new()
    {
        ExternalId = TruncReq(j.Id, 200),
        Source = "Adzuna",
        SourceUrl = j.RedirectUrl,
        Title = TruncReq(EmptyTo(j.Title, "Untitled"), 300),
        Company = TruncReq(EmptyTo(j.Company.DisplayName, "Unknown"), 200),
        Description = j.Description,
        JobType = Trunc(j.ContractTime switch
        {
            "full_time" => "Full-time",
            "part_time" => "Part-time",
            "contract" => "Contract",
            _ => null,
        }, 50),
        // Adzuna's location.area is broad→specific, e.g. ["India", "Karnataka", "Bangalore"] —
        // the last element is the most specific place name; fall back to display_name if
        // area is too short to have a specific entry.
        Location = Trunc(j.Location.Area.Count >= 3 ? j.Location.Area[^1] : j.Location.DisplayName, 200),
        IsRemote = j.Location.DisplayName.Contains("remote", StringComparison.OrdinalIgnoreCase),
        MinSalary = j.SalaryMin,
        MaxSalary = j.SalaryMax,
    };

    public Job MapJSearchJob(JSearchJob j) => new()
    {
        ExternalId = TruncReq(j.JobId, 200),
        Source = "JSearch",
        SourceUrl = j.JobApplyLink,
        Title = TruncReq(EmptyTo(j.JobTitle, "Untitled"), 300),
        Company = TruncReq(EmptyTo(j.EmployerName, "Unknown"), 200),
        Description = j.JobDescription,
        // search-v2 sends a human-readable string ("Full-time", "Contractor") rather
        // than the uppercase enum ("FULLTIME") the older API docs describe — confirmed
        // live. Matched case-insensitively since exact casing for every variant
        // (e.g. part-time, internship) hasn't been observed directly.
        JobType = Trunc(j.JobEmploymentType?.ToLowerInvariant() switch
        {
            "full-time" or "fulltime" => "Full-time",
            "part-time" or "parttime" => "Part-time",
            "contractor" or "contract" => "Contract",
            "intern" or "internship" => "Internship",
            _ => j.JobEmploymentType,
        }, 50),
        Location = Trunc(EmptyTo(j.JobCity, j.JobCountry ?? "Unknown"), 200),
        IsRemote = j.JobIsRemote,
        MinSalary = j.JobMinSalary,
        MaxSalary = j.JobMaxSalary,
    };

    private static string EmptyTo(string? value, string fallback) =>
        string.IsNullOrWhiteSpace(value) ? fallback : value;

    // Required (non-null) columns.
    private static string TruncReq(string value, int max) =>
        value.Length <= max ? value : value[..max];

    // Optional (nullable) columns.
    private static string? Trunc(string? value, int max)
    {
        if (string.IsNullOrEmpty(value)) return value;
        return value.Length <= max ? value : value[..max];
    }
}
