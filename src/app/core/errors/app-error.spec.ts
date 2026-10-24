import { safeRedirect } from '@core/auth/auth.guards';
import { AppError, errorMessageKey, isPermissionDenied } from './app-error';

describe('errorMessageKey', () => {
  it('explains app errors', () => {
    expect(errorMessageKey(new AppError('invite-not-found'))).toBe('errors.inviteNotFound');
  });

  it('explains Firebase error codes', () => {
    expect(errorMessageKey({ code: 'auth/invalid-credential' })).toBe('errors.invalidCredential');
    expect(errorMessageKey({ code: 'resource-exhausted' })).toBe('errors.quota');
  });

  it('falls back to a generic message', () => {
    expect(errorMessageKey(new Error('boom'))).toBe('errors.generic');
    expect(errorMessageKey(null)).toBe('errors.generic');
  });

  it('spots permission errors', () => {
    expect(isPermissionDenied({ code: 'permission-denied' })).toBe(true);
    expect(isPermissionDenied(undefined)).toBe(false);
  });
});

describe('safeRedirect', () => {
  it('only follows paths inside the app', () => {
    expect(safeRedirect('/r/abc')).toBe('/r/abc');
    expect(safeRedirect('https://evil.example')).toBe('/');
    expect(safeRedirect('//evil.example')).toBe('/');
    expect(safeRedirect(null)).toBe('/');
  });
});
