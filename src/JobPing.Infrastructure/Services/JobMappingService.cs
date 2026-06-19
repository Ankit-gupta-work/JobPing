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
