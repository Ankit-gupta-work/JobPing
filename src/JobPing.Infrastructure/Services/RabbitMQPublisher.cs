using System.Text.Json;
using JobPing.Application.Interfaces;
using JobPing.Infrastructure.Messaging;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;

namespace JobPing.Infrastructure.Services;

// Fails soft: if RabbitMQ is unreachable, a publish is logged and dropped rather than
// throwing — matches the project's existing availability-over-strict-guarantee stance
// (see JwtBlacklistMiddleware, which fails open on Redis for the same reason). A dropped
// job.fetched means that one job doesn't get matched until something else touches it; it
// does not take the whole API down just because RabbitMQ isn't running yet.
public class RabbitMQPublisher : IMessagePublisher, IDisposable
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly IConfiguration _config;
    private readonly ILogger<RabbitMQPublisher> _logger;
    private readonly object _lock = new();
    private IConnection? _connection;
    private IModel? _channel;

    public RabbitMQPublisher(IConfiguration config, ILogger<RabbitMQPublisher> logger)
    {
        _config = config;
        _logger = logger;
    }

    public Task PublishJobFetchedAsync(int jobId, string source)
    {
        Publish(RabbitMqTopology.JobsExchange, RabbitMqTopology.JobFetchedRoutingKey,
            new { jobId, fetchedAt = DateTime.UtcNow, source });
        return Task.CompletedTask;
    }

    public Task PublishEmailSendAsync(EmailSendMessage message)
    {
        Publish(RabbitMqTopology.EmailExchange, RabbitMqTopology.EmailSendRoutingKey, message);
        return Task.CompletedTask;
    }

    public Task PublishNotificationAsync(NotificationMessage message)
    {
        Publish(RabbitMqTopology.NotificationExchange, routingKey: string.Empty, message);
        return Task.CompletedTask;
    }

    private void Publish(string exchange, string routingKey, object payload)
    {
        var channel = GetChannel();
        if (channel is null)
        {
            _logger.LogWarning("RabbitMQ unavailable — dropped message to {Exchange}/{RoutingKey}.", exchange, routingKey);
            return;
        }

        try
        {
            lock (_lock)
            {
                var body = JsonSerializer.SerializeToUtf8Bytes(payload, JsonOpts);
                var props = channel.CreateBasicProperties();
                props.Persistent = true;
                props.ContentType = "application/json";
                channel.BasicPublish(exchange, routingKey, props, body);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish to {Exchange}/{RoutingKey}.", exchange, routingKey);
        }
    }

    private IModel? GetChannel()
    {
        if (_channel is { IsOpen: true })
            return _channel;

        lock (_lock)
        {
            if (_channel is { IsOpen: true })
                return _channel;

            try
            {
                _channel?.Dispose();
                _connection?.Dispose();

                var factory = RabbitMqTopology.BuildFactory(_config);
                _connection = factory.CreateConnection("jobping-api-publisher");
                _channel = _connection.CreateModel();
                RabbitMqTopology.DeclareAll(_channel);
                return _channel;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not connect to RabbitMQ.");
                return null;
            }
        }
    }

    public void Dispose()
    {
        _channel?.Dispose();
        _connection?.Dispose();
    }
}
