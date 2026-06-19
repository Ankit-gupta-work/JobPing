# Step 2 — User Preferences API

**Status:** ✅ Complete · Build: 0 warnings / 0 errors · No new migration (tables already existed)

Full preferences API with **delta updates** on junction tables, plus JWT authentication and a
global exception middleware.

---

## What was built

| File | Purpose |
|---|---|
| `Application/DTOs/Preferences/UserPreferenceDto.cs` | Request DTO |
| `Application/DTOs/Preferences/UserPreferenceResponseDto.cs` | Response (adds full `Skills`, `Locations`, `Experience`) |
| `Application/DTOs/Preferences/AddPreferenceItemDtos.cs` | `{ skillId }` / `{ locationId }` POST bodies |
| `Application/Interfaces/IPreferenceService.cs` | 6-method contract |
| `Infrastructure/Services/PreferenceService.cs` | Delta logic + cache invalidation |
| `API/Controllers/PreferencesController.cs` | Thin `[Authorize]` controller |
| `API/Middleware/ExceptionMiddleware.cs` | Maps exceptions → `ApiResponseDto` JSON |
| `API/Program.cs` | Registered service, **JWT auth**, exception middleware |

JWT config: `ValidateLifetime`, `ClockSkew = Zero`, `ValidateIssuerSigningKey`, issuer/audience from config.

---

## The 6 endpoints (all `[Authorize]`, under `api/preferences`)

| Method | Route | Body | Result |
|---|---|---|---|
| GET | `/api/preferences` | — | Full profile + skills/locations/experience |
| PUT | `/api/preferences` | `UserPreferenceDto` | Delta-update everything |
| POST | `/api/preferences/skills` | `{ "skillId": 3 }` | Add a skill |
| DELETE | `/api/preferences/skills/{skillId}` | — | Remove a skill |
| POST | `/api/preferences/locations` | `{ "locationId": 2 }` | Add a location |
| DELETE | `/api/preferences/locations/{locationId}` | — | Remove a location |

Error shapes: unknown id → `404`, duplicate add → `409`, all as `ApiResponseDto { success:false }`.

---

## After building

### Test prerequisites (AuthController not built yet)
1. A real user row (junctions FK → `users.id`):
   ```sql
   INSERT INTO users (full_name, username, email, password_hash, role_id, is_active, created_on)
   VALUES ('Test User','testuser','test@jobping.dev','x',2,true,NOW());   -- id 1
   ```
2. A hand-made JWT (HS256, secret `DevSuperSecretKeyMustBeAtLeast32CharactersLong!`):
   ```json
   { "nameid": "1", "iss": "jobping-api", "aud": "jobping-client", "exp": 1797000000 }
   ```
   Paste into Swagger **Authorize**.

### How to test the delta-update logic
Rows present in both old + new lists keep their **same primary key id** (a wipe-and-reinsert would change them).
```sql
-- after PUT skillIds [1,2,3]
SELECT id, skill_id FROM user_skills WHERE user_id=1 ORDER BY skill_id;  -- (10,1)(11,2)(12,3)
-- after PUT skillIds [2,3,4]
SELECT id, skill_id FROM user_skills WHERE user_id=1 ORDER BY skill_id;  -- (11,2)(12,3)(13,4)
```
Skill 1 removed, 4 added, **2 & 3 keep ids 11 & 12** → only the delta (`-1`, `+4`) was applied.
At the SQL level: exactly one `DELETE` + one `INSERT`, nothing touching skills 2 & 3.

### Verify cache invalidation
```
redis-cli SET user:matches:1 "stale"
# call PUT /api/preferences (or add/remove)
redis-cli GET user:matches:1   →  (nil)
```
