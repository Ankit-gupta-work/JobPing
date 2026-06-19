# Step 3 — Angular Onboarding wired to real APIs

**Status:** ✅ Complete · Builds clean (lazy chunks generated, Tailwind + design system verified)

Angular 21 standalone app in `jobping-ui/`: design system, app foundation, guards/interceptor,
3 services, and the 4-step register flow + login + dashboard + navbar.

---

## What was built (`jobping-ui/`)
```
tailwind.config.js                 extends theme with all CLAUDE.md hex tokens
src/
├── styles.css                     fonts + Material theme + Tailwind + design imports
├── styles/_variables.css          color/font/radius tokens
├── styles/_globals.css            .text-gradient .glow-orb .nav-blur .jp-input .chip-active + animations
├── environments/environment.ts    apiBaseUrl → http://localhost:5052/api
└── app/
    ├── app.component.ts            <router-outlet />
    ├── app.config.ts              router + httpClient(authInterceptor) + animations
    ├── app.routes.ts              all routes, lazy loadComponent
    ├── guards/{auth,guest}.guard.ts
    ├── interceptors/auth.interceptor.ts
    ├── models/index.ts            typed DTOs mirroring the backend
    ├── services/{auth,master-data,preference}.service.ts
    ├── components/navbar/navbar.component.ts
    └── pages/
        ├── landing/               hero + CTA
        ├── auth/login/            login form
        ├── auth/register/         4-step onboarding
        ├── dashboard/             welcome placeholder
        └── placeholder/           shared "coming soon" for not-yet-built routes
```

### Notes
- **Angular 21** (zone-based, scaffolded `--zoneless=false`), **Tailwind 3** (so `theme.extend` works
  and `bg-bg-surface` / `text-text-primary` are valid classes), Material only for spinner + snackbar.
- Routes for pages not built yet (jobs/alerts/saved/preferences/profile) lazy-load a shared
  `PlaceholderComponent`, so `ng serve` and every navbar link work today.
- Component → Service → API always (never HttpClient in a component). Interceptor attaches the
  Bearer token and bounces to `/auth/login` on 401. Guards read `localStorage` token.

---

## After building

### How to run
```powershell
cd jobping-ui
ng serve            # http://localhost:4200
```
Backend on the matching port (CORS allows 4200):
```powershell
dotnet run --project src/JobPing.API --launch-profile http   # http://localhost:5052
```

### API calls the onboarding flow makes — in order
| Step | Trigger | Call |
|---|---|---|
| 0 Account | "Create account" | `POST /api/auth/register` → stores tokens |
| 1 Skills | step opens | `GET /api/master/skills` |
| 2 Preferences | step opens | `GET /api/master/locations` + `GET /api/master/experiences` |
| 3 Notifications | "Finish setup" | `PUT /api/preferences` → navigate `/dashboard` |

Login: `POST /api/auth/login` → store tokens → `/dashboard`.

### Dependency
`register` / `login` hit **AuthController, not built yet** — those two buttons error until that
backend step. Everything else works now (guards, master-data chips, layout, `PUT /preferences`
with a seeded token).
