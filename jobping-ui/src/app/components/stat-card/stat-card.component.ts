import { Component, Input, signal } from '@angular/core';
import { countUp } from '../../utils/count-up';

@Component({
  selector: 'app-stat-card',
  template: `
    <div class="stat-card">
      <p class="stat-label"><ng-content select="[icon]" />{{ label }}</p>
      <p class="stat-value" [class.accent]="color === 'accent'">{{ displayValue() }}</p>
      @if (trend) {
        <p class="stat-sub">{{ trend }}</p>
      }
    </div>
  `,
})
export class StatCardComponent {
  @Input({ required: true }) label!: string;
  @Input() trend?: string;
  @Input() color: 'default' | 'accent' | 'success' = 'default';

  readonly displayValue = signal<string | number>('');
  private rawValue: string | number = '';
  private cancelAnimation: (() => void) | null = null;

  @Input({ required: true })
  set value(v: string | number) {
    const prev = this.rawValue;
    this.rawValue = v;
    this.cancelAnimation?.();

    if (typeof v === 'number' && typeof prev === 'number') {
      this.cancelAnimation = countUp(prev, v, 500, (n) => this.displayValue.set(n));
    } else if (typeof v === 'number') {
      this.cancelAnimation = countUp(0, v, 500, (n) => this.displayValue.set(n));
    } else {
      this.displayValue.set(v);
    }
  }
  get value(): string | number {
    return this.rawValue;
  }
}
