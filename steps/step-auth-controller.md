# Auth — Register / Login / JWT (AuthController)

**Status:** ✅ Complete · Build: 0 warnings / 0 errors · No new migration

The previously-deferred auth backend. Makes the Angular register/login flow work for real and
issues the Admin token used by `/api/admin/*`.

---

## What was built

| File | Role |
|---|---|
| `Application/DTOs/Auth/AuthDtos.cs` | `RegisterRequestDto`, `LoginRequestDto`, `RefreshTokenRequestDto`, `AuthResponseDto` |
| `Application/Interfaces/IAuthService.cs` | register / login / refresh / revoke |
| `Application/Interfaces/IJwtService.cs` | generate access + refresh, principal-from-expired |
| `Infrastructure/Services/JwtService.cs` | HS256 JWT (claims `nameid`,`role`,`email`,`name`,`jti`) |
| `Infrastructure/Services/AuthService.cs` | the flows (BCrypt, refresh rotation, attempt logging, welcome mail) |
| `API/Controllers/AuthController.cs` | 5 endpoints + access-token blacklist on revoke |
| `API/Middleware/JwtBlacklistMiddleware.cs` | 401s revoked access tokens (fails open if Redis down) |
| `API/Middleware/ExceptionMiddleware.cs` | added `UnauthorizedAccessException → 401` |
| `Program.cs` | registered `IJwtService`/`IAuthService`, added blacklist middleware |

---

## Endpoints (`api/auth`)

| Method | Route | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/register` | public | `{ fullName, username, email, password }` | `AuthResponseDto` (tokens) |
| POST | `/login` | public | `{ email, password }` | `AuthResponseDto` |
| POST | `/refresh` | public | `{ refreshToken }` | `AuthResponseDto` (rotated) |
| POST | `/revoke` | bearer | `{ refreshToken }` | message |
| GET | `/me` | bearer | — | `{ userId, fullName, email, role }` from claims |

`AuthResponseDto` = `{ userId, fullName, email, role, accessToken, refreshToken, accessTokenExpiresAt }`.

### Flow rules (from CLAUDE.md §8)
- **Register:** unique email + username → BCrypt hash → save user → empty `user_profiles` row →
  log success in `login_attempts` → queue welcome mail (`mail_queue`, Pending) → return tokens.
- **Login:** unknown email *or* wrong password → identical `"Invalid email or password."` (401).
  Inactive account → 401. Failed attempts on a known user are logged.
- **Refresh:** validate the stored token is active → revoke it → issue a new access+refresh pair (rotation).
- **Revoke:** revoke the refresh row + blacklist the access token's `jti` in Redis for its remaining life.

### Security
- BCrypt password hashing; `password_hash` never returned.
- Same error for wrong email vs wrong password.
- `ClockSkew = 0`, HS256, validated issuer/audience/signature.
- Access token 15 min, refresh token 7 days (rotated each refresh).

---

## After building — how to test

```powershell
docker run -d -p 6379:6379 redis:7-alpine      # only needed for /revoke blacklist
dotnet run --project src/JobPing.API --launch-profile http
```

1. **Register** → `POST /api/auth/register` `{ "fullName":"Ada","username":"ada","email":"ada@x.com","password":"password123" }`
   → returns `accessToken` + `refreshToken`.
2. **Login** → `POST /api/auth/login` `{ "email":"ada@x.com","password":"password123" }`.
   Wrong password → `401 { "message": "Invalid email or password." }`.
3. **Me** → `GET /api/auth/me` with `Authorization: Bearer <accessToken>` → your identity.
4. **Refresh** → `POST /api/auth/refresh` `{ "refreshToken":"<refresh>" }` → new pair; the old refresh
   token is now revoked (reusing it → 401).
5. **Revoke** → `POST /api/auth/revoke` `{ "refreshToken":"<refresh>" }` → that access token's `jti`
   is blacklisted; reusing the access token → `401 "Token has been revoked."`.

### Make an Admin (for `/api/admin/fetch-jobs`)
```sql
UPDATE users SET role_id = 1 WHERE email = 'ada@x.com';   -- 1 = Admin
```
Log in again → the new JWT carries `role: "Admin"`.

### Live-test note
Build is clean. A full live run on this machine is blocked by a **Postgres credential mismatch**
(`appsettings` uses `postgres/password`; the local instance rejects it → `28P01`). Fix the
connection string / DB password and the flow runs as above — the auth code itself is independent of
Redis (only `/revoke`'s blacklist touches it, and the middleware fails open).
