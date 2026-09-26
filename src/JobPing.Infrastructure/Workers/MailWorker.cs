using System.Text.Json;
using JobPing.Application.Interfaces;
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

// Consumes email.send. Attempt count lives in mail_queue.no_of_attempts (Postgres), not in
// the RabbitMQ message — the message is disposable and gets republished fresh into the
// retry ladder on every failure. The original message on email.send is ALWAYS acked, success
// or failure: by the time this handler returns, the mail_queue row has either been marked
// Sent, republished into a retry queue, or marked permanently Failed. Never nacked — a nack
// here with no dead-letter-on-this-queue config would just drop the message. See CLAUDE.md
// §10/§11 (corrected 2026-09-23) for why this design replaced the original spec's broken one.
public class MailWorker : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<MailWorker> _logger;
    private IConnection? _connection;
    private IModel? _channel;

    public MailWorker(IServiceScopeFactory scopeFactory, IConfiguration config, ILogger<MailWorker> logger)
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
                channel.BasicConsume(RabbitMqTopology.EmailSendQueue, autoAck: false, consumer);
                _logger.LogInformation("MailWorker: consuming {Queue}.", RabbitMqTopology.EmailSendQueue);

                while (!stoppingToken.IsCancellationRequested && channel.IsOpen)
                    await Task.Delay(1000, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "MailWorker: RabbitMQ unavailable, retrying in 10s.");
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
        _connection = factory.CreateConnection("jobping-mail-worker");
        _channel = _connection.CreateModel();
        RabbitMqTopology.DeclareAll(_channel);
        _channel.BasicQos(0, 1, false);
    }

    private async Task OnMessageReceived(object sender, BasicDeliverEventArgs ea)
    {
        EmailSendMessage? message;
        try
        {
            message = JsonSerializer.Deserialize<EmailSendMessage>(ea.Body.Span, JsonOpts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailWorker: malformed message payload, dropping.");
            _channel!.BasicAck(ea.DeliveryTag, multiple: false);
            return;
        }

        if (message is null)
        {
            _channel!.BasicAck(ea.DeliveryTag, multiple: false);
            return;
        }

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<JobPingDbContext>();
            var email = scope.ServiceProvider.GetRequiredService<IEmailService>();

            var mail = await db.MailQueues.FirstOrDefaultAsync(m => m.Id == message.MailQueueId);
            if (mail is null)
            {
                _logger.LogWarning("MailWorker: mail_queue {Id} not found, dropping.", message.MailQueueId);
                _channel!.BasicAck(ea.DeliveryTag, multiple: false);
                return;
            }

            mail.Status = "Processing";
            await db.SaveChangesAsync();

            try
            {
                await email.SendAsync(message.To, message.Subject, message.Body);

                mail.Status = "Sent";
                mail.SentAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                mail.NoOfAttempts++;

                if (mail.NoOfAttempts == 1)
                {
                    mail.NextRetryAt = DateTime.UtcNow.AddSeconds(5);
                    await db.SaveChangesAsync();
                    PublishToRetryQueue(message, RabbitMqTopology.EmailRetry5sRoutingKey);
                    _logger.LogWarning(ex, "MailWorker: send failed for mailQueueId={Id}, retrying in 5s.", mail.Id);
                }
                else if (mail.NoOfAttempts == 2)
                {
                    mail.NextRetryAt = DateTime.UtcNow.AddSeconds(30);
                    await db.SaveChangesAsync();
                    PublishToRetryQueue(message, RabbitMqTopology.EmailRetry30sRoutingKey);
                    _logger.LogWarning(ex, "MailWorker: send failed for mailQueueId={Id}, retrying in 30s.", mail.Id);
                }
                else
                {
                    mail.Status = "Failed";
                    mail.ErrorMsg = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
                    await db.SaveChangesAsync();
                    PublishToRetryQueue(message, RabbitMqTopology.EmailFailedRoutingKey);
                    _logger.LogError(ex, "MailWorker: send permanently failed for mailQueueId={Id} after {Attempts} attempts.", mail.Id, mail.NoOfAttempts);
                }
            }

            // Always ack the original — it's been re-published to a retry queue, marked
            // permanently failed, or sent. Never handled twice.
            _channel!.BasicAck(ea.DeliveryTag, multiple: false);
        }
        catch (Exception ex)
        {
            // Anything out here (DI resolution, the DB lookup, etc.) is a bug or infra
            // fault, not a legitimate send failure — the retry ladder above is only for
            // SendGrid itself failing. Drop this delivery rather than spin-loop retrying
            // an error that will keep failing identically; the mail_queue row survives
            // untouched for manual recovery once the underlying issue is fixed.
            _logger.LogError(ex, "MailWorker: unexpected failure processing mailQueueId={Id}, dropping delivery.", message.MailQueueId);
            _channel!.BasicNack(ea.DeliveryTag, multiple: false, requeue: false);
        }
    }

    // MailWorker owns the retry ladder directly — it's transport-level retry mechanics
    // specific to this worker, not a general "publish this business event" the rest of the
    // app cares about, so it doesn't go through IMessagePublisher.
    private void PublishToRetryQueue(EmailSendMessage message, string routingKey)
    {
        try
        {
            var body = JsonSerializer.SerializeToUtf8Bytes(message, JsonOpts);
            var props = _channel!.CreateBasicProperties();
            props.Persistent = true;
            props.ContentType = "application/json";
            _channel.BasicPublish(RabbitMqTopology.EmailExchange, routingKey, props, body);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MailWorker: failed to republish mailQueueId={Id} to {RoutingKey}.", message.MailQueueId, routingKey);
        }
    }
}
