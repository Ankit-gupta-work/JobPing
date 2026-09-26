import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AppLayoutComponent } from '../../../components/app-layout/app-layout.component';
import { JobCardComponent } from '../../../components/job-card/job-card.component';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../components/loading-skeleton/loading-skeleton.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { JobService } from '../../../services/job.service';
import { MasterDataService } from '../../../services/master-data.service';
import { JobListItem, Location } from '../../../models';

type Tab = 'all' | 'matches';

const SOURCE_ICONS: Record<string, 'globe' | 'rss' | 'external-link'> = {
  All: 'globe',
  Remotive: 'globe',
  Arbeitnow: 'globe',
  WWR: 'rss',
};

@Component({
  selector: 'app-jobs-list',
  imports: [
    AppLayoutComponent,
    JobCardComponent,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    IconComponent,
  ],
  template: `
    <app-layout>
      <div class="page-header">
        <h1 class="page-title">Jobs</h1>
      </div>

      <div class="tab-bar">
        <button class="tab" [class.active]="tab() === 'all'" (click)="setTab('all')">All Jobs</button>
        <button class="tab" [class.active]="tab() === 'matches'" (click)="setTab('matches')">Best Matches</button>
      </div>

      @if (tab() === 'matches') {
        @if (matchesLoading()) {
          <div class="job-list">
            @for (i of [1, 2, 3]; track i) {
              <app-loading-skeleton type="job-card" />
            }
          </div>
        } @else if (matches().length === 0) {
          <app-empty-state
            title="No matches yet"
            description="The matching engine ships in Step 6. Switch to the All Jobs tab above to browse everything indexed so far."
          >
            <app-icon icon name="target" [size]="20" />
          </app-empty-state>
        } @else {
          <div class="job-list">
            @for (job of matches(); track job.id) {
              <app-job-card [job]="job" [showMatchBar]="true" (save)="toggleSave(job)" />
            }
          </div>
        }
      } @else {
        <div class="jobs-layout">
          <!-- Mobile/tablet: horizontal filter bar -->
          <div class="filter-mobile-bar">
            @for (s of sources; track s) {
              <button class="filter-chip" [class.active]="currentSource() === s" (click)="setSource(s)">
                {{ s }}
              </button>
            }
            <div style="width: 1px; height: 20px; background: var(--border-default); flex-shrink: 0;"></div>
            <button class="filter-chip" (click)="openFilterSheet()">
              <app-icon name="sliders-horizontal" [size]="12" />
              Filters
            </button>
          </div>

          <!-- Desktop: filter sidebar -->
          <aside class="filter-sidebar">
            <div class="filter-group">
              <p class="filter-label">Source</p>
              @for (s of sources; track s) {
                <button
                  class="filter-option"
                  [class.selected]="currentSource() === s"
                  (click)="setSource(s)"
                >
                  <app-icon [name]="sourceIcon(s)" [size]="14" />
                  {{ s }}
                </button>
              }
            </div>

            <div class="filter-group">
              <p class="filter-label">Remote</p>
              <div class="settings-row" style="padding: 5px 8px;">
                <span style="font-size: 13px; color: var(--text-secondary);">Remote only</span>
                <button class="toggle" [class.on]="remoteOnly()" (click)="toggleRemote()" type="button">
                  <span class="toggle-thumb"></span>
                </button>
              </div>
            </div>

            <div class="filter-group">
              <p class="filter-label">Location</p>
              <div class="filter-chips">
                @for (loc of locations(); track loc.id) {
                  <button
                    class="filter-chip"
                    [class.active]="selectedLocation() === loc.name"
                    (click)="toggleLocation(loc.name)"
                  >
                    {{ loc.name }}
                  </button>
                }
              </div>
            </div>
          </aside>

          <section class="jobs-list">
            <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
              @if (!loading()) {
                <span style="font-size: 12px; color: var(--text-muted); font-family: var(--font-mono);">
                  {{ total() }} result{{ total() === 1 ? '' : 's' }}
                </span>
              }
            </div>

            @if (loading()) {
              <div class="job-list">
                @for (i of [1, 2, 3, 4, 5]; track i) {
                  <app-loading-skeleton type="job-card" />
                }
              </div>
            } @else if (jobs().length === 0) {
              <app-empty-state
                title="No jobs match your filters"
                description="Try clearing a filter or widening your search."
              >
                <app-icon icon name="search" [size]="20" />
              </app-empty-state>
            } @else {
              <div class="job-list">
                @for (job of jobs(); track job.id) {
                  <app-job-card [job]="job" (save)="toggleSave(job)" />
                }
              </div>

              <div class="pagination" style="margin-top: 16px;">
                <div class="pagination-mobile">
                  <button class="btn btn-secondary" [disabled]="page() <= 1" (click)="prevPage()">
                    <app-icon name="chevron-left" [size]="14" /> Prev
                  </button>
                  <span class="pagination-info">{{ page() }} / {{ totalPages() || 1 }}</span>
                  <button class="btn btn-secondary" [disabled]="page() >= totalPages()" (click)="nextPage()">
                    Next <app-icon name="chevron-right" [size]="14" />
                  </button>
                </div>

                <div class="pagination-desktop">
                  <button class="btn btn-secondary" [disabled]="page() <= 1" (click)="prevPage()">
                    <app-icon name="chevron-left" [size]="14" /> Prev
                  </button>
                  <div class="pagination-pages">
                    @for (p of pageNumbers(); track p) {
                      <button class="pagination-page-btn" [class.active]="p === page()" (click)="goToPage(p)">
                        {{ p }}
                      </button>
                    }
                  </div>
                  <button class="btn btn-secondary" [disabled]="page() >= totalPages()" (click)="nextPage()">
                    Next <app-icon name="chevron-right" [size]="14" />
                  </button>
                </div>
              </div>
            }
          </section>
        </div>
      }

      <!-- Mobile filter bottom sheet -->
      <div class="bottom-sheet-overlay" [class.open]="filterSheetOpen()" (click)="closeFilterSheet()"></div>
      <div class="bottom-sheet" [class.open]="filterSheetOpen()">
        <div class="bottom-sheet-handle"></div>
        <div class="bottom-sheet-header">
          <span class="section-title">Filters</span>
          <button class="btn btn-ghost btn-sm" (click)="clearFilters()">Clear all</button>
        </div>
        <div class="bottom-sheet-body">
          <div class="filter-group">
            <p class="filter-label">Source</p>
            <div class="filter-chips">
              @for (s of sources; track s) {
                <button class="filter-chip" [class.active]="currentSource() === s" (click)="setSource(s)">
                  {{ s }}
                </button>
              }
            </div>
          </div>

          <div class="filter-group">
            <p class="filter-label">Location</p>
            <div class="filter-chips">
              @for (loc of locations(); track loc.id) {
                <button
                  class="filter-chip"
                  [class.active]="selectedLocation() === loc.name"
                  (click)="toggleLocation(loc.name)"
                >
                  {{ loc.name }}
                </button>
              }
            </div>
          </div>

          <div class="filter-group">
            <div class="settings-row">
              <span class="settings-key">Remote only</span>
              <button class="toggle" [class.on]="remoteOnly()" (click)="toggleRemote()" type="button">
                <span class="toggle-thumb"></span>
              </button>
            </div>
          </div>
        </div>
        <div class="bottom-sheet-footer">
          <button class="btn btn-primary" style="width: 100%;" (click)="closeFilterSheet()">
            Show {{ total() }} results
          </button>
        </div>
      </div>
    </app-layout>
  `,
})
export class JobsListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly jobService = inject(JobService);
  private readonly masterData = inject(MasterDataService);

  readonly sources = ['All', 'Remotive', 'Arbeitnow', 'WWR'];

  readonly tab = signal<Tab>('all');
  readonly matches = signal<JobListItem[]>([]);
  readonly matchesLoading = signal(true);

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

  readonly filterSheetOpen = signal(false);

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('tab') === 'matches') {
      this.tab.set('matches');
    }
    this.masterData.getLocations().subscribe((l) => this.locations.set(l));
    this.load();
    this.jobService.getJobMatches().subscribe({
      next: (jobs) => {
        this.matches.set(jobs);
        this.matchesLoading.set(false);
      },
      error: () => this.matchesLoading.set(false),
    });
  }

  setTab(t: Tab): void {
    this.tab.set(t);
  }

  sourceIcon(s: string): 'globe' | 'rss' | 'external-link' {
    return SOURCE_ICONS[s] ?? 'globe';
  }

  openFilterSheet(): void {
    this.filterSheetOpen.set(true);
    document.body.classList.add('sheet-open');
  }

  closeFilterSheet(): void {
    this.filterSheetOpen.set(false);
    document.body.classList.remove('sheet-open');
  }

  clearFilters(): void {
    this.currentSource.set('All');
    this.remoteOnly.set(false);
    this.selectedLocation.set(null);
    this.page.set(1);
    this.load();
  }

  pageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.page();
    const windowSize = 5;
    let start = Math.max(1, current - Math.floor(windowSize / 2));
    const end = Math.min(total, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    const pages: number[] = [];
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  }

  goToPage(p: number): void {
    if (p === this.page()) return;
    this.page.set(p);
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
    job.isSaved = !prev;
    this.jobService.saveJob(job.id).subscribe({
      error: () => (job.isSaved = prev),
    });
  }
}
