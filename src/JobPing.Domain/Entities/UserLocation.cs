namespace JobPing.Domain.Entities;

public class UserLocation
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int LocationId { get; set; }

    public User User { get; set; } = null!;
    public Location Location { get; set; } = null!;
}
