import type { TranslationKey } from '@core/i18n/locales/en';

/** Failures the app detects itself, before or after talking to Firebase. */
export type AppErrorCode =
  | 'invite-malformed'
  | 'invite-not-found'
  | 'join-refused'
  | 'room-gone'
  | 'emoji-name-taken'
  | 'emoji-limit'
  | 'emoji-image-type'
  | 'emoji-image-unreadable'
  | 'emoji-image-too-large'
  | 'too-many-reactions';

export class AppError extends Error {
  constructor(readonly code: AppErrorCode) {
    super(code);
    this.name = 'AppError';
  }
}

const APP_ERRORS: Record<AppErrorCode, TranslationKey> = {
  'invite-malformed': 'errors.inviteMalformed',
  'invite-not-found': 'errors.inviteNotFound',
  'join-refused': 'errors.joinRefused',
  'room-gone': 'errors.roomGone',
  'emoji-name-taken': 'errors.emojiNameTaken',
  'emoji-limit': 'errors.emojiLimit',
  'emoji-image-type': 'errors.emojiImageType',
  'emoji-image-unreadable': 'errors.emojiImageUnreadable',
  'emoji-image-too-large': 'errors.emojiImageTooLarge',
  'too-many-reactions': 'errors.tooManyReactions',
};

/** Firebase error codes (Authentication and Firestore) the UI explains in words. */
const FIREBASE_ERRORS: Readonly<Record<string, TranslationKey>> = {
  'auth/invalid-credential': 'errors.invalidCredential',
  'auth/wrong-password': 'errors.invalidCredential',
  'auth/user-not-found': 'errors.invalidCredential',
  'auth/invalid-email': 'errors.invalidEmail',
  'auth/missing-email': 'errors.invalidEmail',
  'auth/email-already-in-use': 'errors.emailInUse',
  'auth/weak-password': 'errors.weakPassword',
  'auth/missing-password': 'errors.weakPassword',
  'auth/password-does-not-meet-requirements': 'errors.weakPassword',
  'auth/too-many-requests': 'errors.tooManyRequests',
  'auth/popup-blocked': 'errors.popupBlocked',
  'auth/popup-closed-by-user': 'errors.popupClosed',
  'auth/cancelled-popup-request': 'errors.popupClosed',
  'auth/operation-not-allowed': 'errors.providerDisabled',
  'auth/account-exists-with-different-credential': 'errors.accountExists',
  'auth/network-request-failed': 'errors.offline',
  'permission-denied': 'errors.permissionDenied',
  unavailable: 'errors.offline',
  'resource-exhausted': 'errors.quota',
};

/** The translation key that explains `error` to a person. */
export function errorMessageKey(error: unknown): TranslationKey {
  if (error instanceof AppError) return APP_ERRORS[error.code];
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code in FIREBASE_ERRORS) return FIREBASE_ERRORS[code];
  // The UI only says "something went wrong"; keep the details for whoever opens the console.
  console.error(error);
  return 'errors.generic';
}

/** True for a Firestore "permission-denied" error. */
export function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'permission-denied';
}
