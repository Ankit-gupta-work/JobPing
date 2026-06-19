import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="nav-blur sticky top-0 z-50">
      <nav class="max-w-7xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between">
        <!-- Logo -->
        <a routerLink="/dashboard" class="flex items-center gap-2">
          <span class="grid place-items-center w-8 h-8 rounded-md bg-accent-muted border border-accent-border">
            <span class="text-accent-light font-mono text-sm">JP</span>
          </span>
          <span class="text-gradient font-bold text-lg tracking-tight">JobPing</span>
        </a>

        <!-- Links -->
        <div class="hidden sm:flex items-center gap-1">
          @for (link of links; track link.path) {
            <a
              [routerLink]="link.path"
              routerLinkActive="bg-accent-muted text-accent-light"
              class="px-3 py-2 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              {{ link.label }}
            </a>
          }
        </div>

        <!-- Right: bell + avatar -->
        <div class="flex items-center gap-3">
          <button
            class="grid place-items-center w-9 h-9 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            aria-label="Notifications"
            title="Notifications"
          >
            🔔
          </button>
          <button
            (click)="logout()"
            class="grid place-items-center w-9 h-9 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
            [title]="userName + ' — click to log out'"
          >
            {{ initials }}
          </button>
        </div>
      </nav>
    </header>
  `,
})
export class NavbarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly links = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Jobs', path: '/jobs' },
    { label: 'Alerts', path: '/alerts' },
    { label: 'Preferences', path: '/preferences' },
  ];

  get userName(): string {
    return this.auth.getCurrentUser()?.fullName ?? 'JobPing User';
  }

  get initials(): string {
    const name = this.auth.getCurrentUser()?.fullName?.trim();
    if (!name) return 'JP';
    const parts = name.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'JP';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
