import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { JobService } from '../../../services/job.service';
import { MasterDataService } from '../../../services/master-data.service';
import { JobListItem, Location } from '../../../models';
import { timeAgo } from '../../../utils/time-ago';

@Component({
  selector: 'app-jobs-list',
  imports: [NavbarComponent, RouterLink],
  template: `
    <app-navbar />
    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[260px_1fr] gap-6">
      <!-- ===== Sidebar filters ===== -->
      <aside class="space-y-6 lg:sticky lg:top-20 self-start">
        <div>
          <h3 class="text-sm font-semibold text-text-primary mb-3">Source</h3>
          <div class="flex flex-col gap-1">
            @for (s of sources; track s) {
              <button (click)="setSource(s)"
                class="text-left px-3 py-2 rounded-md text-sm transition-colors"
                [class.bg-accent-muted]="currentSource() === s"
                [class.text-accent-light]="currentSource() === s"
                [class.text-text-secondary]="currentSource() !== s"
                [class.hover:bg-bg-elevated]="currentSource() !== s">
                {{ s }}
              </button>
            }
          </div>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-text-primary mb-3">Remote</h3>
          <label class="flex items-center gap-2 cursor-pointer text-sm text-text-secondary">
            <input type="checkbox" [checked]="remoteOnly()" (change)="toggleRemote()" class="accent-accent w-4 h-4" />
            Remote only
          </label>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-text-primary mb-3">Location</h3>
          <div class="flex flex-wrap gap-2">
            @for (loc of locations(); track loc.id) {
              <button (click)="toggleLocation(loc.name)"
                class="chip" [class.chip-active]="selectedLocation() === loc.name">
                {{ loc.name }}
              </button>
            }
          </div>
        </div>
      </aside>

      <!-- ===== Job list ===== -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-2xl font-bold text-text-primary">Jobs</h1>
          @if (!loading()) {
            <span class="text-sm text-text-muted">{{ total() }} result{{ total() === 1 ? '' : 's' }}</span>
          }
        </div>

        @if (loading()) {
          <div class="space-y-3">
            @for (i of [1,2,3,4,5]; track i) {
              <div class="p-5 rounded-lg bg-bg-surface border border-border-subtle animate-pulse">
                <div class="h-4 w-1/3 bg-bg-elevated rounded mb-3"></div>
                <div class="h-3 w-1/4 bg-bg-elevated rounded mb-4"></div>
                <div class="flex gap-2"><div class="h-5 w-16 bg-bg-elevated rounded-full"></div><div class="h-5 w-16 bg-bg-elevated rounded-full"></div></div>
              </div>
            }
          </div>
        } @else if (jobs().length === 0) {
          <div class="text-center py-20 fade-up">
            <div class="text-4xl mb-3">🔍</div>
            <p class="text-text-primary font-semibold">No jobs match your filters</p>
            <p class="text-text-secondary text-sm mt-1">Try clearing a filter or widening your search.</p>
          </div>
        } @else {
          <div class="space-y-3">
            @for (job of jobs(); track job.id) {
              <article class="p-5 rounded-lg bg-bg-surface border border-border-default hover:border-border-strong transition-colors fade-up">
                <div class="flex items-start gap-4">
                  <div class="grid place-items-center w-11 h-11 rounded-md bg-accent-muted border border-accent-border text-accent-light font-semibold shrink-0">
                    {{ initials(job.company) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <a [routerLink]="['/jobs', job.id]" class="block text-text-primary font-semibold hover:text-accent-light transition-colors truncate">
                          {{ job.title }}
                        </a>
                        <p class="text-text-secondary text-sm truncate">{{ job.company }}</p>
                      </div>
                      <button (click)="toggleSave(job)" [title]="job.isSaved ? 'Unsave' : 'Save'"
                        class="shrink-0 text-lg transition-transform hover:scale-110"
                        [class.text-accent-light]="job.isSaved"
                        [class.text-text-muted]="!job.isSaved">
                        {{ job.isSaved ? '★' : '☆' }}
                      </button>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 mt-2">
                      <span class="text-xs px-2 py-0.5 rounded-full bg-bg-elevated border border-border-default text-text-secondary">{{ job.source }}</span>
                      @if (job.isRemote) {
                        <span class="text-xs px-2 py-0.5 rounded-full bg-accent-muted border border-accent-border text-accent-light">Remote</span>
                      }
                      @if (job.location) {
                        <span class="text-xs text-text-muted">📍 {{ job.location }}</span>
                      }
                      @if (job.jobType) {
                        <span class="text-xs text-text-muted">• {{ job.jobType }}</span>
                      }
                    </div>

                    @if (job.skills.length) {
                      <div class="flex flex-wrap gap-1.5 mt-3">
                        @for (skill of job.skills.slice(0, 6); track skill) {
                          <span class="text-xs px-2 py-0.5 rounded bg-bg-elevated text-text-secondary">{{ skill }}</span>
                        }
                        @if (job.skills.length > 6) {
                          <span class="text-xs px-2 py-0.5 text-text-muted">+{{ job.skills.length - 6 }}</span>
                        }
                      </div>
                    }

                    <p class="text-xs text-text-muted mt-3">{{ ago(job.fetchedAt) }}</p>
                  </div>
                </div>
              </article>
            }
          </div>

          <!-- Pagination -->
          <div class="flex items-center justify-between mt-6">
            <button (click)="prevPage()" [disabled]="page() <= 1"
              class="px-4 py-2 rounded-md border border-border-default text-sm text-text-primary hover:border-border-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              ← Prev
            </button>
            <span class="text-sm text-text-secondary">Page {{ page() }} of {{ totalPages() || 1 }}</span>
            <button (click)="nextPage()" [disabled]="page() >= totalPages()"
              class="px-4 py-2 rounded-md border border-border-default text-sm text-text-primary hover:border-border-strong transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Next →
            </button>
          </div>
        }
      </section>
    </main>
  `,
})
export class JobsListComponent implements OnInit {
  private readonly jobService = inject(JobService);
  private readonly masterData = inject(MasterDataService);

  readonly sources = ['All', 'Remotive', 'Arbeitnow', 'WWR'];

  readonly jobs = signal<JobListItem[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly loading = signal(true);

  readonly currentSource = signal('All');
  readonly remoteOnly = signal(false);
  readonly selectedLocation = signal<string | null>(null);

  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);

  ngOnInit(): void {
    this.masterData.getLocations().subscribe((l) => this.locations.set(l));
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.jobService
      .getJobs({
        source: this.currentSource() === 'All' ? null : this.currentSource(),
        isRemote: this.remoteOnly() ? true : null,
        location: this.selectedLocation(),
        page: this.page(),
        pageSize: this.pageSize(),
      })
      .subscribe({
        next: (res) => {
          this.jobs.set(res.items);
          this.total.set(res.totalCount);
          this.totalPages.set(res.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  setSource(s: string): void {
    this.currentSource.set(s);
    this.page.set(1);
    this.load();
  }

  toggleRemote(): void {
    this.remoteOnly.update((v) => !v);
    this.page.set(1);
    this.load();
  }

  toggleLocation(name: string): void {
    this.selectedLocation.update((cur) => (cur === name ? null : name));
    this.page.set(1);
    this.load();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  toggleSave(job: JobListItem): void {
    const prev = job.isSaved;
    job.isSaved = !prev; // optimistic
    this.jobService.saveJob(job.id).subscribe({
      error: () => (job.isSaved = prev), // revert on failure
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
