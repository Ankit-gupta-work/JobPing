using JobPing.Application.Interfaces;
using JobPing.Domain.Entities;
using JobPing.Infrastructure.Data;
using JobPing.Infrastructure.ExternalClients;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace JobPing.Infrastructure.Services;

public class JobFetchService : IJobFetchService
{
    private const string LockKey = "lock:fetch-jobs";
    private const string TaskName = "FetchJobsTask";
    private static readonly TimeSpan LockTtl = TimeSpan.FromMinutes(90);

    private readonly JobPingDbContext _db;
    private readonly ICacheService _cache;
    private readonly IMessagePublisher _publisher;
    private readonly JobMappingService _mapper;
    private readonly RemotiveClient _remotive;
    private readonly ArbeitnowClient _arbeitnow;
    private readonly WWRRssClient _wwr;
    private readonly ILogger<JobFetchService> _logger;

    public JobFetchService(
        JobPingDbContext db,
        ICacheService cache,
        IMessagePublisher publisher,
        JobMappingService mapper,
        RemotiveClient remotive,
        ArbeitnowClient arbeitnow,
        WWRRssClient wwr,
        ILogger<JobFetchService> logger)
    {
        _db = db;
        _cache = cache;
        _publisher = publisher;
        _mapper = mapper;
        _remotive = remotive;
        _arbeitnow = arbeitnow;
        _wwr = wwr;
        _logger = logger;
    }

    public async Task<int> FetchAndStoreJobsAsync(CancellationToken cancellationToken = default)
    {
        // (a)/(b) Distributed lock — only one fetch may run at a time.
        var lockToken = Guid.NewGuid().ToString("N");
        var acquired = await _cache.AcquireLockAsync(LockKey, lockToken, LockTtl);
        if (!acquired)
        {
            _logger.LogInformation("FetchJobs: lock held by another run — already running, skipping.");
            return 0;
        }

        _logger.LogInformation("FetchJobs: starting run (lock acquired).");

        // (c) Mark background task as Running.
        var task = await GetOrCreateTaskAsync(cancellationToken);
        task.LastStatus = "Running";
        task.LastRunAt = DateTime.UtcNow;
        task.LastErrorMsg = null;
        await _db.SaveChangesAsync(cancellationToken);

        try
        {
            // Load skills once for the whole run (in-memory match table).
            var skills = await _db.Skills.Where(s => s.IsActive).AsNoTracking().ToListAsync(cancellationToken);

            var totalNew = 0;

            // (d) Remotive
            var remotive = await _remotive.FetchJobsAsync(cancellationToken: cancellationToken);
            totalNew += await SaveNewJobsAsync(
                "Remotive", remotive.Select(_mapper.MapRemotiveJob).ToList(), skills, cancellationToken);

            // (e) Arbeitnow
            var arbeitnow = await _arbeitnow.FetchJobsAsync(cancellationToken);
            totalNew += await SaveNewJobsAsync(
                "Arbeitnow", arbeitnow.Select(_mapper.MapArbeitnowJob).ToList(), skills, cancellationToken);

            // (f) WeWorkRemotely
            var wwr = await _wwr.FetchJobsAsync(cancellationToken);
            totalNew += await SaveNewJobsAsync(
                "WWR", wwr.Select(_mapper.MapWWRJob).ToList(), skills, cancellationToken);

            // (h) Invalidate cached job lists.
            await _cache.RemoveByPatternAsync("jobs:list:*");

            // (j) Mark success.
            task.LastStatus = "Success";
            task.NextRunAt = DateTime.UtcNow.AddHours(2);
            await _db.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("FetchJobs: completed. {Count} new jobs inserted.", totalNew);
            return totalNew;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FetchJobs: run failed.");
            await TryMarkFailedAsync(task, ex.Message);
            throw;
        }
        finally
        {
            // (i) Always release the lock.
            await _cache.ReleaseLockAsync(LockKey, lockToken);
        }
    }

    private async Task<int> SaveNewJobsAsync(
        string source, List<Job> mappedJobs, IReadOnlyList<Skill> skills, CancellationToken ct)
    {
        var newCount = 0;

        foreach (var job in mappedJobs)
        {
            // (5) Deduplication — skip if (external_id, source) already exists.
            var exists = await _db.Jobs
                .AnyAsync(j => j.ExternalId == job.ExternalId && j.Source == job.Source, ct);
            if (exists)
                continue;

            // Insert job first to obtain its Id (needed for job_skills + publish).
            _db.Jobs.Add(job);
            await _db.SaveChangesAsync(ct);

            // Extract + persist skills.
            var skillIds = SkillMatcher.ExtractSkillIds(job.Title, job.Description, skills);
            if (skillIds.Count > 0)
            {
                foreach (var skillId in skillIds)
                    _db.JobSkills.Add(new JobSkill { JobId = job.Id, SkillId = skillId });
                await _db.SaveChangesAsync(ct);
            }

            // (g) Publish job.fetched (logged until RabbitMQ exists in Step 7).
            await _publisher.PublishJobFetchedAsync(job.Id, job.Source);

            newCount++;
        }

        _logger.LogInformation(
            "FetchJobs[{Source}]: fetched {Fetched}, inserted {New} new.",
            source, mappedJobs.Count, newCount);

        return newCount;
    }

    private async Task<BackgroundTask> GetOrCreateTaskAsync(CancellationToken ct)
    {
        var task = await _db.BackgroundTasks.FirstOrDefaultAsync(t => t.TaskName == TaskName, ct);
        if (task is null)
        {
            task = new BackgroundTask { TaskName = TaskName, CronExpression = "0 */2 * * *", IsActive = true };
            _db.BackgroundTasks.Add(task);
        }
        return task;
    }

    private async Task TryMarkFailedAsync(BackgroundTask task, string message)
    {
        try
        {
            task.LastStatus = "Failed";
            task.LastErrorMsg = message.Length > 2000 ? message[..2000] : message;
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FetchJobs: could not record Failed status.");
        }
    }
}
