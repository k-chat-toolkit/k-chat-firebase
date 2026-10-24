import { Timestamp } from 'firebase/firestore';
import type { CustomEmoji } from '@core/models/custom-emoji';
import { foldText, loadUnicodeEmoji, searchEmoji } from './unicode-emoji';

describe('foldText', () => {
  it('drops case and Vietnamese diacritics', () => {
    expect(foldText('Đồng Ý')).toBe('dong y');
  });
});

describe('searchEmoji', () => {
  const custom: CustomEmoji[] = [
    { name: 'thumbs-wave', image: 'data:image/png;base64,AA==', createdBy: 'u', createdAt: null },
    {
      name: 'party',
      image: 'data:image/png;base64,AA==',
      createdBy: 'u',
      createdAt: Timestamp.now(),
    },
  ];

  it('puts an exact shortcode first', async () => {
    const unicode = await loadUnicodeEmoji();
    const results = searchEmoji('thumbsup', unicode, custom, 'en', 5);
    expect(results[0].emoji?.startsWith('👍')).toBe(true);
  });

  it('finds custom emoji by name, and Unicode ones by Vietnamese words', async () => {
    const unicode = await loadUnicodeEmoji();
    expect(searchEmoji('par', unicode, custom, 'en', 3)[0].key).toBe(':party:');
    const vietnamese = searchEmoji('cuoi toe toet', unicode, [], 'vi', 3);
    expect(vietnamese[0].emoji).toBe('😀');
    expect(vietnamese[0].label).toBe('mặt cười toe toét');
  });

  it('ranks a name word in the UI language as high as a shortcode', async () => {
    const unicode = await loadUnicodeEmoji();
    expect(searchEmoji('tim', unicode, [], 'vi', 1)[0].label).toMatch(/\btim\b/);
    expect(searchEmoji('tim', unicode, [], 'en', 1)[0].shortcode).toMatch(/^tim/);
  });

  it('returns nothing for an empty query', async () => {
    expect(searchEmoji(' : ', await loadUnicodeEmoji(), custom, 'en', 5)).toEqual([]);
  });
});
