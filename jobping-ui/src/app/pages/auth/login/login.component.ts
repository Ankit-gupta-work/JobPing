import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../services/auth.service';
import { ThemeService } from '../../../services/theme.service';
import { IconComponent } from '../../../components/icon/icon.component';

const FACTS = [
  { icon: 'refresh-cw' as const, text: 'New roles pulled in every 2 hours, automatically' },
  { icon: 'target' as const, text: 'Every job is scored against your actual skill profile' },
  { icon: 'mail' as const, text: 'Only alerted when a job clears your match threshold' },
];

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, MatProgressSpinnerModule, MatTooltipModule, IconComponent],
  template: `
    <div class="auth-shell">
      <div class="auth-glow auth-glow-a"></div>
      <div class="auth-glow auth-glow-b"></div>

      <button
        class="icon-btn"
        (click)="theme.toggle()"
        style="position: absolute; top: 16px; right: 16px; z-index: 2;"
        [title]="theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      >
        <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="16" />
      </button>

      <div class="auth-panel">
        <div class="auth-panel-inner">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span class="topnav-logo-mark">
              <span style="color: white; font-family: var(--font-mono); font-size: 11px; font-weight: 700;">JP</span>
            </span>
            <span style="font-weight: 600; font-size: 15px; color: white;">JobPing</span>
          </div>
          <h2 class="auth-panel-heading">Jobs that actually match your skills — pinged straight to your inbox.</h2>
          <div class="auth-panel-facts">
            @for (f of facts; track f.text) {
              <div class="auth-panel-fact">
                <app-icon [name]="f.icon" [size]="15" />
                <span>{{ f.text }}</span>
              </div>
            }
          </div>

          <div class="card auth-preview-card">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-weight: 600; color: var(--text-primary); font-size: 14px;">Senior .NET Developer</span>
              <span class="match-badge high">92%</span>
            </div>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Techwave · Remote</p>
            <div class="match-bar"><div class="match-bar-fill" style="width: 92%"></div></div>
          </div>
        </div>
      </div>

      <div class="auth-form-side">
        <div class="auth-card-wrap">
          <div class="auth-logo-mobile">
            <span class="topnav-logo-mark">
              <span style="color: white; font-family: var(--font-mono); font-size: 11px; font-weight: 700;">JP</span>
            </span>
            <span style="font-weight: 600; font-size: 15px; color: var(--text-primary);">JobPing</span>
          </div>

          <div class="card auth-card">
            <h2 style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px;">Sign in</h2>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">Welcome back to JobPing.</p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
              <button type="button" disabled matTooltip="Coming soon" class="btn btn-secondary" style="justify-content: center;">
                Google
              </button>
              <button type="button" disabled matTooltip="Coming soon" class="btn btn-secondary" style="justify-content: center;">
                GitHub
              </button>
            </div>

            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
              <span style="height: 1px; flex: 1; background: var(--border-default);"></span>
              <span style="font-size: 11px; color: var(--text-muted);">or with email</span>
              <span style="height: 1px; flex: 1; background: var(--border-default);"></span>
            </div>

            <form [formGroup]="form" (ngSubmit)="submit()" style="display: flex; flex-direction: column; gap: 14px;">
              <div>
                <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Email</label>
                <input class="jp-input" type="email" formControlName="email" placeholder="you@example.com" />
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Password</label>
                <input class="jp-input" type="password" formControlName="password" placeholder="••••••••" />
              </div>

              @if (errorMessage()) {
                <p style="font-size: 13px; color: var(--error);">{{ errorMessage() }}</p>
              }

              <button
                type="submit"
                [disabled]="loading() || form.invalid"
                class="btn btn-primary"
                style="justify-content: center; padding: 10px 14px;"
              >
                @if (loading()) {
                  <mat-progress-spinner diameter="16" mode="indeterminate" />
                } @else {
                  Sign in
                }
              </button>
            </form>
          </div>

          <p style="font-size: 13px; color: var(--text-secondary); margin-top: 16px; text-align: center;">
            No account?
            <a routerLink="/auth/register" style="color: var(--accent); text-decoration: none;">Create one</a>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1fr;
      background: var(--bg-page);
      position: relative;
      overflow: hidden;
    }
    @media (min-width: 1024px) {
      .auth-shell { grid-template-columns: 1fr 1fr; }
    }

    .auth-glow { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; opacity: 0.4; z-index: 0; }
    .auth-glow-a { width: 420px; height: 420px; top: -160px; left: -120px; background: radial-gradient(circle, var(--accent-light), transparent 70%); }
    .auth-glow-b { width: 360px; height: 360px; bottom: -140px; right: -100px; background: radial-gradient(circle, var(--accent), transparent 70%); opacity: 0.25; }
    [data-theme="dark"] .auth-glow { opacity: 0.2; }

    .auth-panel {
      display: none;
      position: relative;
      background: linear-gradient(160deg, var(--accent), var(--accent-hover) 65%, #3b1372);
      padding: 48px;
      align-items: center;
      overflow: hidden;
    }
    @media (min-width: 1024px) { .auth-panel { display: flex; } }
    .auth-panel::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(circle at 80% 15%, rgba(255,255,255,0.16), transparent 55%);
      pointer-events: none;
    }
    .auth-panel-inner { position: relative; z-index: 1; max-width: 400px; animation: authPanelIn 0.6s var(--ease-out) both; }
    .auth-panel-heading { font-size: 26px; font-weight: 700; color: white; line-height: 1.35; letter-spacing: -0.01em; margin: 20px 0 24px; }
    .auth-panel-facts { display: flex; flex-direction: column; gap: 12px; margin-bottom: 28px; }
    .auth-panel-fact { display: flex; align-items: center; gap: 10px; font-size: 13px; color: rgba(255,255,255,0.9); }
    .auth-panel-fact app-icon { color: rgba(255,255,255,0.75); flex-shrink: 0; }
    .auth-preview-card { max-width: 300px; box-shadow: var(--shadow-lg); animation: cardFloat 6s ease-in-out infinite; }

    @keyframes authPanelIn {
      from { opacity: 0; transform: translateX(-16px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes cardFloat {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-8px); }
    }

    .auth-form-side {
      position: relative; z-index: 1;
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
    }
    .auth-card-wrap { width: 100%; max-width: 380px; animation: authCardIn 0.5s var(--ease-out) both; }
    .auth-card { box-shadow: var(--shadow-md); }
    .auth-logo-mobile { display: flex; align-items: center; gap: 8px; justify-content: center; margin-bottom: 24px; }
    @media (min-width: 1024px) { .auth-logo-mobile { display: none; } }

    @keyframes authCardIn {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .auth-panel-inner, .auth-card-wrap, .auth-preview-card { opacity: 1; animation: none; }
    }
  `],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly facts = FACTS;

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.message ?? 'Invalid email or password.');
      },
    });
  }
}
