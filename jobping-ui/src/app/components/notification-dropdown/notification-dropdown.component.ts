import { Component, OnInit, inject, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { NotificationService } from '../../services/notification.service';
import { Notification } from '../../models';
import { timeAgo } from '../../utils/time-ago';

@Component({
  selector: 'app-notification-dropdown',
  imports: [IconComponent],
  template: `
    <div style="position: relative;">
      <button class="icon-btn" (click)="toggle()" aria-label="Notifications" title="Notifications" style="position: relative;">
        <app-icon name="bell" [size]="16" />
        @if (unreadCount() > 0) {
          <span
            style="position: absolute; top: 2px; right: 2px; min-width: 14px; height: 14px; padding: 0 3px; border-radius: 99px; background: var(--accent); color: white; font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; font-family: var(--font-mono);"
          >
            {{ unreadCount() > 9 ? '9+' : unreadCount() }}
          </span>
        }
      </button>

      @if (open()) {
        <div style="position: fixed; inset: 0; z-index: 40;" (click)="close()"></div>
        <div
          class="card"
          style="position: absolute; right: 0; margin-top: 8px; width: 300px; z-index: 50; padding: 0;"
        >
          <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between;">
            <p style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Notifications</p>
            @if (unreadCount() > 0) {
              <button class="btn btn-ghost btn-sm" (click)="markAllRead()">Mark all read</button>
            }
          </div>

          @if (loading()) {
            <div style="padding: 24px 16px;">
              <div class="skeleton" style="height: 14px; width: 70%; margin-bottom: 8px;"></div>
              <div class="skeleton" style="height: 14px; width: 50%;"></div>
            </div>
          } @else if (notifications().length === 0) {
            <div class="empty-state" style="padding: 32px 16px;">
              <div class="empty-icon"><app-icon name="inbox" [size]="18" /></div>
              <p class="empty-title">No notifications yet</p>
              <p class="empty-desc">Matches land here once the mail pipeline sends an alert.</p>
            </div>
          } @else {
            <div style="max-height: 320px; overflow-y: auto;">
              @for (n of notifications(); track n.id) {
                <button
                  (click)="select(n)"
                  style="display: block; width: 100%; text-align: left; padding: 10px 16px; border: none; background: transparent; cursor: pointer; border-bottom: 1px solid var(--border-subtle);"
                  [style.background]="n.isRead ? 'transparent' : 'var(--accent-soft)'"
                >
                  <p style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin: 0 0 2px;">{{ n.title }}</p>
                  <p style="font-size: 11px; color: var(--text-muted); margin: 0;">{{ n.message }}</p>
                  <p style="font-size: 10px; color: var(--text-muted); margin: 4px 0 0; font-family: var(--font-mono);">{{ ago(n.createdOn) }}</p>
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class NotificationDropdownComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);

  readonly open = signal(false);
  readonly loading = signal(false);
  readonly notifications = signal<Notification[]>([]);
  readonly unreadCount = signal(0);
  private loaded = false;

  ngOnInit(): void {
    this.refreshUnreadCount();
  }

  toggle(): void {
    this.open.update((v) => !v);
    if (this.open() && !this.loaded) {
      this.load();
    }
  }

  close(): void {
    this.open.set(false);
  }

  private refreshUnreadCount(): void {
    this.notificationService.getNotifications(true).subscribe({
      next: (items) => this.unreadCount.set(items.length),
      error: () => {},
    });
  }

  private load(): void {
    this.loading.set(true);
    this.notificationService.getNotifications().subscribe({
      next: (items) => {
        this.notifications.set(items.slice(0, 8));
        this.unreadCount.set(items.filter((n) => !n.isRead).length);
        this.loading.set(false);
        this.loaded = true;
      },
      error: () => this.loading.set(false),
    });
  }

  select(n: Notification): void {
    if (n.isRead) return;
    n.isRead = true;
    this.unreadCount.update((c) => Math.max(0, c - 1));
    this.notificationService.markRead(n.id).subscribe({
      error: () => {
        n.isRead = false;
        this.unreadCount.update((c) => c + 1);
      },
    });
  }

  markAllRead(): void {
    const prevUnread = this.unreadCount();
    this.notifications.update((list) => list.map((n) => ({ ...n, isRead: true })));
    this.unreadCount.set(0);
    this.notificationService.markAllRead().subscribe({
      error: () => this.unreadCount.set(prevUnread),
    });
  }

  ago(iso: string): string {
    return timeAgo(iso);
  }
}
