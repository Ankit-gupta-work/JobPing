namespace JobPing.Domain.Entities;

public class BackgroundTask
{
    public int Id { get; set; }
    public string TaskName { get; set; } = null!;
    public string? CronExpression { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? LastRunAt { get; set; }
    public DateTime? NextRunAt { get; set; }
    public string? LastStatus { get; set; }   // "Success"|"Failed"|"Running"
    public string? LastErrorMsg { get; set; }
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
}
