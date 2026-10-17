export const environment = {
  production: true,
  // Every controller route is under /api (e.g. [Route("api/auth")]) — every
  // *.service.ts builds its endpoint URL as `${apiBaseUrl}/auth` etc., so this
  // must include /api itself, same as the local dev environment.ts does.
  apiBaseUrl: 'https://jobping-production-040e.up.railway.app/api',
};
