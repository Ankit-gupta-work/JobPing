using System.Security.Claims;
using JobPing.Application.DTOs.Alerts;
using JobPing.Application.DTOs.Common;
using JobPing.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace JobPing.API.Controllers;

[ApiController]
[Authorize]
[Route("api/alerts")]
public class AlertsController : ControllerBase
{
    private readonly IAlertService _alerts;

    public AlertsController(IAlertService alerts)
    {
        _alerts = alerts;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    // GET /api/alerts
    [HttpGet]
    public async Task<ActionResult<ApiResponseDto<List<AlertHistoryDto>>>> GetAlerts()
    {
        var alerts = await _alerts.GetAlertHistoryAsync(CurrentUserId);
        return Ok(ApiResponseDto<List<AlertHistoryDto>>.Ok(alerts));
    }
}
