import { Component } from '@angular/core';
import { AppLayoutComponent } from '../../components/app-layout/app-layout.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { IconComponent } from '../../components/icon/icon.component';

@Component({
  selector: 'app-placeholder',
  imports: [AppLayoutComponent, EmptyStateComponent, IconComponent],
  template: `
    <app-layout>
      <app-empty-state title="Coming soon" description="This page is built in a later step.">
        <app-icon icon name="settings" [size]="20" />
      </app-empty-state>
    </app-layout>
  `,
})
export class PlaceholderComponent {}
