namespace JobPing.Domain.Entities;

public class LoginAttempt
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string? IpAddress { get; set; }
    public DateTime AttemptedAt { get; set; } = DateTime.UtcNow;
    public bool IsSuccess { get; set; }
    public string? ErrorMsg { get; set; }

    public User User { get; set; } = null!;
}
