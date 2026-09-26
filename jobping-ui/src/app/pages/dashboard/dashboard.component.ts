import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppLayoutComponent } from '../../components/app-layout/app-layout.component';
import { JobCardComponent } from '../../components/job-card/job-card.component';
import { StatCardComponent } from '../../components/stat-card/stat-card.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { IconComponent } from '../../components/icon/icon.component';
import { AuthService } from '../../services/auth.service';
import { JobService } from '../../services/job.service';
import { JobListItem } from '../../models';
import { timeAgo } from '../../utils/time-ago';

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    AppLayoutComponent,
    JobCardComponent,
    StatCardComponent,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    IconComponent,
  ],
  template: `
    <app-layout>
      <div class="page-header">
        <h1 class="page-title">{{ greeting }}{{ firstName ? ', ' + firstName : '' }}.</h1>
        <p class="page-subtitle">Find your next opportunity.</p>
      </div>

      @if (loading()) {
        <div class="stat-grid">
          @for (i of [1, 2, 3, 4]; track i) {
            <app-loading-skeleton type="stat-card" />
          }
        </div>
      } @else {
        <div class="stat-grid">
          <app-stat-card label="New matches" [value]="matches().length" color="accent">
            <app-icon icon name="trending-up" [size]="13" />
          </app-stat-card>
          <app-stat-card label="Jobs indexed" [value]="totalJobs()">
            <app-icon icon name="briefcase" [size]="13" />
          </app-stat-card>
          <app-stat-card label="Alerts sent" value="—" trend="Ships with Step 7">
            <app-icon icon name="mail" [size]="13" />
          </app-stat-card>
          <app-stat-card label="Match rate" value="—" trend="Ships with Step 6">
            <app-icon icon name="bar-chart-2" [size]="13" />
          </app-stat-card>
        </div>

        @if (lastUpdated()) {
          <div class="worker-bar">
            <span class="status-dot pulse"></span>
            Jobs last synced {{ lastUpdated() }}
            <span class="worker-bar-divider"></span>
            Fetch worker runs every 2h
          </div>
        }
      }

      <div style="margin-top: 8px;">
        <div class="section-header">
          <h2 class="section-title">Your top matches</h2>
          <a routerLink="/jobs" [queryParams]="{ tab: 'matches' }" class="view-all">
            View all <app-icon name="chevron-right" [size]="12" />
          </a>
        </div>

        @if (loading()) {
          <div style="display: grid; gap: 6px;">
            @for (i of [1, 2, 3]; track i) {
              <app-loading-skeleton type="job-card" />
            }
          </div>
        } @else if (matches().length === 0) {
          <app-empty-state
            title="No matches yet"
            description="The matching engine ships in Step 6. Set your skills and preferences now so matches are ready the moment it lands."
            actionLabel="Set preferences"
            actionRoute="/preferences"
          >
            <app-icon icon name="target" [size]="20" />
          </app-empty-state>
        } @else {
          <div class="matches-grid">
            @for (job of matches(); track job.id) {
              <app-job-card [job]="job" [showMatchBar]="true" (save)="toggleSave(job)" />
            }
          </div>
        }
      </div>

      <div style="margin-top: 28px;">
        <div class="section-header">
          <h2 class="section-title">Recently fetched</h2>
          <a routerLink="/jobs" class="view-all">
            View all <app-icon name="chevron-right" [size]="12" />
          </a>
        </div>

        @if (loading()) {
          <div style="display: grid; gap: 6px;">
            @for (i of [1, 2, 3]; track i) {
              <app-loading-skeleton type="job-card" />
            }
          </div>
        } @else if (recent().length === 0) {
          <app-empty-state
            title="No jobs indexed yet"
            description="Run the fetch worker (or the admin endpoint) to pull in jobs from Remotive, Arbeitnow and WWR."
          >
            <app-icon icon name="inbox" [size]="20" />
          </app-empty-state>
        } @else {
          <div class="recent-scroll">
            @for (job of recent(); track job.id) {
              <div class="recent-card"><app-job-card [job]="job" (save)="toggleSave(job)" /></div>
            }
          </div>
        }
      </div>
    </app-layout>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly jobService = inject(JobService);

  readonly loading = signal(true);
  readonly totalJobs = signal(0);
  readonly recent = signal<JobListItem[]>([]);
  readonly matches = signal<JobListItem[]>([]);
  readonly lastUpdated = signal<string>('');

  get firstName(): string {
    return this.auth.getCurrentUser()?.fullName?.split(/\s+/)[0] ?? '';
  }

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  ngOnInit(): void {
    this.jobService.getJobs({ page: 1, pageSize: 3 }).subscribe({
      next: (res) => {
        this.totalJobs.set(res.totalCount);
        this.recent.set(res.items);
        this.lastUpdated.set(res.items.length ? timeAgo(res.items[0].fetchedAt) : '');
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.jobService.getJobMatches().subscribe({
      next: (jobs) => this.matches.set(jobs.slice(0, 5)),
      error: () => this.matches.set([]),
    });
  }

  toggleSave(job: JobListItem): void {
    const prev = job.isSaved;
    job.isSaved = !prev;
    this.jobService.saveJob(job.id).subscribe({
      error: () => (job.isSaved = prev),
    });
  }
}
