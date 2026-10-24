import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
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
  directData,
  groupData,
  limits,
  messageData,
  ROOM_ID,
  seed,
  SEEDED_AT,
  vietnameseText,
} from './support';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(() => env.cleanup());

/** Alice owns room1, Bob is a member, Carol is not. Message m1 is Bob's. */
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, async (db) => {
    await setDoc(doc(db, 'rooms', ROOM_ID), {
      ...groupData(ALICE, [ALICE, BOB]),
      lastMessage: { id: 'm1', senderId: BOB, text: 'Hello', createdAt: SEEDED_AT, deleted: false },
    });
    await setDoc(doc(db, 'rooms', ROOM_ID, 'messages', 'm1'), messageData(BOB, 'Hello'));
  });
});

function messageRef(db: Firestore, id: string) {
  return doc(db, 'rooms', ROOM_ID, 'messages', id);
}

function newMessage(senderId: string, text = 'On my way', overrides: Record<string, unknown> = {}) {
  return {
    senderId,
    text,
    createdAt: serverTimestamp(),
    editedAt: null,
    deleted: false,
    ...overrides,
  };
}

function previewOf(
  id: string,
  senderId: string,
  text: string,
  overrides: Record<string, unknown> = {},
) {
  return { id, senderId, text, createdAt: serverTimestamp(), deleted: false, ...overrides };
}

/** The batch the app writes to send: the message plus the room's preview. */
function send(
  db: Firestore,
  id: string,
  message: Record<string, unknown>,
  preview: Record<string, unknown>,
) {
  const batch = writeBatch(db);
  batch.set(messageRef(db, id), message);
  batch.update(doc(db, 'rooms', ROOM_ID), {
    lastMessage: preview,
    lastActivityAt: serverTimestamp(),
  });
  return batch.commit();
}

describe('messages: send', () => {
  it('allows a member to send and refresh the preview', async () => {
    const db = dbAs(env, ALICE);
    await assertSucceeds(send(db, 'm2', newMessage(ALICE), previewOf('m2', ALICE, 'On my way')));
  });

  it('denies a non-member', async () => {
    const db = dbAs(env, CAROL);
    await assertFails(setDoc(messageRef(db, 'm2'), newMessage(CAROL)));
  });

  it('denies sending as someone else', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(setDoc(messageRef(db, 'm2'), newMessage(BOB)));
  });

  it('denies an extra field', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(setDoc(messageRef(db, 'm2'), newMessage(ALICE, 'Hi', { pinned: true })));
  });

  it('counts characters, not bytes, up to the cap', async () => {
    const db = dbAs(env, ALICE);
    await assertSucceeds(
      setDoc(messageRef(db, 'm2'), newMessage(ALICE, vietnameseText(limits.messageMaxLength))),
    );
  });

  it('denies text over the cap, or blank text', async () => {
    const db = dbAs(env, ALICE);
    const tooLong = 'a'.repeat(limits.messageMaxLength + 1);
    await assertFails(setDoc(messageRef(db, 'm2'), newMessage(ALICE, tooLong)));
    await assertFails(setDoc(messageRef(db, 'm3'), newMessage(ALICE, ' \n ')));
  });

  it('denies a client-chosen time or a pre-edited message', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(
      setDoc(messageRef(db, 'm2'), newMessage(ALICE, 'Hi', { createdAt: SEEDED_AT })),
    );
    await assertFails(
      setDoc(messageRef(db, 'm3'), newMessage(ALICE, 'Hi', { editedAt: serverTimestamp() })),
    );
  });

  it('denies a preview that does not copy the message', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(
      send(db, 'm2', newMessage(ALICE, 'Hi'), previewOf('m2', ALICE, 'Something else')),
    );
  });

  it('denies an extra field in the preview', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(
      send(db, 'm2', newMessage(ALICE, 'Hi'), previewOf('m2', ALICE, 'Hi', { bold: true })),
    );
  });

  it('denies pointing the preview at an older message', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(
      updateDoc(doc(db, 'rooms', ROOM_ID), {
        lastMessage: previewOf('m1', BOB, 'Hello', { createdAt: SEEDED_AT }),
        lastActivityAt: serverTimestamp(),
      }),
    );
  });
});

describe('messages: read', () => {
  function page(db: Firestore, size?: number) {
    const messages = collection(db, 'rooms', ROOM_ID, 'messages');
    return size === undefined
      ? query(messages, orderBy('createdAt', 'desc'))
      : query(messages, orderBy('createdAt', 'desc'), limit(size));
  }

  it('lets a member read one page', async () => {
    await assertSucceeds(getDocs(page(dbAs(env, BOB), limits.messagePageSize)));
  });

  it('denies a query without a limit or over a page', async () => {
    await assertFails(getDocs(page(dbAs(env, BOB))));
    await assertFails(getDocs(page(dbAs(env, BOB), limits.messagePageSize + 1)));
  });

  it('denies a non-member', async () => {
    await assertFails(getDocs(page(dbAs(env, CAROL), limits.messagePageSize)));
  });
});

