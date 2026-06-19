using JobPing.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace JobPing.Infrastructure.Services;

/// <summary>
/// Placeholder publisher used until RabbitMQ is wired up in Step 7.
/// Logs the message that *would* be published instead of failing the pipeline.
/// </summary>
public class LoggingMessagePublisher : IMessagePublisher
{
    private readonly ILogger<LoggingMessagePublisher> _logger;

    public LoggingMessagePublisher(ILogger<LoggingMessagePublisher> logger)
    {
        _logger = logger;
    }

    public Task PublishJobFetchedAsync(int jobId, string source)
    {
        _logger.LogInformation(
            "[RabbitMQ stub] would publish job.fetched → exchange=jobs.exchange routingKey=job.fetched payload={{ jobId={JobId}, source={Source} }}",
            jobId, source);
        return Task.CompletedTask;
    }

    public Task PublishEmailSendAsync(EmailSendMessage message)
    {
        _logger.LogInformation(
            "[RabbitMQ stub] would publish email.send → mailQueueId={MailQueueId} to={To}",
            message.MailQueueId, message.To);
        return Task.CompletedTask;
    }

    public Task PublishNotificationAsync(NotificationMessage message)
    {
        _logger.LogInformation(
            "[RabbitMQ stub] would publish notification → userId={UserId} type={Type}",
            message.UserId, message.Type);
        return Task.CompletedTask;
    }
}
