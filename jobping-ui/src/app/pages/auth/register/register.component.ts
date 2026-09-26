import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../services/auth.service';
import { MasterDataService } from '../../../services/master-data.service';
import { PreferenceService } from '../../../services/preference.service';
import { ThemeService } from '../../../services/theme.service';
import { IconComponent } from '../../../components/icon/icon.component';
import { Experience, Location, Skill } from '../../../models';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, MatProgressSpinnerModule, MatTooltipModule, IconComponent],
  template: `
    <div style="min-height: 100vh; background: var(--bg-page); position: relative;">
      <button
        class="icon-btn"
        (click)="theme.toggle()"
        style="position: absolute; top: 16px; right: 16px;"
        [title]="theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      >
        <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="16" />
      </button>

      <div style="max-width: 560px; margin: 0 auto; padding: 40px 24px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 32px;">
          <span class="topnav-logo-mark">
            <span style="color: white; font-family: var(--font-mono); font-size: 11px; font-weight: 700;">JP</span>
          </span>
          <span style="font-weight: 600; font-size: 15px; color: var(--text-primary);">JobPing</span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px;">
          @for (s of steps; track s; let i = $index) {
            <div
              style="flex: 1; height: 4px; border-radius: 99px; transition: background 150ms;"
              [style.background]="i <= step() ? 'var(--accent)' : 'var(--bg-elevated)'"
            ></div>
          }
        </div>

        <p style="font-family: var(--font-mono); font-size: 12px; color: var(--accent); margin-bottom: 4px;">
          Step {{ step() + 1 }} / 4 — {{ steps[step()] }}
        </p>

        <!-- ================= STEP 0: ACCOUNT ================= -->
        @if (step() === 0) {
          <div>
            <h2 style="font-size: 20px; font-weight: 600; color: var(--text-primary); margin: 8px 0 20px;">Create your account</h2>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
              <button type="button" disabled matTooltip="Coming soon" class="btn btn-secondary" style="justify-content: center;">Google</button>
              <button type="button" disabled matTooltip="Coming soon" class="btn btn-secondary" style="justify-content: center;">GitHub</button>
            </div>

            <form [formGroup]="accountForm" (ngSubmit)="createAccount()" style="display: flex; flex-direction: column; gap: 14px;">
              <div>
                <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Full name</label>
                <input class="jp-input" formControlName="fullName" placeholder="Ada Lovelace" />
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Username</label>
                <input class="jp-input" formControlName="username" placeholder="ada" />
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Email</label>
                <input class="jp-input" type="email" formControlName="email" placeholder="ada@example.com" />
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Password</label>
                <input class="jp-input" type="password" formControlName="password" placeholder="At least 8 characters" />
                @if (accountForm.controls.password.touched && accountForm.controls.password.invalid) {
                  <p style="font-size: 11px; color: var(--error); margin-top: 4px;">Password must be at least 8 characters.</p>
                }
              </div>

              <button
                type="submit"
                [disabled]="loading() || accountForm.invalid"
                class="btn btn-primary"
                style="justify-content: center; padding: 10px 14px; margin-top: 4px;"
              >
                @if (loading()) { <mat-progress-spinner diameter="16" mode="indeterminate" /> } @else { Create account }
              </button>
            </form>

            <p style="font-size: 13px; color: var(--text-secondary); margin-top: 20px; text-align: center;">
              Already have an account?
              <a routerLink="/auth/login" style="color: var(--accent); text-decoration: none;">Sign in</a>
            </p>
          </div>
        }

        <!-- ================= STEP 1: SKILLS ================= -->
        @if (step() === 1) {
          <div>
            <h2 style="font-size: 20px; font-weight: 600; color: var(--text-primary); margin: 8px 0 2px;">Pick your skills</h2>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">We match jobs against these.</p>

            @if (loadingSkills()) {
              <div style="display: flex; justify-content: center; padding: 40px 0;"><mat-progress-spinner diameter="32" mode="indeterminate" /></div>
            } @else {
              <div class="filter-chips">
                @for (skill of skills(); track skill.id) {
                  <button type="button" (click)="toggleSkill(skill.id)" class="filter-chip" [class.active]="selectedSkills().includes(skill.id)">
                    {{ skill.name }}
                  </button>
                }
              </div>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 14px;">{{ selectedSkills().length }} selected</p>
            }

            <div style="display: flex; justify-content: space-between; margin-top: 32px;">
              <button type="button" (click)="back()" class="btn btn-secondary">Back</button>
              <button type="button" (click)="next()" [disabled]="selectedSkills().length === 0" class="btn btn-primary">Continue</button>
            </div>
          </div>
        }

        <!-- ================= STEP 2: PREFERENCES ================= -->
        @if (step() === 2) {
          <div>
            <h2 style="font-size: 20px; font-weight: 600; color: var(--text-primary); margin: 8px 0 20px;">Your preferences</h2>

            @if (loadingMeta()) {
              <div style="display: flex; justify-content: center; padding: 40px 0;"><mat-progress-spinner diameter="32" mode="indeterminate" /></div>
            } @else {
              <div style="display: flex; flex-direction: column; gap: 24px;" [formGroup]="prefForm">
                <div>
                  <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Preferred locations</label>
                  <div class="filter-chips">
                    @for (loc of locations(); track loc.id) {
                      <button type="button" (click)="toggleLocation(loc.id)" class="filter-chip" [class.active]="selectedLocations().includes(loc.id)">
                        {{ loc.name }}
                      </button>
                    }
                  </div>
                </div>

                <div>
                  <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Experience</label>
                  <div class="filter-chips">
                    @for (exp of experiences(); track exp.id) {
                      <button type="button" (click)="selectedExperienceId.set(exp.id)" class="filter-chip" [class.active]="selectedExperienceId() === exp.id">
                        {{ exp.name }}
                      </button>
                    }
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Min salary</label>
                    <input class="jp-input" type="number" formControlName="minSalary" placeholder="0" />
                  </div>
                  <div>
                    <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Max salary</label>
                    <input class="jp-input" type="number" formControlName="maxSalary" placeholder="200000" />
                  </div>
                </div>

                <div>
                  <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Minimum match %</label>
                  <div class="filter-chips">
                    @for (pct of matchOptions; track pct) {
                      <button
                        type="button"
                        (click)="prefForm.controls.minMatchPercentage.setValue(pct)"
                        class="filter-chip"
                        [class.active]="prefForm.controls.minMatchPercentage.value === pct"
                      >
                        {{ pct }}%
                      </button>
                    }
                  </div>
                </div>
              </div>
            }

            <div style="display: flex; justify-content: space-between; margin-top: 32px;">
              <button type="button" (click)="back()" class="btn btn-secondary">Back</button>
              <button type="button" (click)="next()" class="btn btn-primary">Continue</button>
            </div>
          </div>
        }

        <!-- ================= STEP 3: NOTIFICATIONS ================= -->
        @if (step() === 3) {
          <div>
            <h2 style="font-size: 20px; font-weight: 600; color: var(--text-primary); margin: 8px 0 2px;">Alert frequency</h2>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">How often should we email you matches?</p>

            <div class="grid sm:grid-cols-3 gap-3">
              @for (f of frequencies; track f) {
                <button
                  type="button"
                  (click)="alertFrequency.set(f)"
                  class="card"
                  style="text-align: left; cursor: pointer; border-width: 1px;"
                  [style.borderColor]="alertFrequency() === f ? 'var(--accent-border)' : 'var(--border-default)'"
                  [style.background]="alertFrequency() === f ? 'var(--accent-soft)' : 'var(--bg-surface)'"
                >
                  <span
                    style="display: block; font-weight: 600; font-size: 13px;"
                    [style.color]="alertFrequency() === f ? 'var(--accent-text)' : 'var(--text-primary)'"
                  >
                    {{ f }}
                  </span>
                  <span style="display: block; font-size: 11px; color: var(--text-muted); margin-top: 4px;">{{ frequencyHint(f) }}</span>
                </button>
              }
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 32px;">
              <button type="button" (click)="back()" class="btn btn-secondary">Back</button>
              <button type="button" (click)="finish()" [disabled]="loading()" class="btn btn-primary">
                @if (loading()) { <mat-progress-spinner diameter="16" mode="indeterminate" /> } @else { Finish setup }
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly masterData = inject(MasterDataService);
  private readonly preferences = inject(PreferenceService);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  readonly theme = inject(ThemeService);

  readonly steps = ['Account', 'Skills', 'Preferences', 'Notifications'];
  readonly matchOptions = [50, 60, 70, 80, 90];
  readonly frequencies = ['Instant', 'Daily', 'Weekly'];

  readonly step = signal(0);
  readonly loading = signal(false);
  readonly loadingSkills = signal(false);
  readonly loadingMeta = signal(false);

  readonly skills = signal<Skill[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly experiences = signal<Experience[]>([]);

  readonly selectedSkills = signal<number[]>([]);
  readonly selectedLocations = signal<number[]>([]);
  readonly selectedExperienceId = signal<number | null>(null);
  readonly alertFrequency = signal<string>('Instant');

  readonly accountForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly prefForm = this.fb.nonNullable.group({
    minSalary: [null as number | null],
    maxSalary: [null as number | null],
    minMatchPercentage: [50],
  });

  ngOnInit(): void {
    // nothing eager — data loads as steps open
  }

  // ----- Step 0 -----
  createAccount(): void {
    if (this.accountForm.invalid || this.loading()) return;
    this.loading.set(true);

    this.auth.register(this.accountForm.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        this.snack.open('Account created.', 'OK', { duration: 2500, panelClass: 'jp-snack-success' });
        this.goToSkills();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.snack.open(err.error?.message ?? 'Registration failed.', 'Dismiss', {
          duration: 4000,
          panelClass: 'jp-snack-error',
        });
      },
    });
  }

  private goToSkills(): void {
    this.step.set(1);
    if (this.skills().length === 0) {
      this.loadingSkills.set(true);
      this.masterData.getSkills().subscribe({
        next: (s) => {
          this.skills.set(s);
          this.loadingSkills.set(false);
        },
        error: () => {
          this.loadingSkills.set(false);
          this.snack.open('Could not load skills.', 'Dismiss', { duration: 4000, panelClass: 'jp-snack-error' });
        },
      });
    }
  }

  // ----- navigation -----
  next(): void {
    if (this.step() === 1) {
      this.step.set(2);
      this.loadMeta();
    } else if (this.step() < 3) {
      this.step.update((s) => s + 1);
    }
  }

  back(): void {
    this.step.update((s) => Math.max(0, s - 1));
  }

  private loadMeta(): void {
    if (this.locations().length && this.experiences().length) return;
    this.loadingMeta.set(true);
    let pending = 2;
    const done = () => { if (--pending === 0) this.loadingMeta.set(false); };

    this.masterData.getLocations().subscribe({
      next: (l) => { this.locations.set(l); done(); },
      error: () => { done(); this.snack.open('Could not load locations.', 'Dismiss', { duration: 4000, panelClass: 'jp-snack-error' }); },
    });
    this.masterData.getExperiences().subscribe({
      next: (e) => { this.experiences.set(e); done(); },
      error: () => { done(); this.snack.open('Could not load experiences.', 'Dismiss', { duration: 4000, panelClass: 'jp-snack-error' }); },
    });
  }

  // ----- selection helpers -----
  toggleSkill(id: number): void {
    this.selectedSkills.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }
  toggleLocation(id: number): void {
    this.selectedLocations.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  frequencyHint(f: string): string {
    return f === 'Instant' ? 'As soon as a match appears'
      : f === 'Daily' ? 'One digest each morning'
      : 'A weekly round-up';
  }

  // ----- Step 3 -----
  finish(): void {
    if (this.loading()) return;
    this.loading.set(true);

    const pref = this.prefForm.getRawValue();
    this.preferences
      .updatePreferences({
        experienceId: this.selectedExperienceId(),
        isRemoteOnly: false,
        minSalary: pref.minSalary,
        maxSalary: pref.maxSalary,
        minMatchPercentage: pref.minMatchPercentage,
        isEmailNotification: true,
        skillIds: this.selectedSkills(),
        locationIds: this.selectedLocations(),
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.snack.open('You are all set!', 'OK', { duration: 2500, panelClass: 'jp-snack-success' });
          this.router.navigate(['/dashboard']);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.snack.open(err.error?.message ?? 'Could not save preferences.', 'Dismiss', {
            duration: 4000,
            panelClass: 'jp-snack-error',
          });
        },
      });
  }
}
