namespace JobPing.Application.Interfaces;

public interface ICacheService
{
    Task<T?> GetAsync<T>(string key);
    Task SetAsync<T>(string key, T value, TimeSpan? ttl = null);
    Task RemoveAsync(string key);
    Task RemoveByPatternAsync(string pattern);
    Task<bool> AcquireLockAsync(string key, string value, TimeSpan ttl);
    Task ReleaseLockAsync(string key, string value);
    Task<bool> IsBlacklistedAsync(string jti);
    Task BlacklistTokenAsync(string jti, TimeSpan ttl);
}
