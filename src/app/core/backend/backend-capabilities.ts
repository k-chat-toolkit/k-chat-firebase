import { InjectionToken } from '@angular/core';

/**
 * Declares which features the active backend implementation supports.
 *
 * This contract enables the shared Angular frontend to work identically across
 * multiple BaaS backends (Firebase, Supabase, Convex, PocketBase), while gracefully
 * hiding or disabling features that are unsupported or omitted to preserve free-tier
 * limits (such as Firestore Spark write quotas or lack of binary storage).
 */
export interface BackendCapabilities {
  /** Identifier of the active backend provider */
  readonly id: 'firebase' | 'supabase' | 'convex' | 'pocketbase';
  /** Human-readable display name of the provider and tier */
  readonly name: string;
  /** Binary file and media attachments (e.g. S3 or Storage bucket) */
  readonly attachments: boolean;
  /** Real-time live typing indicators without exhausting database write quotas */
  readonly typingIndicator: boolean;
  /** Real-time user online/offline presence status */
  readonly presence: boolean;
  /** Custom emoji uploads (Base64 data URLs in Firestore or dedicated bucket) */
  readonly customEmoji: boolean;
  /** Emoji reactions on chat messages */
  readonly reactions: boolean;
  /** Quoted replies */
  readonly replies: boolean;
  /** Rich formatting toolbar (Bold, Italic, Strikethrough, Code, Quote, Mentions) */
  readonly formattingToolbar: boolean;
  /** Message text editing */
  readonly editMessage: boolean;
  /** Message soft-deletion */
  readonly deleteMessage: boolean;
  /** Member @mentions */
  readonly mentions: boolean;
  /** Message pinning / bookmarking */
  readonly pinnedMessages: boolean;
}

/**
 * Default capabilities for the Firebase Spark free plan.
 *
 * Features requiring Cloud Storage or high-frequency writes (attachments, typing
 * indicators, presence) are turned off to stay safely within free quotas.
 */
export const FIREBASE_CAPABILITIES: BackendCapabilities = {
  id: 'firebase',
  name: 'Firebase Spark',
  attachments: false,
  typingIndicator: false,
  presence: false,
  customEmoji: true,
  reactions: true,
  replies: true,
  formattingToolbar: true,
  editMessage: true,
  deleteMessage: true,
  mentions: true,
  pinnedMessages: false,
};

/**
 * Injection token for the active backend capabilities.
 * Defaults to Firebase Spark so existing deployments run without changes.
 */
export const BACKEND_CAPABILITIES = new InjectionToken<BackendCapabilities>(
  'BACKEND_CAPABILITIES',
  {
    providedIn: 'root',
    factory: () => FIREBASE_CAPABILITIES,
  },
);
