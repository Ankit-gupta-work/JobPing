import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location as NgLocation } from '@angular/common';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { JobService } from '../../../services/job.service';
import { JobDetail } from '../../../models';
import { timeAgo } from '../../../utils/time-ago';

@Component({
  selector: 'app-job-detail',
  imports: [NavbarComponent],
  template: `
    <app-navbar />
    <main class="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <button (click)="goBack()" class="text-sm text-text-secondary hover:text-text-primary transition-colors mb-6">
        ← Back
      </button>

      @if (loading()) {
        <div class="animate-pulse space-y-4">
          <div class="h-7 w-2/3 bg-bg-elevated rounded"></div>
          <div class="h-4 w-1/3 bg-bg-elevated rounded"></div>
          <div class="h-40 bg-bg-surface border border-border-subtle rounded-lg"></div>
        </div>
      } @else if (!job()) {
        <div class="text-center py-20">
          <div class="text-4xl mb-3">🚫</div>
          <p class="text-text-primary font-semibold">Job not found</p>
        </div>
      } @else {
        <article class="fade-up">
          <div class="flex items-start gap-4">
            <div class="grid place-items-center w-14 h-14 rounded-md bg-accent-muted border border-accent-border text-accent-light font-bold text-lg shrink-0">
              {{ initials(job()!.company) }}
            </div>
            <div class="min-w-0">
              <h1 class="text-2xl font-bold text-text-primary">{{ job()!.title }}</h1>
              <p class="text-text-secondary">{{ job()!.company }}</p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 mt-4">
            <span class="text-xs px-2 py-0.5 rounded-full bg-bg-elevated border border-border-default text-text-secondary">{{ job()!.source }}</span>
            @if (job()!.isRemote) {
              <span class="text-xs px-2 py-0.5 rounded-full bg-accent-muted border border-accent-border text-accent-light">Remote</span>
            }
            @if (job()!.jobType) {
              <span class="text-xs px-2 py-0.5 rounded-full bg-bg-elevated border border-border-default text-text-secondary">{{ job()!.jobType }}</span>
            }
            @if (job()!.location) {
              <span class="text-xs text-text-muted">📍 {{ job()!.location }}</span>
            }
            <span class="text-xs text-text-muted">• {{ ago(job()!.fetchedAt) }}</span>
          </div>

          @if (job()!.skills.length) {
            <div class="flex flex-wrap gap-1.5 mt-4">
              @for (skill of job()!.skills; track skill) {
                <span class="chip chip-active">{{ skill }}</span>
              }
            </div>
          }

          <div class="flex gap-3 mt-6">
            <button (click)="apply()" [disabled]="!job()!.sourceUrl"
              class="px-5 py-2.5 rounded-md bg-accent text-white font-medium hover:bg-accent-hover transition-colors shadow-glow disabled:opacity-50 disabled:cursor-not-allowed">
              Apply Now ↗
            </button>
            <button (click)="toggleSave()"
              class="px-5 py-2.5 rounded-md border transition-colors"
              [class.border-accent-border]="job()!.isSaved"
              [class.text-accent-light]="job()!.isSaved"
              [class.bg-accent-muted]="job()!.isSaved"
              [class.border-border-default]="!job()!.isSaved"
              [class.text-text-primary]="!job()!.isSaved">
              {{ job()!.isSaved ? '★ Saved' : '☆ Save Job' }}
            </button>
          </div>

          <hr class="border-border-subtle my-8" />

          <div class="job-description text-text-secondary leading-relaxed" [innerHTML]="job()!.description"></div>
        </article>
      }
    </main>
  `,
  styles: [`
    .job-description :is(h1,h2,h3) { color: var(--text-primary); font-weight: 600; margin: 1rem 0 .5rem; }
    .job-description a { color: var(--accent-light); text-decoration: underline; }
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
    this.job.set({ ...job, isSaved: !prev }); // optimistic
    this.jobService.saveJob(job.id).subscribe({
      error: () => this.job.set({ ...job, isSaved: prev }),
    });
  }

  initials(company: string): string {
    const parts = company.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '–';
  }

  ago(iso: string): string {
    return timeAgo(iso);
  }
}
