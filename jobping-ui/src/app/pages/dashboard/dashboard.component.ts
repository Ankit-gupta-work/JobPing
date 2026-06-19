import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { AuthService } from '../../services/auth.service';
import { JobService } from '../../services/job.service';
import { JobListItem } from '../../models';
import { timeAgo } from '../../utils/time-ago';

@Component({
  selector: 'app-dashboard',
  imports: [NavbarComponent, RouterLink],
  template: `
    <app-navbar />
    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div class="fade-up">
        <p class="font-mono text-sm text-accent-light mb-2">// dashboard</p>
        <h1 class="text-3xl sm:text-4xl font-bold text-text-primary">
          Welcome back{{ firstName ? ', ' + firstName : '' }}!
        </h1>
      </div>

      <!-- Stat cards -->
      <div class="grid sm:grid-cols-3 gap-4 mt-8">
        <div class="p-5 rounded-lg bg-bg-surface border border-border-default">
          <p class="text-sm text-text-secondary">Indexed jobs</p>
          <p class="text-3xl font-bold text-text-primary mt-1">
            {{ loading() ? '—' : totalJobs() }}
          </p>
        </div>
        <div class="p-5 rounded-lg bg-bg-surface border border-border-default">
          <p class="text-sm text-text-secondary">Jobs last updated</p>
          <p class="text-lg font-semibold text-accent-light mt-2">
            {{ loading() ? '—' : (lastUpdated() || 'never') }}
          </p>
        </div>
        <a routerLink="/jobs" class="p-5 rounded-lg bg-accent-muted border border-accent-border hover:shadow-glow transition-shadow flex flex-col justify-between">
          <p class="text-sm text-accent-light">Browse all jobs</p>
          <p class="text-lg font-semibold text-text-primary mt-2">Go to Jobs →</p>
        </a>
      </div>

      <!-- Recent jobs -->
      <div class="mt-10">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-text-primary">Recently fetched</h2>
          <a routerLink="/jobs" class="text-sm text-accent-light hover:underline">View all</a>
        </div>

        @if (loading()) {
          <div class="grid sm:grid-cols-3 gap-4">
            @for (i of [1,2,3]; track i) {
              <div class="p-5 rounded-lg bg-bg-surface border border-border-subtle animate-pulse h-28"></div>
            }
          </div>
        } @else if (recent().length === 0) {
          <p class="text-text-secondary text-sm">No jobs yet — run the fetch worker to index some.</p>
        } @else {
          <div class="grid sm:grid-cols-3 gap-4">
            @for (job of recent(); track job.id) {
              <a [routerLink]="['/jobs', job.id]"
                class="p-5 rounded-lg bg-bg-surface border border-border-default hover:border-border-strong transition-colors fade-up">
                <p class="text-text-primary font-semibold truncate">{{ job.title }}</p>
                <p class="text-text-secondary text-sm truncate">{{ job.company }}</p>
                <div class="flex items-center gap-2 mt-3">
                  <span class="text-xs px-2 py-0.5 rounded-full bg-bg-elevated border border-border-default text-text-secondary">{{ job.source }}</span>
                  <span class="text-xs text-text-muted">{{ ago(job.fetchedAt) }}</span>
                </div>
              </a>
            }
          </div>
        }
      </div>
    </main>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly jobService = inject(JobService);

  readonly loading = signal(true);
  readonly totalJobs = signal(0);
  readonly recent = signal<JobListItem[]>([]);
  readonly lastUpdated = signal<string>('');

  get firstName(): string {
    return this.auth.getCurrentUser()?.fullName?.split(/\s+/)[0] ?? '';
  }

  ngOnInit(): void {
    // One call gives total count + the 3 newest jobs (ordered by fetchedAt desc).
    this.jobService.getJobs({ page: 1, pageSize: 3 }).subscribe({
      next: (res) => {
        this.totalJobs.set(res.totalCount);
        this.recent.set(res.items);
        this.lastUpdated.set(res.items.length ? timeAgo(res.items[0].fetchedAt) : '');
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ago(iso: string): string {
    return timeAgo(iso);
  }
}
