using System.Xml.Linq;
using Microsoft.Extensions.Logging;

namespace JobPing.Infrastructure.ExternalClients;

// https://weworkremotely.com/remote-jobs.rss
public class WWRJob
{
    public string ExternalId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string? Link { get; set; }
    public string? Description { get; set; }
}

public class WWRRssClient
{
    private readonly HttpClient _http;
    private readonly ILogger<WWRRssClient> _logger;

    public WWRRssClient(HttpClient http, ILogger<WWRRssClient> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<List<WWRJob>> FetchJobsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var xml = await _http.GetStringAsync("remote-jobs.rss", cancellationToken);
            var doc = XDocument.Parse(xml);

            var jobs = new List<WWRJob>();
            foreach (var item in doc.Descendants("item"))
            {
                var rawTitle = (string?)item.Element("title") ?? string.Empty;
                var link = (string?)item.Element("link");
                var guid = (string?)item.Element("guid");
                var description = (string?)item.Element("description");

                // WWR item titles are usually "Company Name: Job Title".
                string company = "We Work Remotely";
                string title = rawTitle.Trim();
                var sep = rawTitle.IndexOf(": ", StringComparison.Ordinal);
                if (sep > 0)
                {
                    company = rawTitle[..sep].Trim();
                    title = rawTitle[(sep + 2)..].Trim();
                }

                // External id: prefer guid, fall back to link.
                var externalId = guid ?? link;
                if (string.IsNullOrWhiteSpace(externalId) || string.IsNullOrWhiteSpace(title))
                    continue;

                jobs.Add(new WWRJob
                {
                    ExternalId = externalId,
                    Title = title,
                    Company = company,
                    Link = link,
                    Description = description,
                });
            }

            return jobs;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "WeWorkRemotely RSS fetch/parse failed");
            return new List<WWRJob>();
        }
    }
}
