using JobPing.Application.DTOs.Common;
using JobPing.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace JobPing.API.Controllers;

[ApiController]
[Route("api/master")]
public class MasterDataController : ControllerBase
{
    private readonly IMasterDataService _masterData;

    public MasterDataController(IMasterDataService masterData)
    {
        _masterData = masterData;
    }

    // GET /api/master/skills — public, cached 24h
    [HttpGet("skills")]
    public async Task<ActionResult<ApiResponseDto<List<SkillDto>>>> GetSkills()
    {
        var skills = await _masterData.GetSkillsAsync();
        return Ok(ApiResponseDto<List<SkillDto>>.Ok(skills));
    }

    // GET /api/master/locations — public, cached 24h
    [HttpGet("locations")]
    public async Task<ActionResult<ApiResponseDto<List<LocationDto>>>> GetLocations()
    {
        var locations = await _masterData.GetLocationsAsync();
        return Ok(ApiResponseDto<List<LocationDto>>.Ok(locations));
    }

    // GET /api/master/experiences — public, cached 24h
    [HttpGet("experiences")]
    public async Task<ActionResult<ApiResponseDto<List<ExperienceDto>>>> GetExperiences()
    {
        var experiences = await _masterData.GetExperiencesAsync();
        return Ok(ApiResponseDto<List<ExperienceDto>>.Ok(experiences));
    }
}
