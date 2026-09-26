import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppLayoutComponent } from '../../components/app-layout/app-layout.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { IconComponent } from '../../components/icon/icon.component';
import { PreferenceService } from '../../services/preference.service';
import { AlertService } from '../../services/alert.service';
import { AlertHistoryItem } from '../../models';
import { timeAgo } from '../../utils/time-ago';

@Component({
  selector: 'app-alerts',
  imports: [RouterLink, AppLayoutComponent, EmptyStateComponent, LoadingSkeletonComponent, IconComponent],
  template: `
    <app-layout>
      <div class="page-header">
        <h1 class="page-title">Email Alerts</h1>
      </div>

      @if (loadingSettings()) {
        <app-loading-skeleton type="stat-card" />
      } @else {
        <div class="card" style="max-width: 440px; margin-bottom: 32px;">
          <p style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
            Alert settings
          </p>
          <div class="settings-row">
            <span class="settings-key">Email notifications</span>
            <button class="toggle" [class.on]="emailNotification()" (click)="toggleEmail()" type="button">
              <span class="toggle-thumb"></span>
            </button>
          </div>
          <div class="settings-row">
            <span class="settings-key">Minimum match %</span>
            <span class="settings-val">{{ minMatchPercentage() }}%</span>
          </div>
          <div class="settings-row">
            <span class="settings-key">Alert frequency</span>
            <span class="settings-val">Instant</span>
          </div>
          <a routerLink="/preferences" class="view-all" style="margin-top: 8px;">
            Edit in Preferences <app-icon name="chevron-right" [size]="12" />
          </a>
        </div>
      }

      <div class="section-header">
        <h2 class="section-title">Alert history</h2>
      </div>

      @if (loadingAlerts()) {
        <div class="job-list">
          @for (i of [1, 2, 3]; track i) {
            <app-loading-skeleton type="job-card" />
          }
        </div>
      } @else if (alerts().length === 0) {
        <app-empty-state
          title="No alerts sent yet"
          description="Set your preferences and check back — history shows up here once a matching job triggers an alert."
          actionLabel="Set preferences"
          actionRoute="/preferences"
        >
          <app-icon icon name="inbox" [size]="20" />
        </app-empty-state>
      } @else {
        <div>
          @for (alert of alerts(); track alert.id) {
            <div class="alert-row">
              <div>
                <a [routerLink]="['/jobs', alert.jobId]" style="font-size: 13px; font-weight: 600; color: var(--text-primary); text-decoration: none;">
                  {{ alert.jobTitle }}
                </a>
                <div class="alert-meta">
                  <span>{{ alert.company }}</span>
                  <span class="job-meta-dot"></span>
                  <span>{{ ago(alert.sentAt) }}</span>
                </div>
              </div>
              <span class="tag" [class.accent]="alert.status === 'Sent'" [style.color]="alert.status === 'Failed' ? 'var(--error)' : undefined">
                {{ alert.status }}
              </span>
            </div>
          }
        </div>
      }
    </app-layout>
  `,
})
export class AlertsComponent implements OnInit {
  private readonly preferenceService = inject(PreferenceService);
  private readonly alertService = inject(AlertService);

  readonly loadingSettings = signal(true);
  readonly emailNotification = signal(true);
  readonly minMatchPercentage = signal(50);

  readonly loadingAlerts = signal(true);
  readonly alerts = signal<AlertHistoryItem[]>([]);

  ngOnInit(): void {
    this.preferenceService.getPreferences().subscribe({
      next: (prefs) => {
        this.emailNotification.set(prefs.isEmailNotification);
        this.minMatchPercentage.set(prefs.minMatchPercentage ?? 50);
        this.loadingSettings.set(false);
      },
      error: () => this.loadingSettings.set(false),
    });

    this.alertService.getAlerts().subscribe({
      next: (alerts) => {
        this.alerts.set(alerts);
        this.loadingAlerts.set(false);
      },
      error: () => this.loadingAlerts.set(false),
    });
  }

  toggleEmail(): void {
    const prev = this.emailNotification();
    this.emailNotification.set(!prev);
    this.preferenceService.getPreferences().subscribe((prefs) => {
      this.preferenceService
        .updatePreferences({ ...prefs, isEmailNotification: !prev })
        .subscribe({ error: () => this.emailNotification.set(prev) });
    });
  }

  ago(iso: string): string {
    return timeAgo(iso);
  }
}
