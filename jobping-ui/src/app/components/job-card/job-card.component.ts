import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JobListItem } from '../../models';
import { timeAgo } from '../../utils/time-ago';
import { MatchBadgeComponent } from '../match-badge/match-badge.component';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-job-card',
  imports: [RouterLink, IconComponent, MatchBadgeComponent],
  template: `
    <div class="job-card" style="cursor: default;">
      <div class="job-logo">{{ initials(job.company) }}</div>

      <div class="job-body">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
          <a [routerLink]="['/jobs', job.id]" class="job-title" style="text-decoration: none;">
            {{ job.title }}
          </a>
          <span class="source-badge" style="flex-shrink: 0;">{{ job.source }}</span>
        </div>

        <div class="job-meta">
          <span>{{ job.company }}</span>
          @if (job.location || job.isRemote) {
            <span class="job-meta-dot"></span>
            <span>{{ job.location || 'Remote' }}</span>
          }
          <span class="job-meta-dot"></span>
          <span>{{ ago(job.fetchedAt) }}</span>
          @if (showMatchBar && job.matchPercentage != null) {
            <span class="job-meta-dot"></span>
            <app-match-badge [score]="job.matchPercentage" />
          }
        </div>

        @if (job.skills.length) {
          <div class="job-tags">
            @for (skill of job.skills.slice(0, 6); track skill) {
              <span class="tag">{{ skill }}</span>
            }
            @if (job.skills.length > 6) {
              <span class="tag">+{{ job.skills.length - 6 }}</span>
            }
          </div>
        }

        @if (showMatchBar && job.matchPercentage != null) {
          <div class="match-bar"><div class="match-bar-fill" [style.width.%]="job.matchPercentage"></div></div>
        }

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px;">
          <span style="font-size: 12px; font-family: var(--font-mono); color: var(--text-secondary);">
            {{ salaryRange() }}
          </span>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button
              class="icon-btn"
              (click)="save.emit()"
              [title]="job.isSaved ? 'Unsave' : 'Save'"
              [style.color]="job.isSaved ? 'var(--accent)' : 'var(--text-muted)'"
            >
              <app-icon name="heart" [size]="16" />
            </button>
            <a [routerLink]="['/jobs', job.id]" class="btn btn-secondary btn-sm">View →</a>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class JobCardComponent {
  @Input({ required: true }) job!: JobListItem;
  @Input() showMatchBar = false;
  @Output() save = new EventEmitter<void>();

  salaryRange(): string {
    const { minSalary, maxSalary } = this.job;
    if (minSalary && maxSalary) return `₹${minSalary}–${maxSalary} LPA`;
    if (minSalary) return `₹${minSalary}+ LPA`;
    if (maxSalary) return `Up to ₹${maxSalary} LPA`;
    return '';
  }

  initials(company: string): string {
    const parts = company.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '–';
  }

  ago(iso: string): string {
    return timeAgo(iso);
  }
}