describe('messages: edit', () => {
  it('allows the sender to edit and refresh the preview', async () => {
    const db = dbAs(env, BOB);
    const batch = writeBatch(db);
    batch.update(messageRef(db, 'm1'), { text: 'Hello all', editedAt: serverTimestamp() });
    batch.update(doc(db, 'rooms', ROOM_ID), {
      lastMessage: previewOf('m1', BOB, 'Hello all', { createdAt: SEEDED_AT }),
    });
    await assertSucceeds(batch.commit());
  });

  it("denies editing someone else's message", async () => {
    const db = dbAs(env, ALICE);
    await assertFails(
      updateDoc(messageRef(db, 'm1'), { text: 'Bye', editedAt: serverTimestamp() }),
    );
  });

  it("denies rewriting someone else's preview", async () => {
    const db = dbAs(env, ALICE);
    await assertFails(
      updateDoc(doc(db, 'rooms', ROOM_ID), {
        lastMessage: previewOf('m1', BOB, 'Bye', { createdAt: SEEDED_AT }),
      }),
    );
  });

  it('denies an extra field', async () => {
    const db = dbAs(env, BOB);
    await assertFails(
      updateDoc(messageRef(db, 'm1'), { text: 'Hi', editedAt: serverTimestamp(), pinned: true }),
    );
  });

  it('denies changing the sender', async () => {
    const db = dbAs(env, BOB);
    await assertFails(updateDoc(messageRef(db, 'm1'), { senderId: ALICE }));
  });
});

describe('messages: delete', () => {
  it('allows the sender to soft-delete', async () => {
    const db = dbAs(env, BOB);
    await assertSucceeds(updateDoc(messageRef(db, 'm1'), { text: '', deleted: true }));
  });

  it('denies a soft delete that keeps the text', async () => {
    const db = dbAs(env, BOB);
    await assertFails(updateDoc(messageRef(db, 'm1'), { deleted: true }));
  });

  it('denies an extra field on a soft delete', async () => {
    const db = dbAs(env, BOB);
    await assertFails(updateDoc(messageRef(db, 'm1'), { text: '', deleted: true, reason: 'x' }));
  });

  it('denies editing a deleted message', async () => {
    const db = dbAs(env, BOB);
    await assertSucceeds(updateDoc(messageRef(db, 'm1'), { text: '', deleted: true }));
    await assertFails(
      updateDoc(messageRef(db, 'm1'), { text: 'Back', editedAt: serverTimestamp() }),
    );
  });

  it('allows only the group owner to hard-delete', async () => {
    await assertFails(deleteDoc(messageRef(dbAs(env, BOB), 'm1')));
    await assertSucceeds(deleteDoc(messageRef(dbAs(env, ALICE), 'm1')));
  });

  it('lets the owner hard-delete a full page in one batch', async () => {
    await seed(env, async (db) => {
      for (let i = 0; i < limits.messagePageSize; i++) {
        await setDoc(messageRef(db, `bulk${i}`), messageData(BOB, `#${i}`));
      }
    });
    const db = dbAs(env, ALICE);
    const batch = writeBatch(db);
    for (let i = 0; i < limits.messagePageSize; i++) batch.delete(messageRef(db, `bulk${i}`));
    await assertSucceeds(batch.commit());
  });

  it('denies hard deletes in a 1-to-1 room', async () => {
    const pair = `${ALICE}_${BOB}`;
    await seed(env, async (db) => {
      await setDoc(doc(db, 'rooms', pair), directData([ALICE, BOB]));
      await setDoc(doc(db, 'rooms', pair, 'messages', 'd1'), messageData(ALICE));
    });
    await assertFails(deleteDoc(doc(dbAs(env, ALICE), 'rooms', pair, 'messages', 'd1')));
  });
});

describe('messages: reactions', () => {
  function react(db: Firestore, uid: string, value: unknown) {
    return updateDoc(messageRef(db, 'm1'), new FieldPath('reactions', uid), value);
  }

  it("allows a member to react to anyone's message, with Unicode or custom emoji", async () => {
    const db = dbAs(env, ALICE);
    await assertSucceeds(react(db, ALICE, arrayUnion('👍')));
    await assertSucceeds(react(db, ALICE, arrayUnion(':party:')));
    await assertSucceeds(react(db, ALICE, arrayUnion('👨‍👩‍👧')));
    await assertSucceeds(react(db, ALICE, arrayUnion('1️⃣')));
  });

  it('allows taking a reaction back, down to no entry at all', async () => {
    await seed(env, (db) => updateDoc(messageRef(db, 'm1'), { reactions: { [ALICE]: ['👍'] } }));
    const db = dbAs(env, ALICE);
    await assertSucceeds(react(db, ALICE, arrayRemove('👍')));
    await assertSucceeds(react(db, ALICE, deleteField()));
  });

  it("denies changing someone else's reactions", async () => {
    await seed(env, (db) => updateDoc(messageRef(db, 'm1'), { reactions: { [BOB]: ['👍'] } }));
    const db = dbAs(env, ALICE);
    await assertFails(react(db, BOB, arrayUnion('🎉')));
    await assertFails(react(db, BOB, deleteField()));
  });

  it('denies a non-member', async () => {
    await assertFails(react(dbAs(env, CAROL), CAROL, arrayUnion('👍')));
  });

  it('denies an extra change in the same write', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(
      updateDoc(messageRef(db, 'm1'), new FieldPath('reactions', ALICE), ['👍'], 'text', 'Hi'),
    );
  });

  it('denies duplicates, and more reactions than the cap', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(react(db, ALICE, ['👍', '👍']));
    const many = ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉'];
    await assertSucceeds(react(db, ALICE, many.slice(0, limits.messageReactionsPerUser)));
    await assertFails(react(db, ALICE, many.slice(0, limits.messageReactionsPerUser + 1)));
  });

  it('denies reactions that are not emoji', async () => {
    const db = dbAs(env, ALICE);
    for (const value of [['ok'], [':Bad:'], ['👍 👎'], ['👍,👎'], [''], [42], 'not a list']) {
      await assertFails(react(db, ALICE, value));
    }
  });

  it('denies reacting to a deleted message', async () => {
    await seed(env, (db) => updateDoc(messageRef(db, 'm1'), { text: '', deleted: true }));
    await assertFails(react(dbAs(env, ALICE), ALICE, arrayUnion('👍')));
  });
});
