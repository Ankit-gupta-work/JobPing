namespace JobPing.Domain.Entities;

public class Location
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public bool IsActive { get; set; } = true;

    public ICollection<UserLocation> UserLocations { get; set; } = new List<UserLocation>();
}
