import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-worker-terminal',
  template: `
    <div class="terminal-card">
      <div class="terminal-header">
        <span class="terminal-title">
          <span class="status-pulse"></span>
          fetch-jobs worker
        </span>
        <span class="terminal-next">runs every 2h</span>
      </div>
      <div class="terminal-lines">
        <div class="terminal-line">
          <span class="term-time">$</span>
          <span class="term-text">
            last sync <span class="term-text accent">{{ lastSyncLabel || 'never' }}</span>
          </span>
        </div>
        <div class="terminal-line">
          <span class="term-time">$</span>
          <span class="term-text success">{{ jobsIndexed }} jobs indexed</span>
        </div>
        <div class="terminal-line">
          <span class="term-time">$</span>
          <span class="term-text">{{ alertsSent }} alert{{ alertsSent === 1 ? '' : 's' }} sent to your inbox</span>
        </div>
      </div>
    </div>
  `,
})
export class WorkerTerminalComponent {
  @Input() lastSyncLabel = '';
  @Input() jobsIndexed = 0;
  @Input() alertsSent = 0;
}
