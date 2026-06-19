using JobPing.Application.DTOs.Common;
using JobPing.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace JobPing.API.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly IJobFetchService _jobFetch;

    public AdminController(IJobFetchService jobFetch)
    {
        _jobFetch = jobFetch;
    }

    // POST /api/admin/fetch-jobs — manually trigger the fetch pipeline.
    [HttpPost("fetch-jobs")]
    public async Task<ActionResult<ApiResponseDto<object>>> FetchJobs()
    {
        var newJobs = await _jobFetch.FetchAndStoreJobsAsync(HttpContext.RequestAborted);
        return Ok(ApiResponseDto<object>.Ok(
            new { newJobs },
            $"Fetch complete — {newJobs} new job(s) inserted."));
    }
}
