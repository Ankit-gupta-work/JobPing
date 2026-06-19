namespace JobPing.Domain.Entities;

public class MailQueue
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? JobId { get; set; }
    public string Subject { get; set; } = null!;
    public string Body { get; set; } = null!;
    public string Sender { get; set; } = null!;
    public string Receiver { get; set; } = null!;
    public string Status { get; set; } = "Pending";   // Pending|Processing|Sent|Failed
    public int NoOfAttempts { get; set; } = 0;
    public DateTime? NextRetryAt { get; set; }
    public string? ErrorMsg { get; set; }
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    public DateTime? SentAt { get; set; }

    public User User { get; set; } = null!;
    public Job? Job { get; set; }
}
