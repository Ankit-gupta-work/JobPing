namespace JobPing.Domain.Entities;

public class Job
{
    public int Id { get; set; }
    public string ExternalId { get; set; } = null!;
    public string Source { get; set; } = null!;
    public string? SourceUrl { get; set; }
    public string Title { get; set; } = null!;
    public string Company { get; set; } = null!;
    public string? Description { get; set; }
    public string? JobType { get; set; }
    public string? Location { get; set; }
    public bool IsRemote { get; set; } = false;
    public decimal? MinSalary { get; set; }
    public decimal? MaxSalary { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime FetchedAt { get; set; } = DateTime.UtcNow;

    public ICollection<JobSkill> JobSkills { get; set; } = new List<JobSkill>();
    public ICollection<SavedJob> SavedJobs { get; set; } = new List<SavedJob>();
    public ICollection<UserJobHistory> UserJobHistories { get; set; } = new List<UserJobHistory>();
    public ICollection<AlertHistory> AlertHistories { get; set; } = new List<AlertHistory>();
    public ICollection<MailQueue> MailQueues { get; set; } = new List<MailQueue>();
}
