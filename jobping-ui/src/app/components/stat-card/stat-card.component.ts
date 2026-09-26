import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  template: `
    <div class="stat-card">
      <p class="stat-label"><ng-content select="[icon]" />{{ label }}</p>
      <p class="stat-value" [class.accent]="color === 'accent'">{{ value }}</p>
      @if (trend) {
        <p class="stat-sub">{{ trend }}</p>
      }
    </div>
  `,
})
export class StatCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string | number;
  @Input() trend?: string;
  @Input() color: 'default' | 'accent' | 'success' = 'default';
}
