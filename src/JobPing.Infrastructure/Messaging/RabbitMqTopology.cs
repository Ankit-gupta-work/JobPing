using Microsoft.Extensions.Configuration;
using RabbitMQ.Client;

namespace JobPing.Infrastructure.Messaging;

// Exchange/queue names and the topology declaration, per CLAUDE.md §11 (the corrected
// version — see DECISIONS.md 2026-09-23 for why the original nack-with-requeue=false
// design was replaced with this TTL+DLX retry ladder). Shared by the publisher and every
// consumer worker so nobody hand-rolls the topology twice.
public static class RabbitMqTopology
{
    public const string JobsExchange = "jobs.exchange";
    public const string JobsNewQueue = "jobs.new";
    public const string JobFetchedRoutingKey = "job.fetched";

    public const string EmailExchange = "email.exchange";
    public const string EmailSendQueue = "email.send";
    public const string EmailRetry5sQueue = "email.retry.5s";
    public const string EmailRetry30sQueue = "email.retry.30s";
    public const string EmailDeadQueue = "email.dead";
    public const string EmailSendRoutingKey = "email.send";
    public const string EmailRetry5sRoutingKey = "email.retry.5s";
    public const string EmailRetry30sRoutingKey = "email.retry.30s";
    public const string EmailFailedRoutingKey = "email.failed";

    public const string NotificationExchange = "notification.exchange";
    public const string NotificationCreateQueue = "notification.create";

    public static ConnectionFactory BuildFactory(IConfiguration config)
    {
        // Production: use a single AMQP URL (CloudAMQP on Railway)
        var url = config["RabbitMQ__Url"] ?? config["RabbitMQ:Url"];
        if (!string.IsNullOrWhiteSpace(url))
        {
            return new ConnectionFactory
            {
                Uri = new Uri(url),
                AutomaticRecoveryEnabled = true,
            };
        }

        // Local development: use separate host/user/pass from appsettings.json
        return new ConnectionFactory
        {
            HostName = config["RabbitMQ:Host"] ?? "localhost",
            Port = int.TryParse(config["RabbitMQ:Port"], out var port) ? port : 5672,
            UserName = config["RabbitMQ:Username"] ?? "guest",
            Password = config["RabbitMQ:Password"] ?? "guest",
            VirtualHost = config["RabbitMQ:VirtualHost"] ?? "/",
            AutomaticRecoveryEnabled = true,
        };
    }

    public static void DeclareAll(IModel channel)
    {
        channel.ExchangeDeclare(JobsExchange, ExchangeType.Direct, durable: true);
        channel.QueueDeclare(JobsNewQueue, durable: true, exclusive: false, autoDelete: false);
        channel.QueueBind(JobsNewQueue, JobsExchange, JobFetchedRoutingKey);

        channel.ExchangeDeclare(EmailExchange, ExchangeType.Direct, durable: true);

        // Working queue — NO message TTL. A message must not vanish just because MailWorker
        // is briefly down; retries are explicit republishes into the ladder below, never
        // queue-level expiry.
        channel.QueueDeclare(EmailSendQueue, durable: true, exclusive: false, autoDelete: false);
        channel.QueueBind(EmailSendQueue, EmailExchange, EmailSendRoutingKey);

        // Retry ladder — no consumer on either queue. A message just sits until its TTL
        // expires, then RabbitMQ auto-dead-letters it back into email.exchange/email.send,
        // landing it back on the working queue for the next delivery attempt.
        channel.QueueDeclare(EmailRetry5sQueue, durable: true, exclusive: false, autoDelete: false,
            arguments: new Dictionary<string, object>
            {
                ["x-dead-letter-exchange"] = EmailExchange,
                ["x-dead-letter-routing-key"] = EmailSendRoutingKey,
                ["x-message-ttl"] = 5000,
            });
        channel.QueueBind(EmailRetry5sQueue, EmailExchange, EmailRetry5sRoutingKey);

        channel.QueueDeclare(EmailRetry30sQueue, durable: true, exclusive: false, autoDelete: false,
            arguments: new Dictionary<string, object>
            {
                ["x-dead-letter-exchange"] = EmailExchange,
                ["x-dead-letter-routing-key"] = EmailSendRoutingKey,
                ["x-message-ttl"] = 30000,
            });
        channel.QueueBind(EmailRetry30sQueue, EmailExchange, EmailRetry30sRoutingKey);

        // Terminal sink for logging only — nothing dead-letters into it automatically, and
        // nothing consumes it for retry.
        channel.QueueDeclare(EmailDeadQueue, durable: true, exclusive: false, autoDelete: false);
        channel.QueueBind(EmailDeadQueue, EmailExchange, EmailFailedRoutingKey);

        channel.ExchangeDeclare(NotificationExchange, ExchangeType.Fanout, durable: true);
        channel.QueueDeclare(NotificationCreateQueue, durable: true, exclusive: false, autoDelete: false);
        channel.QueueBind(NotificationCreateQueue, NotificationExchange, routingKey: string.Empty);
    }
}
