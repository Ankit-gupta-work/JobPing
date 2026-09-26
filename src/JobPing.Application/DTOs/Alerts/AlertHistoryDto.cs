namespace JobPing.Application.DTOs.Alerts;

public class AlertHistoryDto
{
    public int Id { get; set; }
    public int JobId { get; set; }
    public string JobTitle { get; set; } = null!;
    public string Company { get; set; } = null!;
    public string? SourceUrl { get; set; }
    public DateTime SentAt { get; set; }
    public string Status { get; set; } = null!;   // "Sent" | "Failed"
}
