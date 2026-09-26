import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../services/auth.service';
import { ThemeService } from '../../../services/theme.service';
import { IconComponent } from '../../../components/icon/icon.component';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, MatProgressSpinnerModule, MatTooltipModule, IconComponent],
  template: `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--bg-page); position: relative;">
      <button
        class="icon-btn"
        (click)="theme.toggle()"
        style="position: absolute; top: 16px; right: 16px;"
        [title]="theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      >
        <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="16" />
      </button>

      <div style="width: 100%; max-width: 380px;">
        <div style="display: flex; align-items: center; gap: 8px; justify-content: center; margin-bottom: 24px;">
          <span class="topnav-logo-mark">
            <span style="color: white; font-family: var(--font-mono); font-size: 11px; font-weight: 700;">JP</span>
          </span>
          <span style="font-weight: 600; font-size: 15px; color: var(--text-primary);">JobPing</span>
        </div>

        <div class="card">
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
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);

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
