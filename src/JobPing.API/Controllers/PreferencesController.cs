using System.Security.Claims;
using JobPing.Application.DTOs.Common;
using JobPing.Application.DTOs.Preferences;
using JobPing.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace JobPing.API.Controllers;

[ApiController]
[Authorize]
[Route("api/preferences")]
public class PreferencesController : ControllerBase
{
    private readonly IPreferenceService _preferences;

    public PreferencesController(IPreferenceService preferences)
    {
        _preferences = preferences;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    // GET /api/preferences
    [HttpGet]
    public async Task<ActionResult<ApiResponseDto<UserPreferenceResponseDto>>> Get()
    {
        var prefs = await _preferences.GetPreferencesAsync(CurrentUserId);
        return Ok(ApiResponseDto<UserPreferenceResponseDto>.Ok(prefs));
    }

    // PUT /api/preferences
    [HttpPut]
    public async Task<ActionResult<ApiResponseDto<object>>> Update([FromBody] UserPreferenceDto dto)
    {
        await _preferences.UpdatePreferencesAsync(CurrentUserId, dto);
        return Ok(ApiResponseDto<object>.Ok(null!, "Preferences updated."));
    }

    // POST /api/preferences/skills
    [HttpPost("skills")]
    public async Task<ActionResult<ApiResponseDto<object>>> AddSkill([FromBody] AddSkillRequestDto dto)
    {
        await _preferences.AddSkillAsync(CurrentUserId, dto.SkillId);
        return Ok(ApiResponseDto<object>.Ok(null!, "Skill added."));
    }

    // DELETE /api/preferences/skills/{skillId}
    [HttpDelete("skills/{skillId:int}")]
    public async Task<ActionResult<ApiResponseDto<object>>> RemoveSkill(int skillId)
    {
        await _preferences.RemoveSkillAsync(CurrentUserId, skillId);
        return Ok(ApiResponseDto<object>.Ok(null!, "Skill removed."));
    }

    // POST /api/preferences/locations
    [HttpPost("locations")]
    public async Task<ActionResult<ApiResponseDto<object>>> AddLocation([FromBody] AddLocationRequestDto dto)
    {
        await _preferences.AddLocationAsync(CurrentUserId, dto.LocationId);
        return Ok(ApiResponseDto<object>.Ok(null!, "Location added."));
    }

    // DELETE /api/preferences/locations/{locationId}
    [HttpDelete("locations/{locationId:int}")]
    public async Task<ActionResult<ApiResponseDto<object>>> RemoveLocation(int locationId)
    {
        await _preferences.RemoveLocationAsync(CurrentUserId, locationId);
        return Ok(ApiResponseDto<object>.Ok(null!, "Location removed."));
    }
}
