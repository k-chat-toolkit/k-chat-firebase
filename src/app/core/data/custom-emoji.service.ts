import {
  computed,
  inject,
  Injectable,
  signal,
  untracked,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { AuthService } from '@core/auth/auth.service';
import { AppError } from '@core/errors/app-error';
import { FIRESTORE } from '@core/firebase/firebase.providers';
import { LIMITS } from '@core/limits';
import { customEmojiFromSnapshot, type CustomEmoji } from '@core/models/custom-emoji';

/**
 * The app's custom emoji. Nothing here listens live:
 * - an emoji seen in a message is fetched once per session, by name;
 * - the whole list is fetched once per session, only when the picker or the
 *   emoji page needs it. The cap (LIMITS.customEmojiMax) keeps it to one page.
 */
@Injectable({ providedIn: 'root' })
export class CustomEmojiService {
  private readonly db = inject(FIRESTORE);
  private readonly auth = inject(AuthService);
  private readonly byName = new Map<string, WritableSignal<CustomEmoji | null | undefined>>();
  private readonly catalogState = signal<readonly CustomEmoji[] | undefined>(undefined);
  private catalogRequest: Promise<void> | null = null;
  private readonly adminState = signal<{ readonly uid: string; readonly admin: boolean } | null>(
    null,
  );

  /** Every custom emoji, sorted by name; undefined until loadCatalog() answers. */
  readonly catalog = this.catalogState.asReadonly();

  /** Whether you may delete anyone's emoji. Known after checkAdmin(). */
  readonly isAdmin = computed(() => {
    const state = this.adminState();
    return state !== null && state.admin && state.uid === this.auth.user()?.uid;
  });

  /** One emoji: undefined while loading, null if there is none by that name. */
  emoji(name: string): Signal<CustomEmoji | null | undefined> {
    const known = this.byName.get(name);
    if (known) return known;
    // Templates call this while rendering, so the catalog is read without tracking it.
    const catalog = untracked(this.catalogState);
    const entry = signal<CustomEmoji | null | undefined>(
      catalog ? (catalog.find((emoji) => emoji.name === name) ?? null) : undefined,
    );
    this.byName.set(name, entry);
    if (!catalog) {
      getDoc(doc(this.db, 'customEmoji', name)).then(
        (snapshot) => entry.set(customEmojiFromSnapshot(snapshot)),
        () => entry.set(null),
      );
    }
    return entry;
  }

  /** Fetches every custom emoji, once per session unless `refresh` is set. */
  loadCatalog(refresh = false): Promise<void> {
    if (this.catalogRequest && !refresh) return this.catalogRequest;
    const request = getDocs(
      query(
        collection(this.db, 'customEmoji'),
        orderBy(documentId()),
        limit(LIMITS.customEmojiMax),
      ),
    ).then((snapshot) => {
      const list = snapshot.docs
        .map((document) => customEmojiFromSnapshot(document))
        .filter((emoji): emoji is CustomEmoji => emoji !== null);
      this.setCatalog(list);
    });
    this.catalogRequest = request.catch((error) => {
      this.catalogRequest = null;
      throw error;
    });
    return this.catalogRequest;
  }

  /** Looks up whether you are listed in admins/{uid}. Rules: admins `allow get`. */
  async checkAdmin(): Promise<void> {
    const uid = this.auth.requireUid();
    const snapshot = await getDoc(doc(this.db, 'admins', uid));
    this.adminState.set({ uid, admin: snapshot.exists() });
  }

  /**
   * Adds an emoji and moves the counter, in one transaction.
   * Rules: customEmoji `allow create` + meta/customEmoji `allow create` or `allow update`.
   */
  async add(name: string, image: string): Promise<void> {
    const uid = this.auth.requireUid();
    const emojiRef = doc(this.db, 'customEmoji', name);
    const counterRef = doc(this.db, 'meta', 'customEmoji');
    await runTransaction(this.db, async (transaction) => {
      const existing = await transaction.get(emojiRef);
      const counter = await transaction.get(counterRef);
      if (existing.exists()) throw new AppError('emoji-name-taken');
      const count = counter.exists() ? Number(counter.data()['count']) : 0;
      if (count >= LIMITS.customEmojiMax) throw new AppError('emoji-limit');
      transaction.set(emojiRef, { image, createdBy: uid, createdAt: serverTimestamp() });
      transaction.set(counterRef, { count: count + 1, lastName: name });
    });
    const added: CustomEmoji = { name, image, createdBy: uid, createdAt: Timestamp.now() };
    const catalog = this.catalogState();
    if (catalog) this.setCatalog([...catalog.filter((emoji) => emoji.name !== name), added]);
    else this.entry(name).set(added);
  }

  /**
   * Deletes an emoji and moves the counter back, in one transaction.
   * Rules: customEmoji `allow delete` (its creator or an admin) + meta/customEmoji `allow update`.
   */
  async remove(emoji: CustomEmoji): Promise<void> {
    const emojiRef = doc(this.db, 'customEmoji', emoji.name);
    const counterRef = doc(this.db, 'meta', 'customEmoji');
    await runTransaction(this.db, async (transaction) => {
      const counter = await transaction.get(counterRef);
      const count = counter.exists() ? Number(counter.data()['count']) : 1;
      transaction.delete(emojiRef);
      transaction.set(counterRef, { count: count - 1, lastName: emoji.name });
    });
    const catalog = this.catalogState();
    if (catalog) this.setCatalog(catalog.filter((item) => item.name !== emoji.name));
    else this.entry(emoji.name).set(null);
  }

  private setCatalog(list: readonly CustomEmoji[]): void {
    const sorted = [...list].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    this.catalogState.set(sorted);
    const names = new Map(sorted.map((emoji) => [emoji.name, emoji]));
    for (const emoji of sorted) this.entry(emoji.name).set(emoji);
    for (const [name, entry] of this.byName) if (!names.has(name)) entry.set(null);
  }

  private entry(name: string): WritableSignal<CustomEmoji | null | undefined> {
    let entry = this.byName.get(name);
    if (!entry) {
      entry = signal<CustomEmoji | null | undefined>(undefined);
      this.byName.set(name, entry);
    }
    return entry;
  }
}
