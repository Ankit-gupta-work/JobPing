using System.Security.Claims;
using JobPing.Application.DTOs.Common;
using JobPing.Application.DTOs.Jobs;
using JobPing.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace JobPing.API.Controllers;

[ApiController]
[Authorize]
[Route("api/jobs")]
public class JobsController : ControllerBase
{
    private readonly IJobService _jobs;
    private readonly IMatchingService _matching;

    public JobsController(IJobService jobs, IMatchingService matching)
    {
        _jobs = jobs;
        _matching = matching;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    // GET /api/jobs?source=&location=&skillIds=1&skillIds=2&isRemote=&page=&pageSize=
    [HttpGet]
    public async Task<ActionResult<ApiResponseDto<PagedResultDto<JobListItemDto>>>> GetJobs(
        [FromQuery] JobFilterDto filter)
    {
        var result = await _jobs.GetJobsAsync(filter, CurrentUserId);
        return Ok(ApiResponseDto<PagedResultDto<JobListItemDto>>.Ok(result));
    }

    // GET /api/jobs/matches
    [HttpGet("matches")]
    public async Task<ActionResult<ApiResponseDto<List<JobListItemDto>>>> GetMatches()
    {
        var matches = await _matching.GetTopMatchesAsync(CurrentUserId);
        return Ok(ApiResponseDto<List<JobListItemDto>>.Ok(matches));
    }

    // GET /api/jobs/saved
    [HttpGet("saved")]
    public async Task<ActionResult<ApiResponseDto<List<JobListItemDto>>>> GetSaved()
    {
        var saved = await _jobs.GetSavedJobsAsync(CurrentUserId);
        return Ok(ApiResponseDto<List<JobListItemDto>>.Ok(saved));
    }

    // GET /api/jobs/{id}
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ApiResponseDto<JobDetailDto>>> GetById(int id)
    {
        var job = await _jobs.GetJobByIdAsync(id, CurrentUserId);
        if (job is null)
            throw new KeyNotFoundException($"Job {id} was not found.");

        return Ok(ApiResponseDto<JobDetailDto>.Ok(job));
    }

    // POST /api/jobs/{id}/save — toggles saved state.
    [HttpPost("{id:int}/save")]
    public async Task<ActionResult<ApiResponseDto<object>>> ToggleSave(int id)
    {
        await _jobs.ToggleSaveJobAsync(CurrentUserId, id);
        return Ok(ApiResponseDto<object>.Ok(null!, "Save state toggled."));
    }
}
