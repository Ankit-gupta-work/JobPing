import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-skill-chip',
  template: `
    @if (clickable) {
      <button type="button" class="filter-chip" [class.active]="selected" (click)="clicked.emit()">
        {{ name }}
      </button>
    } @else {
      <span class="tag">{{ name }}</span>
    }
  `,
})
export class SkillChipComponent {
  @Input({ required: true }) name!: string;
  @Input() selected = false;
  @Input() clickable = false;
  @Output() clicked = new EventEmitter<void>();
}
