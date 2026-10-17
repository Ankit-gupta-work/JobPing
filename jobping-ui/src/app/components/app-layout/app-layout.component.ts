import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { NotificationDropdownComponent } from '../notification-dropdown/notification-dropdown.component';
import { IconComponent, IconName } from '../icon/icon.component';
import { CommandPaletteComponent } from '../command-palette/command-palette.component';

interface NavItem {
  label: string;
  path: string;
  icon: IconName;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'home' },
  { label: 'Jobs', path: '/jobs', icon: 'briefcase' },
  { label: 'Saved', path: '/saved', icon: 'bookmark' },
  { label: 'Alerts', path: '/alerts', icon: 'bell' },
  { label: 'Preferences', path: '/preferences', icon: 'sliders-horizontal' },
  { label: 'Profile', path: '/profile', icon: 'user' },
];

@Component({
  selector: 'app-layout',
  imports: [RouterLink, RouterLinkActive, NotificationDropdownComponent, IconComponent, CommandPaletteComponent],
  template: `
    <div class="app-shell">
      <header class="topnav">
        <a routerLink="/dashboard" class="topnav-logo">
          <span class="topnav-logo-mark">
            <span style="color:white; font-family:var(--font-mono); font-size:11px; font-weight:700;">JP</span>
          </span>
          <span class="hidden sm:inline">JobPing</span>
        </a>

        <div class="topnav-search" (click)="palette.show()">
          <app-icon name="search" [size]="14" />
          Search pages or actions…
          <span class="kbd">⌘K</span>
        </div>
        <button class="icon-btn topnav-search-btn" (click)="palette.show()" aria-label="Search">
          <app-icon name="search" [size]="16" />
        </button>

        <div class="topnav-actions">
          <app-notification-dropdown />
          <button
            class="icon-btn"
            (click)="theme.toggle()"
            [title]="theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="16" />
          </button>
          <a routerLink="/profile" class="avatar" [title]="userName">{{ initials }}</a>
          <button class="icon-btn" (click)="logout()" title="Log out" aria-label="Log out">
            <app-icon name="log-out" [size]="16" />
          </button>
        </div>
      </header>

      <div class="shell-body">
        <aside class="sidebar">
          <div class="sidebar-section">
            @for (item of navItems; track item.path) {
              <a [routerLink]="item.path" routerLinkActive="active" class="sidebar-link" [attr.data-label]="item.label">
                <app-icon [name]="item.icon" [size]="15" />
                <span class="link-label">{{ item.label }}</span>
              </a>
            }
          </div>
        </aside>

        <main class="main-content">
          <ng-content />
        </main>
      </div>

      <nav class="bottom-bar">
        @for (item of navItems.slice(0, 5); track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active" class="bottom-tab">
            <app-icon [name]="item.icon" [size]="20" />
            <span>{{ item.label === 'Preferences' ? 'More' : item.label }}</span>
          </a>
        }
      </nav>

      <app-command-palette #palette />
    </div>
  `,
})
export class AppLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);

  readonly navItems = NAV_ITEMS;

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
