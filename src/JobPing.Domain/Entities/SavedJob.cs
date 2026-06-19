namespace JobPing.Domain.Entities;

public class SavedJob
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int JobId { get; set; }
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    public User User { get; set; } = null!;
    public Job Job { get; set; } = null!;
}
