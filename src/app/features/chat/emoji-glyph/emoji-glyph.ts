import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CustomEmojiService } from '@core/data/custom-emoji.service';
import { customEmojiName } from '@core/models/custom-emoji';

/**
 * One emoji as stored in a reaction: a Unicode emoji, or ":name:" drawn with its
 * custom image. A custom emoji that no longer exists shows as its ":name:" text.
 * Decorative: the surrounding control carries the accessible label.
 */
@Component({
  selector: 'app-emoji-glyph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[style.--glyph-size.px]': 'size()' },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: var(--glyph-size);
      height: var(--glyph-size);
      font-size: calc(var(--glyph-size) * 0.9);
      line-height: 1;
    }
    img {
      width: var(--glyph-size);
      height: var(--glyph-size);
      object-fit: contain;
    }
    .missing {
      font-size: 12px;
    }
  `,
  template: `
    @if (name()) {
      @if (custom(); as custom) {
        <img [src]="custom.image" alt="" />
      } @else {
        <span class="missing">{{ key() }}</span>
      }
    } @else {
      {{ key() }}
    }
  `,
})
export class EmojiGlyph {
  private readonly customEmoji = inject(CustomEmojiService);

  readonly key = input.required<string>();
  readonly size = input(16);

  protected readonly name = computed(() => customEmojiName(this.key()));
  protected readonly custom = computed(() => {
    const name = this.name();
    return name ? this.customEmoji.emoji(name)() : null;
  });
}
