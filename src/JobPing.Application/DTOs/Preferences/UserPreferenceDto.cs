namespace JobPing.Application.DTOs.Preferences;

public class UserPreferenceDto
{
    public int? ExperienceId { get; set; }
    public bool IsRemoteOnly { get; set; }
    public decimal? MinSalary { get; set; }
    public decimal? MaxSalary { get; set; }
    public int MinMatchPercentage { get; set; } = 50;
    public bool IsEmailNotification { get; set; }
    public List<int> SkillIds { get; set; } = new();
    public List<int> LocationIds { get; set; } = new();
}
