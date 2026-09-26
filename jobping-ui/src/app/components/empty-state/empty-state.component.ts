import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  imports: [RouterLink],
  template: `
    <div class="empty-state">
      <div class="empty-icon"><ng-content select="[icon]" /></div>
      <p class="empty-title">{{ title }}</p>
      @if (description) {
        <p class="empty-desc">{{ description }}</p>
      }
      @if (actionLabel && actionRoute) {
        <a [routerLink]="actionRoute" class="btn btn-primary" style="margin-top: 16px;">
          {{ actionLabel }}
        </a>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input() description?: string;
  @Input() actionLabel?: string;
  @Input() actionRoute?: string;
}
