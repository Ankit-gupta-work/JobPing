namespace JobPing.Application.Interfaces;

public interface IJobFetchService
{
    /// <summary>
    /// Runs the full fetch pipeline (lock → fetch sources → dedup → save → extract skills →
    /// publish → invalidate cache). Returns the number of brand-new jobs inserted.
    /// Returns 0 if the distributed lock was already held (another run in progress).
    /// </summary>
    Task<int> FetchAndStoreJobsAsync(CancellationToken cancellationToken = default);
}
