using System.Text.Json;
using JobPing.Application.Interfaces;
using JobPing.Domain.Entities;
using JobPing.Infrastructure.Data;
using JobPing.Infrastructure.Messaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace JobPing.Infrastructure.Workers;

// Consumes jobs.new (routing key job.fetched). Per job: scores it against every active,
// email-opted-in user; queues an email + notification for anyone above their own threshold
// who hasn't already been alerted about this job (alert_history's UNIQUE(user_id, job_id)
// is the dedup mechanism CLAUDE.md calls out as critical).
public class MatchAndAlertWorker : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<MatchAndAlertWorker> _logger;
    private IConnection? _connection;
    private IModel? _channel;

    public MatchAndAlertWorker(IServiceScopeFactory scopeFactory, IConfiguration config, ILogger<MatchAndAlertWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _config = config;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                Connect();
                var channel = _channel!;

                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.Received += OnMessageReceived;
                channel.BasicConsume(RabbitMqTopology.JobsNewQueue, autoAck: false, consumer);
                _logger.LogInformation("MatchAndAlertWorker: consuming {Queue}.", RabbitMqTopology.JobsNewQueue);

                while (!stoppingToken.IsCancellationRequested && channel.IsOpen)
                    await Task.Delay(1000, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "MatchAndAlertWorker: RabbitMQ unavailable, retrying in 10s.");
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }
    }

    private void Connect()
    {
        if (_channel is { IsOpen: true })
            return;

        var factory = RabbitMqTopology.BuildFactory(_config);
        factory.DispatchConsumersAsync = true;
        _connection = factory.CreateConnection("jobping-match-alert-worker");
        _channel = _connection.CreateModel();
        RabbitMqTopology.DeclareAll(_channel);
        _channel.BasicQos(0, 1, false);
    }

    private async Task OnMessageReceived(object sender, BasicDeliverEventArgs ea)
    {
        try
        {
            var payload = JsonSerializer.Deserialize<JobFetchedMessage>(ea.Body.Span, JsonOpts);
            if (payload is not null)
            {
                using var scope = _scopeFactory.CreateScope();
                await ProcessJobAsync(payload.JobId, scope.ServiceProvider);
            }

            _channel!.BasicAck(ea.DeliveryTag, multiple: false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MatchAndAlertWorker: failed processing message, requeueing.");
            _channel!.BasicNack(ea.DeliveryTag, multiple: false, requeue: true);
        }
    }

    private async Task ProcessJobAsync(int jobId, IServiceProvider services)
    {
        var db = services.GetRequiredService<JobPingDbContext>();
        var matching = services.GetRequiredService<IMatchingService>();
        var publisher = services.GetRequiredService<IMessagePublisher>();

        var job = await db.Jobs.AsNoTracking()
            .Include(j => j.JobSkills).ThenInclude(js => js.Skill)
            .FirstOrDefaultAsync(j => j.Id == jobId);
        if (job is null)
        {
            _logger.LogWarning("MatchAndAlertWorker: job {JobId} not found, skipping.", jobId);
            return;
        }

        var jobSkillIds = job.JobSkills.Select(js => js.SkillId).ToList();

        var candidates = await db.Users.AsNoTracking()
            .Where(u => u.IsActive && u.UserProfile != null && u.UserProfile.IsEmailNotification)
            .Select(u => new
            {
                u.Id,
                u.Email,
                Threshold = u.UserProfile!.MinMatchPercentage,
                SkillIds = u.UserSkills.Select(us => us.SkillId).ToList(),
            })
            .ToListAsync();

        foreach (var user in candidates)
        {
            var score = matching.CalculateMatchScore(user.SkillIds, jobSkillIds);
            if (score < user.Threshold)
                continue;

            var alreadyAlerted = await db.AlertHistories
                .AnyAsync(a => a.UserId == user.Id && a.JobId == jobId);
            if (alreadyAlerted)
                continue;

            var mail = new MailQueue
            {
                UserId = user.Id,
                JobId = jobId,
                Subject = $"New match: {job.Title} at {job.Company} ({score}%)",
                Body = BuildEmailBody(job, score),
                Sender = _config["SendGrid:FromEmail"] ?? "noreply@jobping.dev",
                Receiver = user.Email,
                Status = "Pending",
            };
            db.MailQueues.Add(mail);
            await db.SaveChangesAsync(); // need mail.Id before publishing

            await publisher.PublishEmailSendAsync(new EmailSendMessage
            {
                UserId = user.Id,
                JobId = jobId,
                MailQueueId = mail.Id,
                To = user.Email,
                Subject = mail.Subject,
                Body = mail.Body,
            });

            db.AlertHistories.Add(new AlertHistory { UserId = user.Id, JobId = jobId, Status = "Sent" });
            db.Notifications.Add(new Notification
            {
                UserId = user.Id,
                Title = $"New job match — {score}%",
                Message = $"{job.Title} at {job.Company} matches your profile",
                Type = "job_match",
            });
            await db.SaveChangesAsync();
        }
    }

    private static string BuildEmailBody(Job job, int score)
    {
        var skills = string.Join(", ", job.JobSkills.Select(js => js.Skill.Name));
        return $"""
            <div style="font-family: sans-serif; max-width: 480px;">
              <h2>{job.Title}</h2>
              <p><strong>{job.Company}</strong> · {job.Location ?? (job.IsRemote ? "Remote" : "")} · {score}% match</p>
              {(string.IsNullOrWhiteSpace(skills) ? "" : $"<p><strong>Skills:</strong> {skills}</p>")}
              <p>{(string.IsNullOrWhiteSpace(job.Description) ? "" : Truncate(job.Description, 400))}</p>
              <p><a href="{job.SourceUrl}">View and apply →</a></p>
            </div>
            """;
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max] + "…";
}
