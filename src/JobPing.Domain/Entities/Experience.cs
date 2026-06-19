namespace JobPing.Domain.Entities;

public class Experience
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public bool IsActive { get; set; } = true;

    public ICollection<UserProfile> UserProfiles { get; set; } = new List<UserProfile>();
}
