import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { IconComponent } from '../../components/icon/icon.component';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, IconComponent],
  template: `
    <div style="min-height: 100vh; background: var(--bg-page);">
      <header style="height: var(--nav-height); border-bottom: 1px solid var(--border-default);">
        <div style="max-width: 1100px; margin: 0 auto; height: 100%; padding: 0 24px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="topnav-logo-mark">
              <span style="color: white; font-family: var(--font-mono); font-size: 11px; font-weight: 700;">JP</span>
            </span>
            <span style="font-weight: 600; font-size: 15px; color: var(--text-primary);">JobPing</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="icon-btn" (click)="theme.toggle()" [title]="theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
              <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="16" />
            </button>
            <a routerLink="/auth/login" class="btn btn-ghost">Sign in</a>
            <a routerLink="/auth/register" class="btn btn-primary">Get started</a>
          </div>
        </div>
      </header>

      <main style="max-width: 1100px; margin: 0 auto; padding: 72px 24px;">
        <div class="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p style="font-family: var(--font-mono); font-size: 12px; color: var(--accent); margin-bottom: 14px;">
              // developer job alerts, automated
            </p>
            <h1 style="font-size: 44px; line-height: 1.15; font-weight: 700; letter-spacing: -0.02em; color: var(--text-primary);">
              Get pinged for jobs that
              <span style="color: var(--accent);">actually match</span>
              your skills.
            </h1>
            <p style="margin-top: 20px; font-size: 16px; color: var(--text-secondary); max-width: 460px; line-height: 1.6;">
              JobPing scans fresh remote roles every 2 hours, scores them against your skill profile,
              and emails you only the strong matches.
            </p>
            <div style="margin-top: 32px; display: flex; flex-wrap: wrap; gap: 12px;">
              <a routerLink="/auth/register" class="btn btn-primary" style="padding: 10px 20px; font-size: 14px;">
                Create your profile
              </a>
              <a routerLink="/auth/login" class="btn btn-secondary" style="padding: 10px 20px; font-size: 14px;">
                I already have an account
              </a>
            </div>
          </div>

          <div class="hidden lg:block" style="display: flex; flex-direction: column; gap: 12px;">
            <div class="card">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-weight: 600; color: var(--text-primary); font-size: 14px;">Senior .NET Developer</span>
                <span class="match-badge high">92%</span>
              </div>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Techwave · Remote</p>
              <div class="match-bar"><div class="match-bar-fill" style="width: 92%"></div></div>
            </div>
            <div class="card" style="margin-left: 32px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-weight: 600; color: var(--text-primary); font-size: 14px;">Angular Engineer</span>
                <span class="match-badge mid">78%</span>
              </div>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Nimbus · Remote</p>
              <div class="match-bar"><div class="match-bar-fill" style="width: 78%"></div></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
})
export class LandingComponent {
  readonly theme = inject(ThemeService);
}
