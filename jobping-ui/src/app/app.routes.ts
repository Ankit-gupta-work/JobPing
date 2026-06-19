import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./pages/auth/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./pages/auth/register/register.component').then((m) => m.RegisterComponent),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },

  // ---- Pages built in later steps — placeholder for now (routes/navbar work) ----
  {
    path: 'jobs',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/jobs/jobs-list/jobs-list.component').then((m) => m.JobsListComponent),
  },
  {
    path: 'jobs/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/jobs/job-detail/job-detail.component').then((m) => m.JobDetailComponent),
  },
  {
    path: 'alerts',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
  },
  {
    path: 'saved',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
  },
  {
    path: 'preferences',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/placeholder/placeholder.component').then((m) => m.PlaceholderComponent),
  },

  { path: '**', redirectTo: '' },
];
