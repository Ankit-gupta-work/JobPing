import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location as NgLocation } from '@angular/common';
import { AppLayoutComponent } from '../../../components/app-layout/app-layout.component';
import { MatchBadgeComponent } from '../../../components/match-badge/match-badge.component';
import { LoadingSkeletonComponent } from '../../../components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { JobService } from '../../../services/job.service';
import { JobDetail } from '../../../models';
import { timeAgo } from '../../../utils/time-ago';

@Component({
  selector: 'app-job-detail',
  imports: [AppLayoutComponent, MatchBadgeComponent, LoadingSkeletonComponent, EmptyStateComponent, IconComponent],
  template: `
    <app-layout>
      <button (click)="goBack()" class="btn btn-ghost" style="margin-bottom: 20px; padding-left: 0;">
        <app-icon name="chevron-left" [size]="14" /> Back to jobs
      </button>

      @if (loading()) {
        <app-loading-skeleton type="job-detail" />
      } @else if (!job()) {
        <app-empty-state title="Job not found" description="It may have been removed or deindexed.">
          <app-icon icon name="alert-circle" [size]="20" />
        </app-empty-state>
      } @else {
        <div class="job-detail-layout">
          <!-- Main -->
          <article class="job-detail-main">
            <div style="display: flex; align-items: flex-start; gap: 14px;">
              <div class="job-logo" style="width: 48px; height: 48px; font-size: 16px;">
                {{ initials(job()!.company) }}
              </div>
              <div style="min-width: 0;">
                <h1 style="font-size: 20px; font-weight: 600; color: var(--text-primary); letter-spacing: -0.01em;">
                  {{ job()!.title }}
                </h1>
                <div class="job-meta" style="margin-top: 4px;">
                  <span>{{ job()!.company }}</span>
                  @if (job()!.location || job()!.isRemote) {
                    <span class="job-meta-dot"></span>
                    <span>{{ job()!.location || 'Remote' }}</span>
                  }
                  <span class="job-meta-dot"></span>
                  <span class="source-badge">{{ job()!.source }}</span>
                  <span class="job-meta-dot"></span>
                  <span>{{ ago(job()!.fetchedAt) }}</span>
                </div>
              </div>
            </div>

            @if (job()!.skills.length) {
              <div class="job-tags" style="margin-top: 16px;">
                @for (skill of job()!.skills; track skill) {
                  <span class="tag accent">{{ skill }}</span>
                }
              </div>
            }

            <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 24px 0;" />

            @if (job()!.description) {
              <div class="job-description" style="color: var(--text-secondary); line-height: 1.7; font-size: 13px;" [innerHTML]="job()!.description"></div>
            } @else {
              <p style="color: var(--text-muted); font-size: 13px;">No description provided by the source.</p>
            }
          </article>

          <!-- Sticky sidebar -->
          <aside class="job-detail-sidebar">
            <div class="card" style="display: flex; flex-direction: column; gap: 16px;">
              @if (job()!.matchPercentage != null) {
                <div>
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                    <span style="font-size: 13px; color: var(--text-secondary);">Your match</span>
                    <app-match-badge [score]="job()!.matchPercentage!" />
                  </div>
                  <div class="match-bar"><div class="match-bar-fill" [style.width.%]="job()!.matchPercentage"></div></div>
                </div>
              }

              <div style="display: flex; flex-direction: column; gap: 8px;">
                <button (click)="apply()" [disabled]="!job()!.sourceUrl" class="btn btn-primary apply-btn" style="justify-content: center;">
                  Apply Now <app-icon name="external-link" [size]="14" />
                </button>
                <button
                  (click)="toggleSave()"
                  class="btn"
                  [class.btn-primary]="job()!.isSaved"
                  [class.btn-secondary]="!job()!.isSaved"
                  style="justify-content: center;"
                >
                  <app-icon name="heart" [size]="14" /> {{ job()!.isSaved ? 'Saved' : 'Save Job' }}
                </button>
              </div>

              <div style="padding-top: 4px;">
                @if (job()!.minSalary || job()!.maxSalary) {
                  <div class="settings-row">
                    <span class="settings-key">Salary</span>
                    <span class="settings-val">{{ salaryRange() }}</span>
                  </div>
                }
                @if (job()!.jobType) {
                  <div class="settings-row">
                    <span class="settings-key">Type</span>
                    <span class="settings-val">{{ job()!.jobType }}</span>
                  </div>
                }
                <div class="settings-row">
                  <span class="settings-key">Remote</span>
                  <span class="settings-val">{{ job()!.isRemote ? 'Yes' : 'No' }}</span>
                </div>
                <div class="settings-row">
                  <span class="settings-key">Source</span>
                  <span class="settings-val">{{ job()!.source }}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      }
    </app-layout>
  `,
  styles: [`
    .job-description :is(h1,h2,h3) { color: var(--text-primary); font-weight: 600; margin: 1rem 0 .5rem; }
    .job-description a { color: var(--accent); text-decoration: underline; }
    .job-description ul { list-style: disc; padding-left: 1.25rem; margin: .5rem 0; }
    .job-description p { margin: .5rem 0; }
  `],
})
export class JobDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly jobService = inject(JobService);
  private readonly nav = inject(NgLocation);

  readonly job = signal<JobDetail | null>(null);
  readonly loading = signal(true);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.jobService.getJobById(id).subscribe({
      next: (j) => {
        this.job.set(j);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  goBack(): void {
    this.nav.back();
  }

  apply(): void {
    const url = this.job()?.sourceUrl;
    if (url) window.open(url, '_blank', 'noopener');
  }

  toggleSave(): void {
    const job = this.job();
    if (!job) return;
    const prev = job.isSaved;
    this.job.set({ ...job, isSaved: !prev });
    this.jobService.saveJob(job.id).subscribe({
      error: () => this.job.set({ ...job, isSaved: prev }),
    });
  }

  salaryRange(): string {
    const job = this.job()!;
    if (job.minSalary && job.maxSalary) return `₹${job.minSalary}–${job.maxSalary} LPA`;
    if (job.minSalary) return `₹${job.minSalary}+ LPA`;
    if (job.maxSalary) return `Up to ₹${job.maxSalary} LPA`;
    return '—';
  }

  initials(company: string): string {
    const parts = company.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '–';
  }

  ago(iso: string): string {
    return timeAgo(iso);
  }
}
