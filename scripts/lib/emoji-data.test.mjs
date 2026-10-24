import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildEmojiRows, recommendedForm, renderEmojiFile } from './emoji-data.mjs';

const en = [
  { hexcode: '1F44D', unicode: '👍', label: 'thumbs up', group: 1, order: 2, tags: ['+1', 'up'] },
  { hexcode: '1F600', unicode: '😀', label: 'grinning face', group: 0, order: 1, tags: ['face'] },
  { hexcode: '1F3FB', unicode: '🏻', label: 'light skin tone', group: 2, order: 3 },
  { hexcode: '1F1E6', unicode: '🇦', label: 'regional indicator A' },
  { hexcode: '1FAE9', unicode: '🫩', label: 'face with bags under eyes', group: 0, order: 4 },
];
const vi = [{ hexcode: '1F44D', label: 'dấu ra hiệu đồng ý', tags: ['ngón tay cái'] }];
const shortcodes = { '1F44D': ['+1', 'thumbsup'], '1F600': 'grinning' };
const versions = { 1: ['1F44D', '1F600'], 16: ['1FAE9'] };

describe('buildEmojiRows', () => {
  it('keeps real emoji in order, with shortcodes and both languages', () => {
    assert.deepEqual(buildEmojiRows({ en, vi, shortcodes, versions }), [
      ['😀', 0, 'grinning', 'grinning face', 'face', 'grinning face', ''],
      ['👍', 1, '+1 thumbsup', 'thumbs up', '+1 up', 'dấu ra hiệu đồng ý', 'ngón tay cái'],
    ]);
  });
});

describe('recommendedForm', () => {
  const vs16 = String.fromCodePoint(0xfe0f);

  it('drops an emoji-style selector the emoji does not need', () => {
    assert.equal(recommendedForm('👍' + vs16), '👍');
  });

  it('keeps one the emoji needs', () => {
    assert.equal(recommendedForm('❤' + vs16), '❤' + vs16);
  });
});

describe('renderEmojiFile', () => {
  it('writes one row per line', () => {
    assert.equal(
      renderEmojiFile([
        ['😀', 0],
        ['👍', 1],
      ]),
      '[\n["😀",0],\n["👍",1]\n]\n',
    );
  });
});
