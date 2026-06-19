namespace JobPing.Domain.Entities;

public class AlertHistory
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int JobId { get; set; }
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = null!;   // "Sent" | "Failed"

    public User User { get; set; } = null!;
    public Job Job { get; set; } = null!;
}
