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

// Consumes email.dead — reached only after MailWorker gives up on the final attempt.
// Logging/observability only; MailWorker has already marked mail_queue Failed by this
// point, so the DB write here is an idempotent safety net, not the primary path.
public class DeadLetterHandler : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<DeadLetterHandler> _logger;
    private IConnection? _connection;
    private IModel? _channel;

    public DeadLetterHandler(IServiceScopeFactory scopeFactory, IConfiguration config, ILogger<DeadLetterHandler> logger)
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
                channel.BasicConsume(RabbitMqTopology.EmailDeadQueue, autoAck: false, consumer);
                _logger.LogInformation("DeadLetterHandler: consuming {Queue}.", RabbitMqTopology.EmailDeadQueue);

                while (!stoppingToken.IsCancellationRequested && channel.IsOpen)
                    await Task.Delay(1000, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "DeadLetterHandler: RabbitMQ unavailable, retrying in 10s.");
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
        _connection = factory.CreateConnection("jobping-dead-letter-handler");
        _channel = _connection.CreateModel();
        RabbitMqTopology.DeclareAll(_channel);
        _channel.BasicQos(0, 1, false);
    }

    private async Task OnMessageReceived(object sender, BasicDeliverEventArgs ea)
    {
        try
        {
            var message = JsonSerializer.Deserialize<EmailSendMessage>(ea.Body.Span, JsonOpts);
            if (message is not null)
            {
                _logger.LogError(
                    "Email permanently failed: mailQueueId={MailQueueId} userId={UserId} to={To}",
                    message.MailQueueId, message.UserId, message.To);

                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<JobPingDbContext>();
                var mail = await db.MailQueues.FirstOrDefaultAsync(m => m.Id == message.MailQueueId);
                if (mail is not null && mail.Status != "Failed")
                {
                    mail.Status = "Failed";
                    mail.ErrorMsg ??= "Delivery failed after 3 attempts.";
                    await db.SaveChangesAsync();
                }
            }

            _channel!.BasicAck(ea.DeliveryTag, multiple: false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DeadLetterHandler: failed processing message, acking anyway (terminal sink).");
            _channel!.BasicAck(ea.DeliveryTag, multiple: false);
        }
    }
}
