import { describe, expect, it } from 'vitest';
import { applyFormat } from './composer-format';

describe('applyFormat', () => {
  it('wraps selected text with bold markers', () => {
    const res = applyFormat('hello world', 0, 5, 'bold');
    expect(res.text).toBe('*hello* world');
    expect(res.selectionStart).toBe(7);
  });

  it('inserts empty bold pair and places cursor inside when nothing is selected', () => {
    const res = applyFormat('hello world', 6, 6, 'bold');
    expect(res.text).toBe('hello **world');
    expect(res.selectionStart).toBe(7);
    expect(res.selectionEnd).toBe(7);
  });

  it('wraps selected text with italic markers', () => {
    const res = applyFormat('hello world', 6, 11, 'italic');
    expect(res.text).toBe('hello _world_');
  });

  it('wraps selected text with strike markers', () => {
    const res = applyFormat('price: 100', 7, 10, 'strike');
    expect(res.text).toBe('price: ~100~');
  });

  it('wraps selected text with inline code markers', () => {
    const res = applyFormat('call npm test', 5, 13, 'code');
    expect(res.text).toBe('call `npm test`');
  });

  it('wraps text with a codeblock fence', () => {
    const res = applyFormat('const a = 1;', 0, 12, 'codeblock');
    expect(res.text).toBe('```\nconst a = 1;\n```');
  });

  it('inserts empty code block with cursor in middle when nothing is selected', () => {
    const res = applyFormat('', 0, 0, 'codeblock');
    expect(res.text).toBe('```\n\n```');
    expect(res.selectionStart).toBe(4);
  });

  it('prefixes lines with blockquote', () => {
    const res = applyFormat('hello', 0, 5, 'quote');
    expect(res.text).toBe('> hello');
  });

  it('inserts quote prefix when nothing is selected', () => {
    const res = applyFormat('', 0, 0, 'quote');
    expect(res.text).toBe('> ');
    expect(res.selectionStart).toBe(2);
  });
});
