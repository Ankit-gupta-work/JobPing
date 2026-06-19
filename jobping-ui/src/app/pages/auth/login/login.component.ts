import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <div class="min-h-screen grid lg:grid-cols-2 bg-bg-base">
      <!-- Left panel -->
      <div class="relative hidden lg:flex flex-col justify-center px-16 overflow-hidden border-r border-border-subtle">
        <div class="glow-orb w-[460px] h-[460px] -top-10 -left-20"></div>
        <div class="relative z-10 max-w-md">
          <p class="font-mono text-sm text-accent-light mb-4">// welcome back</p>
          <h1 class="text-4xl font-extrabold text-text-primary leading-tight">
            Your next role is <span class="text-gradient">already waiting</span>.
          </h1>
          <p class="mt-5 text-text-secondary">
            Sign in to see fresh matches scored against your skills.
          </p>

          <div class="float mt-12 w-80 p-5 rounded-lg bg-bg-surface border border-border-default shadow-glow">
            <div class="flex items-center justify-between">
              <span class="text-text-primary font-semibold">Backend Engineer</span>
              <span class="text-accent-light font-mono text-sm">90%</span>
            </div>
            <p class="text-text-muted text-sm mt-1">Orbit Labs • Remote</p>
            <div class="match-bar mt-3"><div class="match-bar-fill" style="width:90%"></div></div>
          </div>
        </div>
      </div>

      <!-- Right panel: form -->
      <div class="flex items-center justify-center px-6 py-12">
        <div class="w-full max-w-sm fade-up">
          <h2 class="text-2xl font-bold text-text-primary mb-1">Sign in</h2>
          <p class="text-text-secondary text-sm mb-8">Welcome back to JobPing.</p>

          <!-- social (disabled) -->
          <div class="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              disabled
              matTooltip="Coming soon"
              class="py-2.5 rounded-md border border-border-default text-text-muted text-sm cursor-not-allowed opacity-60"
            >
              Google
            </button>
            <button
              type="button"
              disabled
              matTooltip="Coming soon"
              class="py-2.5 rounded-md border border-border-default text-text-muted text-sm cursor-not-allowed opacity-60"
            >
              GitHub
            </button>
          </div>

          <div class="flex items-center gap-3 mb-6">
            <span class="h-px flex-1 bg-border-subtle"></span>
            <span class="text-xs text-text-muted">or with email</span>
            <span class="h-px flex-1 bg-border-subtle"></span>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
            <div>
              <label class="block text-sm text-text-secondary mb-1.5">Email</label>
              <input class="jp-input" type="email" formControlName="email" placeholder="you@example.com" />
            </div>
            <div>
              <label class="block text-sm text-text-secondary mb-1.5">Password</label>
              <input class="jp-input" type="password" formControlName="password" placeholder="••••••••" />
            </div>

            @if (errorMessage()) {
              <p class="text-sm text-error">{{ errorMessage() }}</p>
            }

            <button
              type="submit"
              [disabled]="loading() || form.invalid"
              class="w-full py-3 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              @if (loading()) {
                <mat-progress-spinner diameter="20" mode="indeterminate" />
              } @else {
                Sign in
              }
            </button>
          </form>

          <p class="text-sm text-text-secondary mt-6 text-center">
            No account?
            <a routerLink="/auth/register" class="text-accent-light hover:underline">Create one</a>
          </p>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

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
