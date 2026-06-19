namespace JobPing.Domain.Entities;

public class Skill
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public bool IsActive { get; set; } = true;

    public ICollection<UserSkill> UserSkills { get; set; } = new List<UserSkill>();
    public ICollection<JobSkill> JobSkills { get; set; } = new List<JobSkill>();
}
