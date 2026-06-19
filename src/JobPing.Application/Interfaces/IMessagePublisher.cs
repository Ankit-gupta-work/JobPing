namespace JobPing.Application.Interfaces;

public interface IMessagePublisher
{
    Task PublishJobFetchedAsync(int jobId, string source);
    Task PublishEmailSendAsync(EmailSendMessage message);
    Task PublishNotificationAsync(NotificationMessage message);
}

public class EmailSendMessage
{
    public int UserId { get; set; }
    public int JobId { get; set; }
    public int MailQueueId { get; set; }
    public string To { get; set; } = null!;
    public string Subject { get; set; } = null!;
    public string Body { get; set; } = null!;
}

public class NotificationMessage
{
    public int UserId { get; set; }
    public string Title { get; set; } = null!;
    public string Message { get; set; } = null!;
    public string Type { get; set; } = null!;
}
