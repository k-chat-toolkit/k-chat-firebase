import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { hueFor, initials } from '@shared/utils/text';

/**
 * Initials on a color that is stable per user. Uploaded photos would need
 * Cloud Storage, which the free Spark plan no longer includes.
 */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.--size]': 'size() + "px"',
    '[style.--hue]': 'hue()',
  },
  styles: `
    :host {
      display: inline-grid;
      flex: none;
      place-items: center;
      width: var(--size);
      height: var(--size);
      border-radius: calc(var(--size) * 0.22);
      background: hsl(var(--hue) 45% 42%);
      color: #ffffff;
      font-size: calc(var(--size) * 0.42);
      font-weight: 700;
      line-height: 1;
      user-select: none;
    }
  `,
  template: `{{ letters() }}`,
})
export class Avatar {
  readonly uid = input.required<string>();
  readonly name = input<string | null | undefined>('');
  readonly size = input(36);

  protected readonly letters = computed(() => initials(this.name() ?? ''));
  protected readonly hue = computed(() => hueFor(this.uid()));
}
