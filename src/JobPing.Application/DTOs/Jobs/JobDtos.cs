namespace JobPing.Application.DTOs.Jobs;

public class JobListItemDto
{
    public int Id { get; set; }
    public string Title { get; set; } = null!;
    public string Company { get; set; } = null!;
    public string Source { get; set; } = null!;
    public string? SourceUrl { get; set; }
    public string? Location { get; set; }
    public bool IsRemote { get; set; }
    public string? JobType { get; set; }
    public decimal? MinSalary { get; set; }
    public decimal? MaxSalary { get; set; }
    public DateTime FetchedAt { get; set; }
    public List<string> Skills { get; set; } = new();
    public int? MatchPercentage { get; set; } // null when not calculating match
    public bool IsSaved { get; set; }
}

public class JobDetailDto : JobListItemDto
{
    public string? Description { get; set; }
}

public class JobFilterDto
{
    public string? Source { get; set; }
    public string? Location { get; set; }
    public List<int>? SkillIds { get; set; }
    public bool? IsRemote { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class PagedResultDto<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}
