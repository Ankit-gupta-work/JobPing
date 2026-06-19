using JobPing.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace JobPing.Infrastructure.Data;

public class JobPingDbContext : DbContext
{
    // Seed timestamp must be static/deterministic — HasData rejects DateTime.UtcNow.
    private static readonly DateTime SeedDate = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    public JobPingDbContext(DbContextOptions<JobPingDbContext> options) : base(options) { }

    // Master
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Skill> Skills => Set<Skill>();
    public DbSet<Experience> Experiences => Set<Experience>();
    public DbSet<Location> Locations => Set<Location>();

    // User
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<LoginAttempt> LoginAttempts => Set<LoginAttempt>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<UserSkill> UserSkills => Set<UserSkill>();
    public DbSet<UserLocation> UserLocations => Set<UserLocation>();

    // Jobs
    public DbSet<Job> Jobs => Set<Job>();
    public DbSet<JobSkill> JobSkills => Set<JobSkill>();
    public DbSet<SavedJob> SavedJobs => Set<SavedJob>();
    public DbSet<UserJobHistory> UserJobHistories => Set<UserJobHistory>();
    public DbSet<AlertHistory> AlertHistories => Set<AlertHistory>();

    // Queue & tasks
    public DbSet<MailQueue> MailQueues => Set<MailQueue>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<BackgroundTask> BackgroundTasks => Set<BackgroundTask>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        base.OnModelCreating(mb);

        // ---------------------------------------------------------------
        // Table mappings (snake_case)
        // ---------------------------------------------------------------
        mb.Entity<Role>().ToTable("roles");
        mb.Entity<Skill>().ToTable("skills");
        mb.Entity<Experience>().ToTable("experiences");
        mb.Entity<Location>().ToTable("locations");
        mb.Entity<User>().ToTable("users");
        mb.Entity<RefreshToken>().ToTable("refresh_tokens");
        mb.Entity<LoginAttempt>().ToTable("login_attempts");
        mb.Entity<UserProfile>().ToTable("user_profiles");
        mb.Entity<UserSkill>().ToTable("user_skills");
        mb.Entity<UserLocation>().ToTable("user_locations");
        mb.Entity<Job>().ToTable("jobs");
        mb.Entity<JobSkill>().ToTable("job_skills");
        mb.Entity<SavedJob>().ToTable("saved_jobs");
        mb.Entity<UserJobHistory>().ToTable("user_job_history");
        mb.Entity<AlertHistory>().ToTable("alert_history");
        mb.Entity<MailQueue>().ToTable("mail_queue");
        mb.Entity<Notification>().ToTable("notifications");
        mb.Entity<BackgroundTask>().ToTable("background_tasks");

