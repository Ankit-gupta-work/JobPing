namespace JobPing.Domain.Entities;

public class JobSkill
{
    public int Id { get; set; }
    public int JobId { get; set; }
    public int SkillId { get; set; }

    public Job Job { get; set; } = null!;
    public Skill Skill { get; set; } = null!;
}
