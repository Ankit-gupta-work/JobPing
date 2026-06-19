import { Component } from '@angular/core';
import { NavbarComponent } from '../../components/navbar/navbar.component';

@Component({
  selector: 'app-placeholder',
  imports: [NavbarComponent],
  template: `
    <app-navbar />
    <main class="min-h-[calc(100vh-64px)] flex items-center justify-center px-6">
      <div class="text-center fade-up">
        <div class="text-5xl mb-4">🚧</div>
        <h1 class="text-2xl font-semibold text-text-primary mb-2">Coming soon</h1>
        <p class="text-text-secondary">This page is built in a later step.</p>
      </div>
    </main>
  `,
})
export class PlaceholderComponent {}
