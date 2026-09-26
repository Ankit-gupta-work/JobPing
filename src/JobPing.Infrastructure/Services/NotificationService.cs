using JobPing.Application.DTOs.Alerts;
using JobPing.Application.Interfaces;
using JobPing.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace JobPing.Infrastructure.Services;

public class NotificationService : INotificationService
{
    private readonly JobPingDbContext _db;

    public NotificationService(JobPingDbContext db)
    {
        _db = db;
    }

    public async Task<List<NotificationDto>> GetNotificationsAsync(int userId, bool unreadOnly)
    {
        var query = _db.Notifications.AsNoTracking().Where(n => n.UserId == userId);
        if (unreadOnly)
            query = query.Where(n => !n.IsRead);

        return await query
            .OrderByDescending(n => n.CreatedOn)
            .Select(n => new NotificationDto
            {
                Id = n.Id,
                Title = n.Title,
                Message = n.Message,
                Type = n.Type,
                IsRead = n.IsRead,
                CreatedOn = n.CreatedOn,
            })
            .ToListAsync();
    }

    public async Task MarkAsReadAsync(int userId, int notificationId)
    {
        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId);
        if (notification is null)
            throw new KeyNotFoundException($"Notification {notificationId} was not found.");

        notification.IsRead = true;
        await _db.SaveChangesAsync();
    }

    public async Task MarkAllAsReadAsync(int userId)
    {
        var unread = await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();

        foreach (var notification in unread)
            notification.IsRead = true;

        await _db.SaveChangesAsync();
    }
}
