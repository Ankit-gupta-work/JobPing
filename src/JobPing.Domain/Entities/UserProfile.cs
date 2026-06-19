namespace JobPing.Domain.Entities;

public class UserProfile
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? ExperienceId { get; set; }
    public bool IsRemoteOnly { get; set; } = false;
    public decimal? MinSalary { get; set; }
    public decimal? MaxSalary { get; set; }
    public int MinMatchPercentage { get; set; } = 50;
    public bool IsEmailNotification { get; set; } = true;
    public bool IsPushNotification { get; set; } = false;
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedOn { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Experience? Experience { get; set; }
}
