import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-skeleton',
  template: `
    @switch (type) {
      @case ('job-card') {
        <div class="job-card" style="cursor: default;">
          <div class="skeleton" style="width: 36px; height: 36px; flex-shrink: 0;"></div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
            <div class="skeleton" style="height: 14px; width: 40%;"></div>
            <div class="skeleton" style="height: 11px; width: 25%;"></div>
            <div style="display: flex; gap: 4px;">
              <div class="skeleton" style="height: 18px; width: 50px;"></div>
              <div class="skeleton" style="height: 18px; width: 50px;"></div>
            </div>
          </div>
        </div>
      }
      @case ('stat-card') {
        <div class="stat-card">
          <div class="skeleton" style="height: 12px; width: 50%; margin-bottom: 10px;"></div>
          <div class="skeleton" style="height: 24px; width: 35%;"></div>
        </div>
      }
      @case ('job-detail') {
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="skeleton" style="height: 28px; width: 60%;"></div>
          <div class="skeleton" style="height: 16px; width: 30%;"></div>
          <div class="skeleton" style="height: 160px; width: 100%; border-radius: var(--radius-lg);"></div>
        </div>
      }
    }
  `,
})
export class LoadingSkeletonComponent {
  @Input({ required: true }) type!: 'job-card' | 'stat-card' | 'job-detail';
}
