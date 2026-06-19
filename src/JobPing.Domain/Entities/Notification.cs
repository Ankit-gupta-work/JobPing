namespace JobPing.Domain.Entities;

public class Notification
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Title { get; set; } = null!;
    public string Message { get; set; } = null!;
    public string Type { get; set; } = null!;   // "job_match"|"alert_sent"|"system"
    public bool IsRead { get; set; } = false;
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
