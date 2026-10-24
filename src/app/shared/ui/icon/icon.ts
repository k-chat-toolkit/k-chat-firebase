import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Stroke icons on a 24×24 grid, drawn for this app. */
const ICONS = {
  hash: 'M5 9h14M5 15h14M10 4L8 20M16 4l-2 16',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M14 6l-6 6 6 6',
  send: 'M4 12L20 4l-5 16-3-7-8-1z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13',
  users:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14c2 .8 3 3 3 6',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  signOut: 'M10 5H5v14h5M14 8l4 4-4 4M18 12H9',
  join: 'M14 5h5v14h-5M4 12h11M11 8l4 4-4 4',
  globe:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  refresh: 'M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4',
  message: 'M4 5h16v11H9l-5 4V5z',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5',
  smile: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5v.5M15 9.5v.5',
  reaction:
    'M20.5 13A8.5 8.5 0 1 1 11 3.55M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5v.5M15 9.5v.5M19 2.5v6M16 5.5h6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
} as const;

export type IconName = keyof typeof ICONS;

/** A decorative icon. Give the surrounding button an accessible label. */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
  `,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);

  protected readonly path = computed(() => ICONS[this.name()]);
}
