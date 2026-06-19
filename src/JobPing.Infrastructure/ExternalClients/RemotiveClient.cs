using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace JobPing.Infrastructure.ExternalClients;

// https://remotive.com/api/remote-jobs?category=software-dev&limit=100
public class RemotiveResponse
{
    [JsonPropertyName("jobs")]
    public List<RemotiveJob> Jobs { get; set; } = new();
}

public class RemotiveJob
{
    [JsonPropertyName("id")] public long Id { get; set; }
    [JsonPropertyName("url")] public string? Url { get; set; }
    [JsonPropertyName("title")] public string Title { get; set; } = string.Empty;
    [JsonPropertyName("company_name")] public string CompanyName { get; set; } = string.Empty;
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("job_type")] public string? JobType { get; set; }
    [JsonPropertyName("candidate_required_location")] public string? CandidateRequiredLocation { get; set; }
}

public class RemotiveClient
{
    private readonly HttpClient _http;
    private readonly ILogger<RemotiveClient> _logger;

    public RemotiveClient(HttpClient http, ILogger<RemotiveClient> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<List<RemotiveJob>> FetchJobsAsync(
        string category = "software-dev", int limit = 100, CancellationToken cancellationToken = default)
    {
        try
        {
            var url = $"api/remote-jobs?category={category}&limit={limit}";
            var response = await _http.GetFromJsonAsync<RemotiveResponse>(url, cancellationToken);
            return response?.Jobs ?? new List<RemotiveJob>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Remotive fetch failed");
            return new List<RemotiveJob>();
        }
    }
}
