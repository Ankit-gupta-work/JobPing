using JobPing.Application.DTOs.Alerts;
using JobPing.Application.Interfaces;
using JobPing.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace JobPing.Infrastructure.Services;

public class AlertService : IAlertService
{
    private readonly JobPingDbContext _db;

    public AlertService(JobPingDbContext db)
    {
        _db = db;
    }

    public async Task<List<AlertHistoryDto>> GetAlertHistoryAsync(int userId)
    {
        return await _db.AlertHistories.AsNoTracking()
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.SentAt)
            .Select(a => new AlertHistoryDto
            {
                Id = a.Id,
                JobId = a.JobId,
                JobTitle = a.Job.Title,
                Company = a.Job.Company,
                SourceUrl = a.Job.SourceUrl,
                SentAt = a.SentAt,
                Status = a.Status,
            })
            .ToListAsync();
    }
}