        // ---------------------------------------------------------------
        // roles
        // ---------------------------------------------------------------
        mb.Entity<Role>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(50).IsRequired();
            e.HasIndex(x => x.Name).IsUnique();
        });

        // ---------------------------------------------------------------
        // skills
        // ---------------------------------------------------------------
        mb.Entity<Skill>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.IsActive).HasDefaultValue(true);
            e.HasIndex(x => x.Name).IsUnique();
        });

        // ---------------------------------------------------------------
        // experiences
        // ---------------------------------------------------------------
        mb.Entity<Experience>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(50).IsRequired();
            e.Property(x => x.IsActive).HasDefaultValue(true);
        });

        // ---------------------------------------------------------------
        // locations
        // ---------------------------------------------------------------
        mb.Entity<Location>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.IsActive).HasDefaultValue(true);
        });

        // ---------------------------------------------------------------
        // users
        // ---------------------------------------------------------------
        mb.Entity<User>(e =>
        {
            e.Property(x => x.FullName).HasMaxLength(150).IsRequired();
            e.Property(x => x.Username).HasMaxLength(50).IsRequired();
            e.Property(x => x.Email).HasMaxLength(200).IsRequired();
            e.Property(x => x.PasswordHash).IsRequired();
            e.Property(x => x.IsActive).HasDefaultValue(true);
            e.Property(x => x.CreatedOn).HasDefaultValueSql("NOW()");
            e.HasIndex(x => x.Username).IsUnique();
            e.HasIndex(x => x.Email).IsUnique();

            e.HasOne(x => x.Role)
                .WithMany(r => r.Users)
                .HasForeignKey(x => x.RoleId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ---------------------------------------------------------------
        // refresh_tokens
        // ---------------------------------------------------------------
        mb.Entity<RefreshToken>(e =>
        {
            e.Property(x => x.Token).IsRequired();
            e.Property(x => x.CreatedOn).HasDefaultValueSql("NOW()");
            e.HasIndex(x => x.Token).IsUnique();

            // Ignore computed properties — not stored in DB
            e.Ignore(x => x.IsExpired).Ignore(x => x.IsRevoked).Ignore(x => x.IsActive);

            e.HasOne(x => x.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---------------------------------------------------------------
        // login_attempts
        // ---------------------------------------------------------------
        mb.Entity<LoginAttempt>(e =>
        {
            e.Property(x => x.IpAddress).HasMaxLength(50);
            e.Property(x => x.ErrorMsg).HasMaxLength(300);
            e.Property(x => x.AttemptedAt).HasDefaultValueSql("NOW()");

            e.HasOne(x => x.User)
                .WithMany(u => u.LoginAttempts)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---------------------------------------------------------------
        // user_profiles (one-to-one with users)
        // ---------------------------------------------------------------
        mb.Entity<UserProfile>(e =>
        {
            e.Property(x => x.MinSalary).HasColumnType("decimal(10,2)");
            e.Property(x => x.MaxSalary).HasColumnType("decimal(10,2)");
            e.Property(x => x.IsRemoteOnly).HasDefaultValue(false);
            e.Property(x => x.MinMatchPercentage).HasDefaultValue(50);
            e.Property(x => x.IsEmailNotification).HasDefaultValue(true);
            e.Property(x => x.IsPushNotification).HasDefaultValue(false);
            e.Property(x => x.CreatedOn).HasDefaultValueSql("NOW()");
            e.Property(x => x.UpdatedOn).HasDefaultValueSql("NOW()");

            e.HasIndex(x => x.UserId).IsUnique();

            e.HasOne(x => x.User)
                .WithOne(u => u.UserProfile)
                .HasForeignKey<UserProfile>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Experience)
                .WithMany(ex => ex.UserProfiles)
                .HasForeignKey(x => x.ExperienceId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ---------------------------------------------------------------
        // user_skills (junction)
        // ---------------------------------------------------------------
        mb.Entity<UserSkill>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.SkillId }).IsUnique();

            e.HasOne(x => x.User)
                .WithMany(u => u.UserSkills)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Skill)
                .WithMany(s => s.UserSkills)
                .HasForeignKey(x => x.SkillId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---------------------------------------------------------------
        // user_locations (junction)
        // ---------------------------------------------------------------
        mb.Entity<UserLocation>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.LocationId }).IsUnique();

            e.HasOne(x => x.User)
                .WithMany(u => u.UserLocations)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Location)
                .WithMany(l => l.UserLocations)
                .HasForeignKey(x => x.LocationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---------------------------------------------------------------
        // jobs
        // ---------------------------------------------------------------
        mb.Entity<Job>(e =>
        {
            e.Property(x => x.ExternalId).HasMaxLength(200).IsRequired();
            e.Property(x => x.Source).HasMaxLength(50).IsRequired();
            e.Property(x => x.Title).HasMaxLength(300).IsRequired();
            e.Property(x => x.Company).HasMaxLength(200).IsRequired();
            e.Property(x => x.JobType).HasMaxLength(50);
            e.Property(x => x.Location).HasMaxLength(200);
            e.Property(x => x.MinSalary).HasColumnType("decimal(10,2)");
            e.Property(x => x.MaxSalary).HasColumnType("decimal(10,2)");
            e.Property(x => x.IsRemote).HasDefaultValue(false);
            e.Property(x => x.IsActive).HasDefaultValue(true);
            e.Property(x => x.FetchedAt).HasDefaultValueSql("NOW()");

            // Deduplication
            e.HasIndex(x => new { x.ExternalId, x.Source }).IsUnique();
            // Worker query index
            e.HasIndex(x => new { x.IsActive, x.FetchedAt }).HasDatabaseName("idx_jobs_active_fetched");
        });

        // ---------------------------------------------------------------
        // job_skills (junction)
        // ---------------------------------------------------------------
        mb.Entity<JobSkill>(e =>
        {
            e.HasIndex(x => new { x.JobId, x.SkillId }).IsUnique();

            e.HasOne(x => x.Job)
                .WithMany(j => j.JobSkills)
                .HasForeignKey(x => x.JobId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Skill)
                .WithMany(s => s.JobSkills)
                .HasForeignKey(x => x.SkillId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---------------------------------------------------------------
        // saved_jobs
        // ---------------------------------------------------------------
        mb.Entity<SavedJob>(e =>
        {
            e.Property(x => x.CreatedOn).HasDefaultValueSql("NOW()");
            e.Property(x => x.IsActive).HasDefaultValue(true);

            e.HasOne(x => x.User)
                .WithMany(u => u.SavedJobs)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Job)
                .WithMany(j => j.SavedJobs)
                .HasForeignKey(x => x.JobId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---------------------------------------------------------------
        // user_job_history
        // ---------------------------------------------------------------
        mb.Entity<UserJobHistory>(e =>
        {
            e.Property(x => x.Status).HasMaxLength(50).IsRequired();
            e.Property(x => x.CreatedOn).HasDefaultValueSql("NOW()");

            e.HasOne(x => x.User)
                .WithMany(u => u.UserJobHistories)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Job)
                .WithMany(j => j.UserJobHistories)
                .HasForeignKey(x => x.JobId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---------------------------------------------------------------
        // alert_history (UNIQUE(user_id, job_id) prevents duplicate alerts)
        // ---------------------------------------------------------------
        mb.Entity<AlertHistory>(e =>
        {
            e.Property(x => x.Status).HasMaxLength(50).IsRequired();
            e.Property(x => x.SentAt).HasDefaultValueSql("NOW()");

            e.HasIndex(x => new { x.UserId, x.JobId }).IsUnique();

            e.HasOne(x => x.User)
                .WithMany(u => u.AlertHistories)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Job)
                .WithMany(j => j.AlertHistories)
                .HasForeignKey(x => x.JobId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---------------------------------------------------------------
        // mail_queue (JobId nullable -> SetNull)
        // ---------------------------------------------------------------
        mb.Entity<MailQueue>(e =>
        {
            e.Property(x => x.Subject).HasMaxLength(300).IsRequired();
            e.Property(x => x.Body).IsRequired();
            e.Property(x => x.Sender).HasMaxLength(200).IsRequired();
            e.Property(x => x.Receiver).HasMaxLength(200).IsRequired();
            e.Property(x => x.Status).HasMaxLength(50).HasDefaultValue("Pending");
            e.Property(x => x.NoOfAttempts).HasDefaultValue(0);
            e.Property(x => x.CreatedOn).HasDefaultValueSql("NOW()");

            e.HasIndex(x => new { x.Status, x.CreatedOn }).HasDatabaseName("idx_mail_queue_status");

            e.HasOne(x => x.User)
                .WithMany(u => u.MailQueues)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Job)
                .WithMany(j => j.MailQueues)
                .HasForeignKey(x => x.JobId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ---------------------------------------------------------------
        // notifications
        // ---------------------------------------------------------------
        mb.Entity<Notification>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Message).IsRequired();
            e.Property(x => x.Type).HasMaxLength(50).IsRequired();
            e.Property(x => x.IsRead).HasDefaultValue(false);
            e.Property(x => x.CreatedOn).HasDefaultValueSql("NOW()");

            e.HasIndex(x => new { x.UserId, x.IsRead, x.CreatedOn })
                .HasDatabaseName("idx_notifications_user_unread");

            e.HasOne(x => x.User)
                .WithMany(u => u.Notifications)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---------------------------------------------------------------
        // background_tasks
        // ---------------------------------------------------------------
        mb.Entity<BackgroundTask>(e =>
        {
            e.Property(x => x.TaskName).HasMaxLength(100).IsRequired();
            e.Property(x => x.CronExpression).HasMaxLength(100);
            e.Property(x => x.LastStatus).HasMaxLength(50);
            e.Property(x => x.IsActive).HasDefaultValue(true);
            e.Property(x => x.CreatedOn).HasDefaultValueSql("NOW()");
        });

        // ---------------------------------------------------------------
        // Convert all column names to snake_case automatically
        // ---------------------------------------------------------------
        foreach (var entity in mb.Model.GetEntityTypes())
        {
            foreach (var prop in entity.GetProperties())
            {
                prop.SetColumnName(ToSnakeCase(prop.GetColumnName()));
            }
        }

        SeedData(mb);
    }

    private static void SeedData(ModelBuilder mb)
    {
        // roles
        mb.Entity<Role>().HasData(
            new Role { Id = 1, Name = "Admin" },
            new Role { Id = 2, Name = "User" });

        // experiences
        mb.Entity<Experience>().HasData(
            new Experience { Id = 1, Name = "Fresher", IsActive = true },
            new Experience { Id = 2, Name = "1-2 years", IsActive = true },
            new Experience { Id = 3, Name = "2-5 years", IsActive = true },
            new Experience { Id = 4, Name = "5+ years", IsActive = true });

        // skills
        var skills = new[]
        {
            "Angular", ".NET Core", "React", "TypeScript", "JavaScript",
            "PostgreSQL", "SQL Server", "MongoDB", "Redis", "Docker",
            "Node.js", "Python", "Go", "Java", "Azure", "AWS",
            "Kubernetes", "CI/CD", "Vue", "Next.js"
        };
        mb.Entity<Skill>().HasData(
            skills.Select((name, i) => new Skill { Id = i + 1, Name = name, IsActive = true }).ToArray());

        // locations
        var locations = new[] { "Remote", "Pune", "Hyderabad", "Bangalore", "Mumbai", "Delhi" };
        mb.Entity<Location>().HasData(
            locations.Select((name, i) => new Location { Id = i + 1, Name = name, IsActive = true }).ToArray());

        // background_tasks
        mb.Entity<BackgroundTask>().HasData(
            new BackgroundTask { Id = 1, TaskName = "FetchJobsTask", CronExpression = "0 */2 * * *", IsActive = true, CreatedOn = SeedDate },
            new BackgroundTask { Id = 2, TaskName = "MatchAndAlertTask", CronExpression = "30 */2 * * *", IsActive = true, CreatedOn = SeedDate });
    }

    private static string ToSnakeCase(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;

        var sb = new System.Text.StringBuilder(input.Length + 8);
        for (int i = 0; i < input.Length; i++)
        {
            var c = input[i];
            if (char.IsUpper(c))
            {
                if (i > 0 && (!char.IsUpper(input[i - 1]) || (i + 1 < input.Length && !char.IsUpper(input[i + 1]))))
                    sb.Append('_');
                sb.Append(char.ToLowerInvariant(c));
            }
            else
            {
                sb.Append(c);
            }
        }
        return sb.ToString();
    }
}
