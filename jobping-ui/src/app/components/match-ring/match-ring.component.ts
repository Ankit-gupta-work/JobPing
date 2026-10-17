import { Component, Input, computed, signal } from '@angular/core';
import { countUp } from '../../utils/count-up';

@Component({
  selector: 'app-match-ring',
  template: `
    <div class="match-ring-wrap" [style.width.px]="size" [style.height.px]="size">
      <svg class="match-ring" [attr.width]="size" [attr.height]="size" [attr.viewBox]="'0 0 ' + size + ' ' + size">
        <circle class="match-ring-bg" [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="radius" />
        <circle
          class="match-ring-fill"
          [class.high]="tier() === 'high'"
          [class.mid]="tier() === 'mid'"
          [class.low]="tier() === 'low'"
          [attr.cx]="size / 2"
          [attr.cy]="size / 2"
          [attr.r]="radius"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="offset()"
        />
      </svg>
      <span class="match-ring-text" [class.high]="tier() === 'high'" [class.mid]="tier() === 'mid'" [class.low]="tier() === 'low'">
        {{ displayed() }}%
      </span>
    </div>
  `,
})
export class MatchRingComponent {
  @Input() size = 44;

  private readonly _score = signal(0);
  readonly displayed = signal(0);

  @Input()
  set score(value: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    this._score.set(clamped);
    this.animateTo(clamped);
  }
  get score(): number {
    return this._score();
  }

  get radius(): number {
    return this.size / 2 - 3;
  }

  get circumference(): number {
    return 2 * Math.PI * this.radius;
  }

  readonly offset = computed(() => this.circumference - (this.displayed() / 100) * this.circumference);

  readonly tier = computed<'high' | 'mid' | 'low'>(() => {
    const s = this._score();
    if (s >= 75) return 'high';
    if (s >= 50) return 'mid';
    return 'low';
  });

  private cancelAnimation: (() => void) | null = null;

  private animateTo(target: number): void {
    this.cancelAnimation?.();
    this.cancelAnimation = countUp(this.displayed(), target, 600, (v) => this.displayed.set(v));
  }
}
