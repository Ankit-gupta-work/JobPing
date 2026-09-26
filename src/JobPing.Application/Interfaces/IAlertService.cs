using JobPing.Application.DTOs.Alerts;

namespace JobPing.Application.Interfaces;

public interface IAlertService
{
    Task<List<AlertHistoryDto>> GetAlertHistoryAsync(int userId);
}
