using JobPing.Application.DTOs.Alerts;

namespace JobPing.Application.Interfaces;

public interface INotificationService
{
    Task<List<NotificationDto>> GetNotificationsAsync(int userId, bool unreadOnly);
    Task MarkAsReadAsync(int userId, int notificationId);
    Task MarkAllAsReadAsync(int userId);
}
