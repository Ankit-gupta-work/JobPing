namespace JobPing.Application.DTOs.Alerts;

public class NotificationDto
{
    public int Id { get; set; }
    public string Title { get; set; } = null!;
    public string Message { get; set; } = null!;
    public string Type { get; set; } = null!;   // "job_match" | "alert_sent" | "system"
    public bool IsRead { get; set; }
    public DateTime CreatedOn { get; set; }
}
