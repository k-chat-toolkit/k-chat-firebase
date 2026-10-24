import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  ALICE,
  BOB,
  CAROL,
  createTestEnv,
  dbAs,
  emojiData,
  EMOJI_IMAGE,
  guestDb,
  limits,
  seed,
  SEEDED_AT,
} from './support';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(() => env.cleanup());

/** Bob added :party:, so the count is 1. Carol is an admin. */
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, async (db) => {
    await setDoc(doc(db, 'customEmoji', 'party'), emojiData(BOB));
    await setDoc(doc(db, 'meta', 'customEmoji'), { count: 1, lastName: 'party' });
    await setDoc(doc(db, 'admins', CAROL), { addedAt: SEEDED_AT });
  });
});

function newEmoji(uid: string, overrides: Record<string, unknown> = {}) {
  return { image: EMOJI_IMAGE, createdBy: uid, createdAt: serverTimestamp(), ...overrides };
}

/** The batch the app writes to add an emoji: the emoji plus the moved counter. */
function add(
  db: Firestore,
  name: string,
  emoji: Record<string, unknown>,
  counter: Record<string, unknown> = { count: 2, lastName: name },
) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'customEmoji', name), emoji);
  batch.set(doc(db, 'meta', 'customEmoji'), counter);
  return batch.commit();
}

function remove(
  db: Firestore,
  name: string,
  counter: Record<string, unknown> = { count: 0, lastName: name },
) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'customEmoji', name));
  batch.set(doc(db, 'meta', 'customEmoji'), counter);
  return batch.commit();
}

describe('custom emoji: add', () => {
  it('allows anyone signed in to add one and move the counter', async () => {
    await assertSucceeds(add(dbAs(env, ALICE), 'tada', newEmoji(ALICE)));
  });

  it('allows the first emoji to create the counter', async () => {
    await env.clearFirestore();
    const db = dbAs(env, ALICE);
    await assertSucceeds(add(db, 'tada', newEmoji(ALICE), { count: 1, lastName: 'tada' }));
  });

  it('denies a guest', async () => {
    await assertFails(add(guestDb(env), 'tada', newEmoji(ALICE)));
  });

  it('denies an emoji without the counter, or the counter without an emoji', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(setDoc(doc(db, 'customEmoji', 'tada'), newEmoji(ALICE)));
    await assertFails(setDoc(doc(db, 'meta', 'customEmoji'), { count: 2, lastName: 'tada' }));
  });

  it('denies a counter that skips, or names another emoji', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(add(db, 'tada', newEmoji(ALICE), { count: 3, lastName: 'tada' }));
    await assertFails(add(db, 'tada', newEmoji(ALICE), { count: 2, lastName: 'other' }));
  });

  it('denies re-adding the last deleted name without moving the counter', async () => {
    await assertSucceeds(remove(dbAs(env, BOB), 'party'));
    await assertFails(setDoc(doc(dbAs(env, ALICE), 'customEmoji', 'party'), newEmoji(ALICE)));
  });

  it('denies a name that is taken', async () => {
    await assertFails(add(dbAs(env, ALICE), 'party', newEmoji(ALICE)));
  });

  it('denies an extra field, on the emoji or on the counter', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(add(db, 'tada', newEmoji(ALICE, { label: 'Tada' })));
    await assertFails(add(db, 'tada', newEmoji(ALICE), { count: 2, lastName: 'tada', x: 1 }));
  });

  it('denies adding as someone else, or with a client-chosen time', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(add(db, 'tada', newEmoji(BOB)));
    await assertFails(add(db, 'tada', newEmoji(ALICE, { createdAt: SEEDED_AT })));
  });

  it('denies names Slack would refuse, and names over the cap', async () => {
    const db = dbAs(env, ALICE);
    const tooLong = 'a'.repeat(limits.emojiNameMaxLength + 1);
    for (const name of ['Tada', 'ta da', 'tada!', tooLong]) {
      await assertFails(add(db, name, newEmoji(ALICE)));
    }
    const longest = 'a'.repeat(limits.emojiNameMaxLength);
    await assertSucceeds(add(db, longest, newEmoji(ALICE)));
  });

  it('denies an image that is not a small base64 PNG, GIF, WebP or JPEG', async () => {
    const db = dbAs(env, ALICE);
    const svg = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
    const notBase64 = 'data:image/png;base64,<script>';
    const tooBig = `data:image/png;base64,${'A'.repeat(limits.emojiImageMaxLength)}`;
    for (const image of [svg, notBase64, tooBig, 'https://example.com/a.png', 42]) {
      await assertFails(add(db, 'tada', newEmoji(ALICE, { image })));
    }
  });

  it('denies going over the cap', async () => {
    await seed(env, (db) =>
      setDoc(doc(db, 'meta', 'customEmoji'), { count: limits.customEmojiMax, lastName: 'party' }),
    );
    const db = dbAs(env, ALICE);
    await assertFails(
      add(db, 'tada', newEmoji(ALICE), { count: limits.customEmojiMax + 1, lastName: 'tada' }),
    );
  });
});

describe('custom emoji: delete', () => {
  it('allows the person who added it', async () => {
    await assertSucceeds(remove(dbAs(env, BOB), 'party'));
  });

  it('allows an admin', async () => {
    await assertSucceeds(remove(dbAs(env, CAROL), 'party'));
  });

  it('denies anyone else', async () => {
    await assertFails(remove(dbAs(env, ALICE), 'party'));
  });

  it('denies a delete that leaves the counter as it was', async () => {
    const db = dbAs(env, BOB);
    await assertFails(remove(db, 'party', { count: 1, lastName: 'party' }));
  });
});

describe('custom emoji: read', () => {
  it('lets anyone signed in fetch one, or list a capped page', async () => {
    const db = dbAs(env, ALICE);
    await assertSucceeds(getDoc(doc(db, 'customEmoji', 'party')));
    await assertSucceeds(getDoc(doc(db, 'meta', 'customEmoji')));
    await assertSucceeds(
      getDocs(query(collection(db, 'customEmoji'), limit(limits.customEmojiMax))),
    );
  });

  it('denies an uncapped list, or a guest', async () => {
    await assertFails(getDocs(collection(dbAs(env, ALICE), 'customEmoji')));
    await assertFails(getDoc(doc(guestDb(env), 'customEmoji', 'party')));
  });
});

describe('admins', () => {
  it('lets people check their own entry only', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, CAROL), 'admins', CAROL)));
    await assertSucceeds(getDoc(doc(dbAs(env, ALICE), 'admins', ALICE)));
    await assertFails(getDoc(doc(dbAs(env, ALICE), 'admins', CAROL)));
  });

  it('denies making yourself an admin', async () => {
    await assertFails(setDoc(doc(dbAs(env, ALICE), 'admins', ALICE), { addedAt: SEEDED_AT }));
  });
});
