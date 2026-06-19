namespace JobPing.Domain.Entities;

public class User
{
    public int Id { get; set; }
    public string FullName { get; set; } = null!;
    public string Username { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public int RoleId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

    public Role Role { get; set; } = null!;
    public UserProfile? UserProfile { get; set; }
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<LoginAttempt> LoginAttempts { get; set; } = new List<LoginAttempt>();
    public ICollection<UserSkill> UserSkills { get; set; } = new List<UserSkill>();
    public ICollection<UserLocation> UserLocations { get; set; } = new List<UserLocation>();
    public ICollection<SavedJob> SavedJobs { get; set; } = new List<SavedJob>();
    public ICollection<UserJobHistory> UserJobHistories { get; set; } = new List<UserJobHistory>();
    public ICollection<AlertHistory> AlertHistories { get; set; } = new List<AlertHistory>();
    public ICollection<MailQueue> MailQueues { get; set; } = new List<MailQueue>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
}
