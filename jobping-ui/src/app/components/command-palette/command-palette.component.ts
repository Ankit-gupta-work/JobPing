import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { AdminService } from '../../services/admin.service';
import { IconComponent, IconName } from '../icon/icon.component';

type ActionKind = 'nav' | 'theme' | 'admin-fetch';

interface PaletteAction {
  id: string;
  label: string;
  icon: IconName;
  section: 'Navigate' | 'Actions';
  kind: ActionKind;
  path?: string;
  adminOnly?: boolean;
}

const ACTIONS: PaletteAction[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home', section: 'Navigate', kind: 'nav', path: '/dashboard' },
  { id: 'jobs', label: 'Jobs', icon: 'briefcase', section: 'Navigate', kind: 'nav', path: '/jobs' },
  { id: 'matches', label: 'Best Matches', icon: 'target', section: 'Navigate', kind: 'nav', path: '/jobs?tab=matches' },
  { id: 'saved', label: 'Saved Jobs', icon: 'bookmark', section: 'Navigate', kind: 'nav', path: '/saved' },
  { id: 'alerts', label: 'Alerts', icon: 'bell', section: 'Navigate', kind: 'nav', path: '/alerts' },
  { id: 'preferences', label: 'Preferences', icon: 'sliders-horizontal', section: 'Navigate', kind: 'nav', path: '/preferences' },
  { id: 'profile', label: 'Profile', icon: 'user', section: 'Navigate', kind: 'nav', path: '/profile' },
  { id: 'theme', label: 'Toggle theme', icon: 'sun', section: 'Actions', kind: 'theme' },
  { id: 'fetch', label: 'Run job fetch now', icon: 'refresh-cw', section: 'Actions', kind: 'admin-fetch', adminOnly: true },
];

@Component({
  selector: 'app-command-palette',
  imports: [IconComponent],
  template: `
    <div class="palette-overlay" [class.open]="open()" (click)="close()">
      <div class="palette" (click)="$event.stopPropagation()">
        <div class="palette-input-wrap">
          <app-icon name="search" [size]="16" />
          <input
            #input
            class="palette-input"
            type="text"
            placeholder="Search pages or actions…"
            [value]="query()"
            (input)="onInput($event)"
            (keydown)="onKeydown($event)"
            autocomplete="off"
            spellcheck="false"
          />
          <button class="icon-btn" (click)="close()" aria-label="Close">
            <app-icon name="x" [size]="14" />
          </button>
        </div>

        @if (fetchStatus()) {
          <div class="palette-section-label" style="color: var(--accent-text);">{{ fetchStatus() }}</div>
        }

        @if (grouped().length === 0) {
          <div class="palette-empty">No matches for "{{ query() }}"</div>
        } @else {
          @for (group of grouped(); track group.section) {
            <div class="palette-section-label">{{ group.section }}</div>
            @for (action of group.items; track action.id) {
              <div
                class="palette-item"
                [class.focused]="focusedId() === action.id"
                (mouseenter)="focusedId.set(action.id)"
                (click)="run(action)"
              >
                <span class="palette-item-icon">
                  <app-icon [name]="displayIcon(action)" [size]="14" />
                </span>
                <span class="palette-item-label">{{ displayLabel(action) }}</span>
              </div>
            }
          }
        }

        <div class="palette-footer">
          <span class="palette-footer-item"><span class="kbd">↑↓</span> navigate</span>
          <span class="palette-footer-item"><span class="kbd">↵</span> select</span>
          <span class="palette-footer-item"><span class="kbd">esc</span> close</span>
        </div>
      </div>
    </div>
  `,
})
export class CommandPaletteComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly admin = inject(AdminService);
  readonly theme = inject(ThemeService);

  readonly open = signal(false);
  readonly query = signal('');
  readonly focusedId = signal<string | null>(null);
  readonly fetchStatus = signal<string | null>(null);
  private fetching = false;

  private readonly available = computed<PaletteAction[]>(() => {
    const isAdmin = this.auth.getCurrentUser()?.role === 'Admin';
    return ACTIONS.filter((a) => !a.adminOnly || isAdmin);
  });

  private readonly filtered = computed<PaletteAction[]>(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.available();
    if (!q) return list;
    return list.filter((a) => a.label.toLowerCase().includes(q));
  });

  readonly grouped = computed<{ section: string; items: PaletteAction[] }[]>(() => {
    const items = this.filtered();
    const sections: ('Navigate' | 'Actions')[] = ['Navigate', 'Actions'];
    return sections
      .map((section) => ({ section, items: items.filter((i) => i.section === section) }))
      .filter((g) => g.items.length > 0);
  });

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.open() ? this.close() : this.show();
      return;
    }
    if (e.key === 'Escape' && this.open()) {
      this.close();
    }
  }

  show(): void {
    this.open.set(true);
    this.query.set('');
    this.fetchStatus.set(null);
    const first = this.filtered()[0];
    this.focusedId.set(first?.id ?? null);
    document.body.classList.add('sheet-open');
    queueMicrotask(() => {
      document.querySelector<HTMLInputElement>('.palette-input')?.focus();
    });
  }

  close(): void {
    this.open.set(false);
    document.body.classList.remove('sheet-open');
  }

  onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    const first = this.filtered()[0];
    this.focusedId.set(first?.id ?? null);
  }

  onKeydown(e: KeyboardEvent): void {
    const items = this.filtered();
    if (items.length === 0) return;
    const idx = items.findIndex((i) => i.id === this.focusedId());

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.focusedId.set(items[(idx + 1) % items.length].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.focusedId.set(items[(idx - 1 + items.length) % items.length].id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = items.find((i) => i.id === this.focusedId()) ?? items[0];
      this.run(target);
    }
  }

  displayIcon(a: PaletteAction): IconName {
    if (a.kind === 'theme') return this.theme.theme() === 'dark' ? 'sun' : 'moon';
    return a.icon;
  }

  displayLabel(a: PaletteAction): string {
    if (a.kind === 'theme') return this.theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    if (a.kind === 'admin-fetch' && this.fetching) return 'Running job fetch…';
    return a.label;
  }

  run(action: PaletteAction): void {
    if (action.kind === 'nav' && action.path) {
      this.close();
      this.router.navigateByUrl(action.path);
    } else if (action.kind === 'theme') {
      this.theme.toggle();
      this.close();
    } else if (action.kind === 'admin-fetch') {
      if (this.fetching) return;
      this.fetching = true;
      this.fetchStatus.set('Running job fetch…');
      this.admin.triggerFetchJobs().subscribe({
        next: (res) => {
          this.fetching = false;
          this.fetchStatus.set(`Fetch complete — ${res.newJobs} new job(s).`);
        },
        error: () => {
          this.fetching = false;
          this.fetchStatus.set('Fetch failed — check server logs.');
        },
      });
    }
  }
}
