import { TestBed } from '@angular/core/testing';
import { detectLocale, I18nService, interpolate } from './i18n.service';
import { en } from './locales/en';
import { vi } from './locales/vi';

describe('translations', () => {
  it('has the same keys in every locale', () => {
    expect(Object.keys(vi).sort()).toEqual(Object.keys(en).sort());
  });

  it('uses the same placeholders in every locale', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(vi[key]), key).toEqual(placeholders(en[key]));
    }
  });
});

describe('interpolate', () => {
  it('fills known placeholders and keeps unknown ones', () => {
    expect(interpolate('{name} has {count}', { name: 'An', count: 3 })).toBe('An has 3');
    expect(interpolate('{missing}', {})).toBe('{missing}');
  });
});

describe('detectLocale', () => {
  it('prefers the saved choice, then the browser, then English', () => {
    expect(detectLocale('vi', ['en-US'])).toBe('vi');
    expect(detectLocale(null, ['vi-VN', 'en'])).toBe('vi');
    expect(detectLocale('fr', ['de-DE'])).toBe('en');
  });
});

describe('I18nService', () => {
  let i18n: I18nService;

  beforeEach(() => {
    i18n = TestBed.inject(I18nService);
  });

  it('switches language at once', () => {
    i18n.setLocale('en');
    expect(i18n.t('chat.send')).toBe('Send');
    i18n.setLocale('vi');
    expect(i18n.t('chat.send')).toBe('Gửi');
  });

  it('names today and yesterday', () => {
    i18n.setLocale('en');
    const now = new Date(2026, 9, 24, 12);
    expect(i18n.formatDay(new Date(2026, 9, 24, 1), now)).toBe('Today');
    expect(i18n.formatDay(new Date(2026, 9, 23, 23), now)).toBe('Yesterday');
    expect(i18n.formatDay(new Date(2026, 9, 20, 9), now)).toContain('October');
  });
});
