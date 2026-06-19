using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace JobPing.Infrastructure.ExternalClients;

// https://arbeitnow.com/api/job-board-api
public class ArbeitnowResponse
{
    [JsonPropertyName("data")]
    public List<ArbeitnowJob> Data { get; set; } = new();
}

public class ArbeitnowJob
{
    [JsonPropertyName("slug")] public string Slug { get; set; } = string.Empty;
    [JsonPropertyName("title")] public string Title { get; set; } = string.Empty;
    [JsonPropertyName("company_name")] public string CompanyName { get; set; } = string.Empty;
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("url")] public string? Url { get; set; }
    [JsonPropertyName("remote")] public bool Remote { get; set; }
    [JsonPropertyName("location")] public string? Location { get; set; }
    [JsonPropertyName("tags")] public List<string>? Tags { get; set; }
    [JsonPropertyName("job_types")] public List<string>? JobTypes { get; set; }
}

public class ArbeitnowClient
{
    private readonly HttpClient _http;
    private readonly ILogger<ArbeitnowClient> _logger;

    public ArbeitnowClient(HttpClient http, ILogger<ArbeitnowClient> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<List<ArbeitnowJob>> FetchJobsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _http.GetFromJsonAsync<ArbeitnowResponse>("api/job-board-api", cancellationToken);
            return response?.Data ?? new List<ArbeitnowJob>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Arbeitnow fetch failed");
            return new List<ArbeitnowJob>();
        }
    }
}
