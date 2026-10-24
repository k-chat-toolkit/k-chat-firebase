import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'k-chat.recent-emoji';
const MAX_RECENT = 27;

/** Offered as quick reactions until you have used some emoji yourself. */
const DEFAULT_QUICK_REACTIONS = ['👍', '❤️', '😂'];

/**
 * The emoji you used last, newest first, kept in this browser's localStorage:
 * remembering them costs no Firestore write.
 */
@Injectable({ providedIn: 'root' })
export class RecentEmojiService {
  private readonly state = signal<readonly string[]>(load());

  /** Keys as stored in messages: Unicode emoji, or ":name:" for custom ones. */
  readonly recent = this.state.asReadonly();

  /**
   * Three emoji for the message toolbar, as in Slack: the latest you used, topped
   * up with defaults. `isAvailable` drops a custom emoji deleted since.
   */
  quickReactions(isAvailable: (key: string) => boolean): string[] {
    return [...this.state(), ...DEFAULT_QUICK_REACTIONS]
      .filter((key, index, all) => all.indexOf(key) === index && isAvailable(key))
      .slice(0, 3);
  }

  use(key: string): void {
    const next = [key, ...this.state().filter((item) => item !== key)].slice(0, MAX_RECENT);
    this.state.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can be blocked (private mode); the list then lasts for this visit only.
    }
  }
}

function load(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}
