import { Component, EventEmitter, Input, Output } from '@angular/core';
import { JobListItem } from '../../models';
import { JobCardComponent } from '../job-card/job-card.component';

interface DragState {
  startX: number;
  dx: number;
  dragging: boolean;
}

@Component({
  selector: 'app-swipe-stack',
  imports: [JobCardComponent],
  template: `
    <div class="swipe-stack">
      @for (job of visibleJobs(); track job.id; let i = $index) {
        <div
          class="swipe-card"
          [style.transform]="i === 0 ? cardTransform() : 'scale(' + (1 - i * 0.04) + ') translateY(' + i * 8 + 'px)'"
          [style.opacity]="i === 0 ? 1 : 1 - i * 0.35"
          [style.zIndex]="visibleJobs().length - i"
          (pointerdown)="i === 0 && onPointerDown($event)"
          (pointermove)="i === 0 && onPointerMove($event)"
          (pointerup)="i === 0 && onPointerUp()"
          (pointercancel)="i === 0 && onPointerUp()"
        >
          <span class="swipe-save-indicator" [style.opacity]="i === 0 ? saveOpacity() : 0">Save</span>
          <span class="swipe-dismiss-indicator" [style.opacity]="i === 0 ? skipOpacity() : 0">Skip</span>
          <app-job-card [job]="job" [showMatchBar]="showMatchBar" (save)="onManualSave(job)" />
        </div>
      }
    </div>
    @if (visibleJobs().length) {
      <div class="swipe-hint">
        <span class="swipe-hint-item">← skip this session</span>
        <span class="swipe-hint-item">save →</span>
      </div>
    }
  `,
})
export class SwipeStackComponent {
  @Input() showMatchBar = false;
  @Input() set jobs(value: JobListItem[]) {
    this._jobs = value;
    this.removed.clear();
  }
  @Output() save = new EventEmitter<JobListItem>();

  private _jobs: JobListItem[] = [];
  private readonly removed = new Set<number>();
  private drag: DragState = { startX: 0, dx: 0, dragging: false };
  private dx = 0;

  visibleJobs(): JobListItem[] {
    return this._jobs.filter((j) => !this.removed.has(j.id)).slice(0, 3);
  }

  cardTransform(): string {
    if (!this.dx) return 'translateX(0) rotate(0)';
    const rotate = this.dx / 20;
    return `translateX(${this.dx}px) rotate(${rotate}deg)`;
  }

  saveOpacity(): number {
    return this.dx > 20 ? Math.min(1, this.dx / 100) : 0;
  }

  skipOpacity(): number {
    return this.dx < -20 ? Math.min(1, -this.dx / 100) : 0;
  }

  onPointerDown(e: PointerEvent): void {
    this.drag = { startX: e.clientX, dx: 0, dragging: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.drag.dragging) return;
    this.dx = e.clientX - this.drag.startX;
  }

  onPointerUp(): void {
    if (!this.drag.dragging) return;
    this.drag.dragging = false;
    const threshold = 90;
    const top = this.visibleJobs()[0];

    if (top && this.dx > threshold) {
      this.save.emit(top);
      this.advance(top.id);
    } else if (top && this.dx < -threshold) {
      this.advance(top.id);
    }
    this.dx = 0;
  }

  onManualSave(job: JobListItem): void {
    this.save.emit(job);
  }

  private advance(id: number): void {
    this.removed.add(id);
  }
}
