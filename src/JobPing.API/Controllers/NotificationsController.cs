using System.Security.Claims;
using JobPing.Application.DTOs.Alerts;
using JobPing.Application.DTOs.Common;
using JobPing.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace JobPing.API.Controllers;

[ApiController]
[Authorize]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notifications;

    public NotificationsController(INotificationService notifications)
    {
        _notifications = notifications;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    // GET /api/notifications?unread=true
    [HttpGet]
    public async Task<ActionResult<ApiResponseDto<List<NotificationDto>>>> GetNotifications([FromQuery] bool unread = false)
    {
        var items = await _notifications.GetNotificationsAsync(CurrentUserId, unread);
        return Ok(ApiResponseDto<List<NotificationDto>>.Ok(items));
    }

    // PATCH /api/notifications/{id}/read
    [HttpPatch("{id:int}/read")]
    public async Task<ActionResult<ApiResponseDto<object>>> MarkRead(int id)
    {
        await _notifications.MarkAsReadAsync(CurrentUserId, id);
        return Ok(ApiResponseDto<object>.Ok(null!, "Marked as read."));
    }

    // PATCH /api/notifications/read-all
    [HttpPatch("read-all")]
    public async Task<ActionResult<ApiResponseDto<object>>> MarkAllRead()
    {
        await _notifications.MarkAllAsReadAsync(CurrentUserId);
        return Ok(ApiResponseDto<object>.Ok(null!, "All marked as read."));
    }
}
