/** Everyone who reacted to a message with one emoji. */
export interface ReactionGroup {
  /** A Unicode emoji, or ":name:" for a custom one. */
  readonly key: string;
  readonly uids: readonly string[];
  /** Whether you are one of them. */
  readonly mine: boolean;
}

/**
 * Groups a message's reactions by emoji. Firestore keeps no time per reaction, so
 * the chips are sorted by emoji: the order is the same for everyone, and a chip
 * never moves when someone else reacts.
 */
export function groupReactions(
  reactions: Readonly<Record<string, readonly string[]>>,
  myUid: string,
): ReactionGroup[] {
  const byKey = new Map<string, string[]>();
  for (const uid of Object.keys(reactions).sort()) {
    for (const key of reactions[uid]) {
      const uids = byKey.get(key);
      if (uids) uids.push(uid);
      else byKey.set(key, [uid]);
    }
  }
  return [...byKey]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, uids]) => ({ key, uids, mine: uids.includes(myUid) }));
}
