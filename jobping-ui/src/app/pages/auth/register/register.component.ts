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
import { Experience, Location, Skill } from '../../../models';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <div class="relative min-h-screen bg-bg-base overflow-hidden">
      <div class="glow-orb w-[420px] h-[420px] -top-24 left-1/3"></div>

      <div class="relative z-10 max-w-2xl mx-auto px-6 py-10">
        <!-- header + stepper -->
        <div class="flex items-center gap-2 mb-8">
          <span class="grid place-items-center w-8 h-8 rounded-md bg-accent-muted border border-accent-border">
            <span class="text-accent-light font-mono text-sm">JP</span>
          </span>
          <span class="text-gradient font-bold text-lg">JobPing</span>
        </div>

        <div class="flex items-center gap-2 mb-10">
          @for (s of steps; track s; let i = $index) {
            <div class="flex-1 h-1.5 rounded-full transition-colors"
                 [class.bg-accent]="i <= step()"
                 [class.bg-bg-elevated]="i > step()"></div>
          }
        </div>

        <p class="font-mono text-sm text-accent-light mb-1">
          Step {{ step() + 1 }} / 4 — {{ steps[step()] }}
        </p>

        <!-- ================= STEP 0: ACCOUNT ================= -->
        @if (step() === 0) {
          <div class="fade-up">
            <h2 class="text-2xl font-bold text-text-primary mb-6">Create your account</h2>

            <div class="grid grid-cols-2 gap-3 mb-6">
              <button type="button" disabled matTooltip="Coming soon"
                class="py-2.5 rounded-md border border-border-default text-text-muted text-sm cursor-not-allowed opacity-60">Google</button>
              <button type="button" disabled matTooltip="Coming soon"
                class="py-2.5 rounded-md border border-border-default text-text-muted text-sm cursor-not-allowed opacity-60">GitHub</button>
            </div>

            <form [formGroup]="accountForm" (ngSubmit)="createAccount()" class="space-y-4">
              <div>
                <label class="block text-sm text-text-secondary mb-1.5">Full name</label>
                <input class="jp-input" formControlName="fullName" placeholder="Ada Lovelace" />
              </div>
              <div>
                <label class="block text-sm text-text-secondary mb-1.5">Username</label>
                <input class="jp-input" formControlName="username" placeholder="ada" />
              </div>
              <div>
                <label class="block text-sm text-text-secondary mb-1.5">Email</label>
                <input class="jp-input" type="email" formControlName="email" placeholder="ada@example.com" />
              </div>
              <div>
                <label class="block text-sm text-text-secondary mb-1.5">Password</label>
                <input class="jp-input" type="password" formControlName="password" placeholder="At least 8 characters" />
                @if (accountForm.controls.password.touched && accountForm.controls.password.invalid) {
                  <p class="text-xs text-error mt-1">Password must be at least 8 characters.</p>
                }
              </div>

              <button type="submit" [disabled]="loading() || accountForm.invalid"
                class="w-full py-3 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                @if (loading()) { <mat-progress-spinner diameter="20" mode="indeterminate" /> } @else { Create account }
              </button>
            </form>

            <p class="text-sm text-text-secondary mt-6 text-center">
              Already have an account?
              <a routerLink="/auth/login" class="text-accent-light hover:underline">Sign in</a>
            </p>
          </div>
        }

        <!-- ================= STEP 1: SKILLS ================= -->
        @if (step() === 1) {
          <div class="fade-up">
            <h2 class="text-2xl font-bold text-text-primary mb-2">Pick your skills</h2>
            <p class="text-text-secondary mb-6">We match jobs against these.</p>

            @if (loadingSkills()) {
              <div class="flex justify-center py-10"><mat-progress-spinner diameter="36" mode="indeterminate" /></div>
            } @else {
              <div class="flex flex-wrap gap-2.5">
                @for (skill of skills(); track skill.id) {
                  <button type="button" (click)="toggleSkill(skill.id)"
                    class="chip" [class.chip-active]="selectedSkills().includes(skill.id)">
                    {{ skill.name }}
                  </button>
                }
              </div>
              <p class="text-xs text-text-muted mt-4">{{ selectedSkills().length }} selected</p>
            }

            <div class="flex justify-between mt-10">
              <button type="button" (click)="back()" class="px-5 py-2.5 rounded-md border border-border-default text-text-primary hover:border-border-strong transition-colors">Back</button>
              <button type="button" (click)="next()" [disabled]="selectedSkills().length === 0"
                class="px-6 py-2.5 rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Continue</button>
            </div>
          </div>
        }

        <!-- ================= STEP 2: PREFERENCES ================= -->
        @if (step() === 2) {
          <div class="fade-up">
            <h2 class="text-2xl font-bold text-text-primary mb-6">Your preferences</h2>

            @if (loadingMeta()) {
              <div class="flex justify-center py-10"><mat-progress-spinner diameter="36" mode="indeterminate" /></div>
            } @else {
              <div class="space-y-7" [formGroup]="prefForm">
                <div>
                  <label class="block text-sm text-text-secondary mb-2">Preferred locations</label>
                  <div class="flex flex-wrap gap-2.5">
                    @for (loc of locations(); track loc.id) {
                      <button type="button" (click)="toggleLocation(loc.id)"
                        class="chip" [class.chip-active]="selectedLocations().includes(loc.id)">{{ loc.name }}</button>
                    }
                  </div>
                </div>

                <div>
                  <label class="block text-sm text-text-secondary mb-2">Experience</label>
                  <div class="flex flex-wrap gap-2.5">
                    @for (exp of experiences(); track exp.id) {
                      <button type="button" (click)="selectedExperienceId.set(exp.id)"
                        class="chip" [class.chip-active]="selectedExperienceId() === exp.id">{{ exp.name }}</button>
                    }
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm text-text-secondary mb-1.5">Min salary</label>
                    <input class="jp-input" type="number" formControlName="minSalary" placeholder="0" />
                  </div>
                  <div>
                    <label class="block text-sm text-text-secondary mb-1.5">Max salary</label>
                    <input class="jp-input" type="number" formControlName="maxSalary" placeholder="200000" />
                  </div>
                </div>

                <div>
                  <label class="block text-sm text-text-secondary mb-2">Minimum match %</label>
                  <div class="flex flex-wrap gap-2.5">
                    @for (pct of matchOptions; track pct) {
                      <button type="button" (click)="prefForm.controls.minMatchPercentage.setValue(pct)"
                        class="chip" [class.chip-active]="prefForm.controls.minMatchPercentage.value === pct">{{ pct }}%</button>
                    }
                  </div>
                </div>
              </div>
            }

            <div class="flex justify-between mt-10">
              <button type="button" (click)="back()" class="px-5 py-2.5 rounded-md border border-border-default text-text-primary hover:border-border-strong transition-colors">Back</button>
              <button type="button" (click)="next()" class="px-6 py-2.5 rounded-md bg-accent text-white hover:bg-accent-hover transition-colors">Continue</button>
            </div>
          </div>
        }

        <!-- ================= STEP 3: NOTIFICATIONS ================= -->
        @if (step() === 3) {
          <div class="fade-up">
            <h2 class="text-2xl font-bold text-text-primary mb-2">Alert frequency</h2>
            <p class="text-text-secondary mb-6">How often should we email you matches?</p>

            <div class="grid sm:grid-cols-3 gap-3">
              @for (f of frequencies; track f) {
                <button type="button" (click)="alertFrequency.set(f)"
                  class="p-5 rounded-lg border text-left transition-colors"
                  [class.border-accent-border]="alertFrequency() === f"
                  [class.bg-accent-muted]="alertFrequency() === f"
                  [class.border-border-default]="alertFrequency() !== f"
                  [class.bg-bg-surface]="alertFrequency() !== f">
                  <span class="block font-semibold"
                        [class.text-accent-light]="alertFrequency() === f"
                        [class.text-text-primary]="alertFrequency() !== f">{{ f }}</span>
                  <span class="block text-xs text-text-muted mt-1">{{ frequencyHint(f) }}</span>
                </button>
              }
            </div>

            <div class="flex justify-between mt-10">
              <button type="button" (click)="back()" class="px-5 py-2.5 rounded-md border border-border-default text-text-primary hover:border-border-strong transition-colors">Back</button>
              <button type="button" (click)="finish()" [disabled]="loading()"
                class="px-6 py-2.5 rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2">
                @if (loading()) { <mat-progress-spinner diameter="20" mode="indeterminate" /> } @else { Finish setup }
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
        this.snack.open('Account created 🎉', 'OK', { duration: 2500, panelClass: 'jp-snack-success' });
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
