using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace JobPing.Infrastructure.ExternalClients;

// https://developer.adzuna.com/ — India job board, free app_id/app_key.
public class AdzunaResponse
{
    [JsonPropertyName("results")]
    public List<AdzunaJob> Results { get; set; } = new();
}

public class AdzunaJob
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
    [JsonPropertyName("title")] public string Title { get; set; } = string.Empty;
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("redirect_url")] public string? RedirectUrl { get; set; }
    [JsonPropertyName("company")] public AdzunaCompany Company { get; set; } = new();
    [JsonPropertyName("location")] public AdzunaLocation Location { get; set; } = new();
    [JsonPropertyName("salary_min")] public decimal? SalaryMin { get; set; }
    [JsonPropertyName("salary_max")] public decimal? SalaryMax { get; set; }
    [JsonPropertyName("contract_time")] public string? ContractTime { get; set; }
}

public class AdzunaCompany
{
    [JsonPropertyName("display_name")] public string DisplayName { get; set; } = string.Empty;
}

public class AdzunaLocation
{
    [JsonPropertyName("display_name")] public string DisplayName { get; set; } = string.Empty;
    [JsonPropertyName("area")] public List<string> Area { get; set; } = new();
}

public class AdzunaClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<AdzunaClient> _logger;

    // India-focused queries — this is the whole point of adding Adzuna over the
    // 3 existing remote-only sources. Kept short; broaden later if the match
    // rate against real users justifies more API calls.
    private static readonly string[] Queries =
    {
        "angular developer",
        ".net developer",
        "full stack developer",
        "software engineer",
        "backend developer",
    };

    public AdzunaClient(HttpClient http, IConfiguration config, ILogger<AdzunaClient> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    public async Task<List<AdzunaJob>> FetchJobsAsync(
        string what, int page = 1, int resultsPerPage = 50, CancellationToken cancellationToken = default)
    {
        try
        {
            var appId = _config["Adzuna:AppId"];
            var appKey = _config["Adzuna:AppKey"];
            if (string.IsNullOrWhiteSpace(appId) || string.IsNullOrWhiteSpace(appKey))
            {
                _logger.LogWarning("Adzuna: AppId/AppKey not configured — skipping.");
                return new List<AdzunaJob>();
            }

            var url = $"v1/api/jobs/in/search/{page}" +
                       "?category=it-jobs&sort_by=date" +
                      $"&app_id={Uri.EscapeDataString(appId)}" +
                      $"&app_key={Uri.EscapeDataString(appKey)}" +
                      $"&results_per_page={resultsPerPage}" +
                      $"&what={Uri.EscapeDataString(what)}";

            // Adzuna sends "charset=utf8" (no hyphen) on its Content-Type header, which
            // GetFromJsonAsync rejects outright (it validates the declared charset name
            // strictly and "utf8" isn't a recognized .NET encoding name). Deserializing
            // from the raw stream instead skips that charset-sniffing entirely — JSON is
            // UTF-8 per RFC 8259 regardless of what a server's header claims.
            using var httpResponse = await _http.GetAsync(url, cancellationToken);
            httpResponse.EnsureSuccessStatusCode();
            await using var stream = await httpResponse.Content.ReadAsStreamAsync(cancellationToken);
            var response = await JsonSerializer.DeserializeAsync<AdzunaResponse>(stream, cancellationToken: cancellationToken);
            return response?.Results ?? new List<AdzunaJob>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Adzuna fetch failed for query '{What}'", what);
            return new List<AdzunaJob>();
        }
    }

    // Runs every query above (2 pages each) and dedups within this batch by
    // job id — cross-run dedup against already-stored jobs still happens in
    // JobFetchService via (ExternalId, Source), same as every other source.
    public async Task<List<AdzunaJob>> FetchAllIndianTechJobsAsync(CancellationToken cancellationToken = default)
    {
        var all = new List<AdzunaJob>();

        foreach (var query in Queries)
        {
            for (var page = 1; page <= 2; page++)
            {
                var jobs = await FetchJobsAsync(query, page, cancellationToken: cancellationToken);
                all.AddRange(jobs);
                await Task.Delay(300, cancellationToken);
            }
        }

        return all.GroupBy(j => j.Id).Select(g => g.First()).ToList();
    }
}
