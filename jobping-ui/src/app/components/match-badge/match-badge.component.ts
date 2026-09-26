import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-match-badge',
  template: `<span class="match-badge" [class]="tier()">{{ rounded() }}%</span>`,
})
export class MatchBadgeComponent {
  @Input({ required: true }) score!: number;

  rounded(): number {
    return Math.round(this.score);
  }

  tier(): 'high' | 'mid' | 'low' {
    const s = this.rounded();
    if (s >= 90) return 'high';
    if (s >= 70) return 'mid';
    return 'low';
  }
}
