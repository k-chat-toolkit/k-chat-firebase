import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayRemove,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ALICE, BOB, CAROL, createTestEnv, dbAs, directData, profileData, seed } from './support';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, async (db) => {
    await setDoc(doc(db, 'users', ALICE), profileData('Alice'));
    await setDoc(doc(db, 'users', BOB), profileData('Bob'));
  });
});

const PAIR_ID = `${ALICE}_${BOB}`;

function newDirect(memberIds: string[], overrides: Record<string, unknown> = {}) {
  return {
    type: 'direct',
    memberIds,
    lastMessage: null,
    createdAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    ...overrides,
  };
}

describe('direct rooms: create', () => {
  it('allows either member to open the pair room', async () => {
    await assertSucceeds(setDoc(doc(dbAs(env, BOB), 'rooms', PAIR_ID), newDirect([ALICE, BOB])));
  });

  it('denies unsorted member ids', async () => {
    await assertFails(
      setDoc(doc(dbAs(env, ALICE), 'rooms', `${BOB}_${ALICE}`), newDirect([BOB, ALICE])),
    );
  });

  it('denies an id that does not match the members', async () => {
    await assertFails(setDoc(doc(dbAs(env, ALICE), 'rooms', 'dm1'), newDirect([ALICE, BOB])));
  });

  it('denies a room between two other users', async () => {
    await assertFails(setDoc(doc(dbAs(env, CAROL), 'rooms', PAIR_ID), newDirect([ALICE, BOB])));
  });

  it('denies a partner without a profile', async () => {
    await assertFails(
      setDoc(doc(dbAs(env, ALICE), 'rooms', `${ALICE}_${CAROL}`), newDirect([ALICE, CAROL])),
    );
  });

  it('denies a room with yourself', async () => {
    await assertFails(
      setDoc(doc(dbAs(env, ALICE), 'rooms', `${ALICE}_${ALICE}`), newDirect([ALICE, ALICE])),
    );
  });

  it('denies an extra field', async () => {
    await assertFails(
      setDoc(doc(dbAs(env, ALICE), 'rooms', PAIR_ID), newDirect([ALICE, BOB], { name: 'x' })),
    );
  });
});

describe('direct rooms: after creation', () => {
  beforeEach(() => seed(env, (db) => setDoc(doc(db, 'rooms', PAIR_ID), directData([ALICE, BOB]))));

  it('lets both members read it', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, ALICE), 'rooms', PAIR_ID)));
    await assertSucceeds(getDoc(doc(dbAs(env, BOB), 'rooms', PAIR_ID)));
  });

  it('denies anyone else', async () => {
    await assertFails(getDoc(doc(dbAs(env, CAROL), 'rooms', PAIR_ID)));
  });

  it('denies leaving, renaming or deleting', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(updateDoc(doc(db, 'rooms', PAIR_ID), { memberIds: arrayRemove(ALICE) }));
    await assertFails(updateDoc(doc(db, 'rooms', PAIR_ID), { name: 'Us' }));
    await assertFails(deleteDoc(doc(db, 'rooms', PAIR_ID)));
  });
});
