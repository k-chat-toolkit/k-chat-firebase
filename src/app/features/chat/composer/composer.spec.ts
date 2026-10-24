import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import { CustomEmojiService } from '@core/data/custom-emoji.service';
import { ProfileService } from '@core/data/profile.service';
import { LIMITS } from '@core/limits';
import { loadUnicodeEmoji } from '@shared/emoji/unicode-emoji';
import { Composer } from './composer';

/** No Firestore in unit tests: no custom emoji, and one other member, Bình. */
const noCustomEmoji = {
  catalog: signal([]).asReadonly(),
  loadCatalog: () => Promise.resolve(),
};
const names: Record<string, string> = { u2: 'Bình' };
const profiles = {
  profile: (uid: string) => signal(names[uid] ? { uid, displayName: names[uid] } : null),
  cachedName: (uid: string) => names[uid] ?? null,
};
const auth = { user: signal({ uid: 'me' }) };

describe('Composer', () => {
  let fixture: ComponentFixture<Composer>;
  let sent: string[];
  let textarea: HTMLTextAreaElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: CustomEmojiService, useValue: noCustomEmoji },
        { provide: ProfileService, useValue: profiles },
        { provide: AuthService, useValue: auth },
      ],
    });
    fixture = TestBed.createComponent(Composer);
    fixture.componentRef.setInput('placeholder', 'Message #riders');
    fixture.componentRef.setInput('memberIds', ['me', 'u2']);
    sent = [];
    fixture.componentInstance.send.subscribe((text) => sent.push(text));
    await fixture.whenStable();
    textarea = fixture.nativeElement.querySelector('textarea');
  });

  async function type(value: string): Promise<void> {
    textarea.value = value;
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  function press(init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, ...init });
    textarea.dispatchEvent(event);
    return event;
  }

  it('sends the trimmed text on Enter and clears the box', async () => {
    await type('  on my way \n');
    expect(press({}).defaultPrevented).toBe(true);
    expect(sent).toEqual(['on my way']);
    expect(textarea.value).toBe('');
  });

  it('keeps Shift+Enter for a new line', async () => {
    await type('line one');
    expect(press({ shiftKey: true }).defaultPrevented).toBe(false);
    expect(sent).toEqual([]);
  });

  it('leaves Enter alone while an input method is composing', async () => {
    await type('Vie');
    press({ isComposing: true });
    expect(sent).toEqual([]);
  });

  it('does not send blank text or text over the cap', async () => {
    await type('   ');
    press({});
    await type('a'.repeat(LIMITS.messageMaxLength + 1));
    press({});
    expect(sent).toEqual([]);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[type=submit]');
    expect(button.disabled).toBe(true);
  });

  it('suggests emoji for ":thumbsu" and inserts the pick on Enter, without sending', async () => {
    await loadUnicodeEmoji();
    await type('ok :thumbsu');
    await fixture.whenStable();
    const options: HTMLElement[] = [...fixture.nativeElement.querySelectorAll('[role=option]')];
    expect(options[0].textContent).toContain(':+1:');
    expect(press({}).defaultPrevented).toBe(true);
    expect(textarea.value).toBe('ok 👍 ');
    expect(sent).toEqual([]);
  });

  it('does not suggest inside a word or a time', async () => {
    await loadUnicodeEmoji();
    await type('at 10:30');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=option]')).toBeNull();
  });

  it('suggests members after "@" and sends the mention as a token', async () => {
    await type('cc @bi');
    const options: HTMLElement[] = [...fixture.nativeElement.querySelectorAll('[role=option]')];
    expect(options.map((option) => option.querySelector('.suggestion-label')?.textContent)).toEqual(
      ['Bình'],
    );
    press({});
    expect(textarea.value).toBe('cc @Bình ');
    await type(textarea.value + 'ơi');
    press({});
    expect(sent).toEqual(['cc <@u2> ơi']);
  });

  it('also sends a typed, unpicked name of a known member as a mention', async () => {
    await type('@Bình xem nhé');
    press({});
    expect(sent).toEqual(['<@u2> xem nhé']);
  });
});
