using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace JobPing.Infrastructure.ExternalClients;

// https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch — aggregates
// LinkedIn/Indeed/Glassdoor. Free RapidAPI tier: 500 calls/month, so
// JSearchClient is deliberately gated to run at most once per 24h —
// see JobFetchService's "gate:jsearch-daily" check, not here — this
// client itself just fetches when asked.
//
// The "search-v2" endpoint (confirmed live — "search" 404s) nests the job
// array one level deeper than the older "search" docs describe: "data" is
// an object with a "jobs" array and a pagination "cursor", not the array
// itself.
public class JSearchResponse
{
    [JsonPropertyName("data")]
    public JSearchData? Data { get; set; }
}

public class JSearchData
{
    [JsonPropertyName("jobs")]
    public List<JSearchJob> Jobs { get; set; } = new();
}

public class JSearchJob
{
    [JsonPropertyName("job_id")] public string JobId { get; set; } = string.Empty;
    [JsonPropertyName("job_title")] public string JobTitle { get; set; } = string.Empty;
    [JsonPropertyName("employer_name")] public string? EmployerName { get; set; }
    [JsonPropertyName("job_description")] public string? JobDescription { get; set; }
    [JsonPropertyName("job_apply_link")] public string? JobApplyLink { get; set; }
    [JsonPropertyName("job_city")] public string? JobCity { get; set; }
    [JsonPropertyName("job_country")] public string? JobCountry { get; set; }
    [JsonPropertyName("job_is_remote")] public bool JobIsRemote { get; set; }
    [JsonPropertyName("job_employment_type")] public string? JobEmploymentType { get; set; }
    [JsonPropertyName("job_min_salary")] public decimal? JobMinSalary { get; set; }
    [JsonPropertyName("job_max_salary")] public decimal? JobMaxSalary { get; set; }
}

public class JSearchClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<JSearchClient> _logger;

    private static readonly string[] Queries =
    {
        "Angular developer Pune India",
        ".NET developer Hyderabad India",
        "full stack developer Bangalore India",
        "software engineer Mumbai India",
        "backend developer remote India",
    };

    public JSearchClient(HttpClient http, IConfiguration config, ILogger<JSearchClient> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
    }

    public async Task<List<JSearchJob>> FetchJobsAsync(string query, CancellationToken cancellationToken = default)
    {
        try
        {
            var apiKey = _config["JSearch:ApiKey"];
            var host = _config["JSearch:Host"] ?? "jsearch.p.rapidapi.com";
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogWarning("JSearch: ApiKey not configured — skipping.");
                return new List<JSearchJob>();
            }

            // "search" (no suffix) 404s — confirmed live against the real API that the
            // current endpoint is "search-v2".
            var url = $"search-v2?query={Uri.EscapeDataString(query)}&page=1&num_pages=1&date_posted=today";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("X-RapidAPI-Key", apiKey);
            request.Headers.Add("X-RapidAPI-Host", host);

            using var httpResponse = await _http.SendAsync(request, cancellationToken);
            httpResponse.EnsureSuccessStatusCode();

            // Deserializing from the raw stream (not ReadFromJsonAsync) deliberately skips
            // .NET's strict Content-Type charset validation — Adzuna's API was found to send
            // a non-standard "charset=utf8" that GetFromJsonAsync/ReadFromJsonAsync reject
            // outright, and there's no guarantee RapidAPI's proxy won't do the same.
            await using var stream = await httpResponse.Content.ReadAsStreamAsync(cancellationToken);
            var response = await JsonSerializer.DeserializeAsync<JSearchResponse>(stream, cancellationToken: cancellationToken);
            return response?.Data?.Jobs ?? new List<JSearchJob>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "JSearch fetch failed for query '{Query}'", query);
            return new List<JSearchJob>();
        }
    }

    // 5 queries here, called at most once per 24h by JobFetchService's gate
    // = 5 calls/day = ~150/month, comfortably under the 500/month free tier
    // (with headroom for retried worker runs, unlike the naive "every 2h"
    // version, which works out to 1,800/month and blows the quota by 3.6x).
    public async Task<List<JSearchJob>> FetchAllIndianTechJobsAsync(CancellationToken cancellationToken = default)
    {
        var all = new List<JSearchJob>();

        foreach (var query in Queries)
        {
            var jobs = await FetchJobsAsync(query, cancellationToken);
            all.AddRange(jobs);
            await Task.Delay(500, cancellationToken);
        }

        return all.GroupBy(j => j.JobId).Select(g => g.First()).ToList();
    }
}
