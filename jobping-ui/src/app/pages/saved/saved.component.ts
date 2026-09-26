import { Component, OnInit, inject, signal } from '@angular/core';
import { AppLayoutComponent } from '../../components/app-layout/app-layout.component';
import { JobCardComponent } from '../../components/job-card/job-card.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../components/loading-skeleton/loading-skeleton.component';
import { IconComponent } from '../../components/icon/icon.component';
import { JobService } from '../../services/job.service';
import { JobListItem } from '../../models';

@Component({
  selector: 'app-saved',
  imports: [AppLayoutComponent, JobCardComponent, EmptyStateComponent, LoadingSkeletonComponent, IconComponent],
  template: `
    <app-layout>
      <div class="page-header" style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h1 class="page-title">Saved Jobs</h1>
        </div>
        @if (!loading()) {
          <span style="font-size: 12px; color: var(--text-muted); font-family: var(--font-mono);">
            {{ jobs().length }} saved
          </span>
        }
      </div>

      @if (loading()) {
        <div class="job-list">
          @for (i of [1, 2, 3]; track i) {
            <app-loading-skeleton type="job-card" />
          }
        </div>
      } @else if (jobs().length === 0) {
        <app-empty-state
          title="No saved jobs yet"
          description="Start exploring and save the ones you want to come back to."
          actionLabel="Browse jobs"
          actionRoute="/jobs"
        >
          <app-icon icon name="bookmark" [size]="20" />
        </app-empty-state>
      } @else {
        <div class="job-list">
          @for (job of jobs(); track job.id) {
            <app-job-card [job]="job" (save)="unsave(job)" />
          }
        </div>
      }
    </app-layout>
  `,
})
export class SavedComponent implements OnInit {
  private readonly jobService = inject(JobService);

  readonly jobs = signal<JobListItem[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.jobService.getSavedJobs().subscribe({
      next: (jobs) => {
        this.jobs.set(jobs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  unsave(job: JobListItem): void {
    this.jobs.update((list) => list.filter((j) => j.id !== job.id));
    this.jobService.saveJob(job.id).subscribe({
      error: () => this.load(),
    });
  }
}
