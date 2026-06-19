using JobPing.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using StackExchange.Redis;

namespace JobPing.Infrastructure.Services;

public class RedisCacheService : ICacheService
{
    private const string BlacklistPrefix = "blacklist:jwt:";

    private readonly IConnectionMultiplexer _redis;
    private readonly IDatabase _db;
    private readonly ILogger<RedisCacheService> _logger;

    public RedisCacheService(IConnectionMultiplexer redis, ILogger<RedisCacheService> logger)
    {
        _redis = redis;
        _db = redis.GetDatabase();
        _logger = logger;
    }

    public async Task<T?> GetAsync<T>(string key)
    {
        var value = await _db.StringGetAsync(key);
        if (value.IsNullOrEmpty)
            return default;

        try
        {
            return JsonConvert.DeserializeObject<T>(value!);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to deserialize cached value for key {Key}", key);
            return default;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? ttl = null)
    {
        // Coding rule #16: always set a TTL on every Redis key.
        var expiry = ttl ?? TimeSpan.FromMinutes(10);
        var json = JsonConvert.SerializeObject(value);
        await _db.StringSetAsync(key, json, expiry);
    }

    public async Task RemoveAsync(string key)
    {
        await _db.KeyDeleteAsync(key);
    }

    public async Task RemoveByPatternAsync(string pattern)
    {
        foreach (var endpoint in _redis.GetEndPoints())
        {
            var server = _redis.GetServer(endpoint);
            if (!server.IsConnected || server.IsReplica)
                continue;

            var keys = server.Keys(database: _db.Database, pattern: pattern).ToArray();
            if (keys.Length > 0)
                await _db.KeyDeleteAsync(keys);
        }
    }

    public async Task<bool> AcquireLockAsync(string key, string value, TimeSpan ttl)
    {
        // SET key value NX EX {seconds} — returns false if already held.
        return await _db.StringSetAsync(key, value, ttl, When.NotExists);
    }

    public async Task ReleaseLockAsync(string key, string value)
    {
        // Only release if the value matches — avoids releasing another instance's lock.
        const string script = @"
            if redis.call('get', KEYS[1]) == ARGV[1] then
                return redis.call('del', KEYS[1])
            else
                return 0
            end";

        await _db.ScriptEvaluateAsync(script, new RedisKey[] { key }, new RedisValue[] { value });
    }

    public async Task<bool> IsBlacklistedAsync(string jti)
    {
        return await _db.KeyExistsAsync($"{BlacklistPrefix}{jti}");
    }

    public async Task BlacklistTokenAsync(string jti, TimeSpan ttl)
    {
        await _db.StringSetAsync($"{BlacklistPrefix}{jti}", "revoked", ttl);
    }
}
