using JobPing.Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace JobPing.Infrastructure.Workers;

/// <summary>
/// Runs the job-fetch pipeline on a 2-hour cadence. The actual work lives in
/// <see cref="IJobFetchService"/> so the AdminController can trigger the same logic on demand.
/// </summary>
public class FetchJobsWorker : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(2);

    private readonly IServiceProvider _services;
    private readonly ILogger<FetchJobsWorker> _logger;

    public FetchJobsWorker(IServiceProvider services, ILogger<FetchJobsWorker> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("FetchJobsWorker started — interval {Hours}h.", Interval.TotalHours);

        // Run once shortly after startup, then every 2 hours.
        await RunOnceSafelyAsync(stoppingToken);

        using var timer = new PeriodicTimer(Interval);
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await RunOnceSafelyAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            // graceful shutdown
        }

        _logger.LogInformation("FetchJobsWorker stopping.");
    }

    private async Task RunOnceSafelyAsync(CancellationToken ct)
    {
        try
        {
            // Scoped because IJobFetchService depends on the (scoped) DbContext.
            using var scope = _services.CreateScope();
            var fetchService = scope.ServiceProvider.GetRequiredService<IJobFetchService>();
            await fetchService.FetchAndStoreJobsAsync(ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Never let a failed run crash the worker loop.
            _logger.LogError(ex, "FetchJobsWorker: run threw, will retry next tick.");
        }
    }
}
