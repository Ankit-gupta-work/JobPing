import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, switchMap, catchError, of } from 'rxjs';
import { AppLayoutComponent } from '../../components/app-layout/app-layout.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { PreferenceService } from '../../services/preference.service';
import { MasterDataService } from '../../services/master-data.service';
import { JobService } from '../../services/job.service';
import { Experience, Location, Skill, UserPreferenceResponse } from '../../models';

type Tab = 'skills' | 'locations' | 'salary' | 'notifications';

const MATCH_OPTIONS = [50, 60, 70, 80, 90];

@Component({
  selector: 'app-preferences',
  imports: [FormsModule, AppLayoutComponent, LoadingSkeletonComponent],
  template: `
    <app-layout>
      <div class="page-header">
        <h1 class="page-title">Preferences</h1>
      </div>

      <div class="tab-bar">
        @for (t of tabs; track t.id) {
          <button class="tab" [class.active]="tab() === t.id" (click)="tab.set(t.id)">{{ t.label }}</button>
        }
      </div>

      @if (loading()) {
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; max-width: 500px;">
          @for (i of [1, 2, 3, 4]; track i) {
            <app-loading-skeleton type="stat-card" />
          }
        </div>
      } @else {
        @if (tab() === 'skills' || tab() === 'locations') {
          @if (previewCount() !== null) {
            <div class="match-preview-banner">
              <span class="match-preview-count">{{ previewLoading() ? '…' : previewCount() }}</span>
              <span class="match-preview-label">matching job{{ previewCount() === 1 ? '' : 's' }} right now</span>
              @if (!previewLoading() && previewDelta() !== null && previewDelta() !== 0) {
                <span class="match-preview-change" [class.up]="previewDelta()! > 0" [class.down]="previewDelta()! < 0">
                  {{ previewDelta()! > 0 ? '+' : '' }}{{ previewDelta() }}
                </span>
              }
            </div>
          }
        }

        @switch (tab()) {
          @case ('skills') {
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">
              Select the skills you want to be matched against. Changes save immediately.
            </p>
            <div class="filter-chips" style="max-width: 640px;">
              @for (skill of allSkills(); track skill.id) {
                <button
                  class="filter-chip"
                  [class.active]="selectedSkillIds().has(skill.id)"
                  (click)="toggleSkill(skill)"
                >
                  {{ skill.name }}
                </button>
              }
            </div>
            <p style="font-size: 12px; color: var(--text-muted); margin-top: 12px;">
              {{ selectedSkillIds().size }} selected
            </p>
          }
          @case ('locations') {
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;">
              Select the locations you'd take a job in. Changes save immediately.
            </p>
            <div class="filter-chips" style="max-width: 640px;">
              @for (loc of allLocations(); track loc.id) {
                <button
                  class="filter-chip"
                  [class.active]="selectedLocationIds().has(loc.id)"
                  (click)="toggleLocation(loc)"
                >
                  {{ loc.name }}
                </button>
              }
            </div>
          }
          @case ('salary') {
            <div style="max-width: 420px; display: flex; flex-direction: column; gap: 20px;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
                    Min salary (LPA)
                  </label>
                  <input type="number" min="0" [(ngModel)]="minSalary" class="jp-input" />
                </div>
                <div>
                  <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
                    Max salary (LPA)
                  </label>
                  <input type="number" min="0" [(ngModel)]="maxSalary" class="jp-input" />
                </div>
              </div>

              <div>
                <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">
                  Experience level
                </label>
                <div class="filter-chips">
                  @for (exp of allExperiences(); track exp.id) {
                    <button
                      class="filter-chip"
                      [class.active]="experienceId() === exp.id"
                      (click)="experienceId.set(exp.id)"
                    >
                      {{ exp.name }}
                    </button>
                  }
                </div>
              </div>

              <div>
                <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">
                  Minimum match %
                </label>
                <div class="filter-chips">
                  @for (pct of matchOptions; track pct) {
                    <button
                      class="filter-chip"
                      [class.active]="minMatchPercentage() === pct"
                      (click)="minMatchPercentage.set(pct)"
                    >
                      {{ pct }}%
                    </button>
                  }
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 12px;">
                <button (click)="saveDetails()" [disabled]="saving()" class="btn btn-primary">
                  {{ saving() ? 'Saving…' : 'Save changes' }}
                </button>
                @if (saved()) {
                  <span style="font-size: 13px; color: var(--success);">Saved.</span>
                }
              </div>
            </div>
          }
          @case ('notifications') {
            <div style="max-width: 420px;">
              <div class="card">
                <div class="settings-row">
                  <span class="settings-key">Email notifications</span>
                  <button class="toggle" [class.on]="isEmailNotification" (click)="isEmailNotification = !isEmailNotification" type="button">
                    <span class="toggle-thumb"></span>
                  </button>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px; margin-top: 16px;">
                <button (click)="saveDetails()" [disabled]="saving()" class="btn btn-primary">
                  {{ saving() ? 'Saving…' : 'Save changes' }}
                </button>
                @if (saved()) {
                  <span style="font-size: 13px; color: var(--success);">Saved.</span>
                }
              </div>
            </div>
          }
        }
      }
    </app-layout>
  `,
})
export class PreferencesComponent implements OnInit {
  private readonly preferenceService = inject(PreferenceService);
  private readonly masterData = inject(MasterDataService);
  private readonly jobService = inject(JobService);

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'skills', label: 'Skills' },
    { id: 'locations', label: 'Locations' },
    { id: 'salary', label: 'Salary & Experience' },
    { id: 'notifications', label: 'Notifications' },
  ];
  readonly matchOptions = MATCH_OPTIONS;

  readonly tab = signal<Tab>('skills');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);

  readonly allSkills = signal<Skill[]>([]);
  readonly allLocations = signal<Location[]>([]);
  readonly allExperiences = signal<Experience[]>([]);

  readonly selectedSkillIds = signal<Set<number>>(new Set());
  readonly selectedLocationIds = signal<Set<number>>(new Set());
  readonly experienceId = signal<number | null>(null);
  readonly minMatchPercentage = signal<number>(50);

  minSalary: number | null = null;
  maxSalary: number | null = null;
  isEmailNotification = true;

  private isRemoteOnly = false;

  readonly previewCount = signal<number | null>(null);
  readonly previewLoading = signal(false);
  readonly previewDelta = signal<number | null>(null);
  private readonly previewTrigger$ = new Subject<void>();

  ngOnInit(): void {
    this.masterData.getSkills().subscribe((s) => this.allSkills.set(s));
    this.masterData.getLocations().subscribe((l) => this.allLocations.set(l));
    this.masterData.getExperiences().subscribe((e) => this.allExperiences.set(e));

    this.preferenceService.getPreferences().subscribe({
      next: (prefs) => {
        this.applyPreferences(prefs);
        this.previewTrigger$.next();
      },
      error: () => this.loading.set(false),
    });

    this.previewTrigger$
      .pipe(
        debounceTime(400),
        switchMap(() => {
          this.previewLoading.set(true);
          return this.jobService.getJobMatches().pipe(catchError(() => of(null)));
        }),
      )
      .subscribe((jobs) => {
        this.previewLoading.set(false);
        if (jobs === null) return;
        const prev = this.previewCount();
        this.previewCount.set(jobs.length);
        this.previewDelta.set(prev === null ? null : jobs.length - prev);
      });
  }

  private applyPreferences(prefs: UserPreferenceResponse): void {
    this.selectedSkillIds.set(new Set(prefs.skillIds));
    this.selectedLocationIds.set(new Set(prefs.locationIds));
    this.experienceId.set(prefs.experienceId);
    this.minMatchPercentage.set(prefs.minMatchPercentage ?? 50);
    this.minSalary = prefs.minSalary;
    this.maxSalary = prefs.maxSalary;
    this.isEmailNotification = prefs.isEmailNotification;
    this.isRemoteOnly = prefs.isRemoteOnly;
    this.loading.set(false);
  }

  toggleSkill(skill: Skill): void {
    const ids = new Set(this.selectedSkillIds());
    const wasSelected = ids.has(skill.id);
    wasSelected ? ids.delete(skill.id) : ids.add(skill.id);
    this.selectedSkillIds.set(ids);

    const call = wasSelected
      ? this.preferenceService.removeSkill(skill.id)
      : this.preferenceService.addSkill(skill.id);
    call.subscribe({
      next: () => this.previewTrigger$.next(),
      error: () => {
        const reverted = new Set(this.selectedSkillIds());
        wasSelected ? reverted.add(skill.id) : reverted.delete(skill.id);
        this.selectedSkillIds.set(reverted);
      },
    });
  }

  toggleLocation(loc: Location): void {
    const ids = new Set(this.selectedLocationIds());
    const wasSelected = ids.has(loc.id);
    wasSelected ? ids.delete(loc.id) : ids.add(loc.id);
    this.selectedLocationIds.set(ids);

    const call = wasSelected
      ? this.preferenceService.removeLocation(loc.id)
      : this.preferenceService.addLocation(loc.id);
    call.subscribe({
      next: () => this.previewTrigger$.next(),
      error: () => {
        const reverted = new Set(this.selectedLocationIds());
        wasSelected ? reverted.add(loc.id) : reverted.delete(loc.id);
        this.selectedLocationIds.set(reverted);
      },
    });
  }

  saveDetails(): void {
    this.saving.set(true);
    this.saved.set(false);
    this.preferenceService
      .updatePreferences({
        experienceId: this.experienceId(),
        isRemoteOnly: this.isRemoteOnly,
        minSalary: this.minSalary,
        maxSalary: this.maxSalary,
        minMatchPercentage: this.minMatchPercentage(),
        isEmailNotification: this.isEmailNotification,
        skillIds: Array.from(this.selectedSkillIds()),
        locationIds: Array.from(this.selectedLocationIds()),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.set(true);
          setTimeout(() => this.saved.set(false), 2500);
        },
        error: () => this.saving.set(false),
      });
  }
}
