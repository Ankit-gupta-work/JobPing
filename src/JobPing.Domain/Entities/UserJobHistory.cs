namespace JobPing.Domain.Entities;

public class UserJobHistory
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int JobId { get; set; }
    public string Status { get; set; } = null!;   // "Viewed"|"Applied"|"Interview"|"Offered"|"Rejected"
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Job Job { get; set; } = null!;
}
