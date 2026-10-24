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
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
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
  groupData,
  guestDb,
  INVITE_CODE,
  inviteData,
  limits,
  ROOM_ID,
  seed,
} from './support';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(() => env.cleanup());

beforeEach(() => env.clearFirestore());

/** Alice owns room1 with Bob as a member; its invite code is INVITE_CODE. */
function seedGroup(memberIds = [ALICE, BOB]) {
  return seed(env, async (db) => {
    await setDoc(doc(db, 'rooms', ROOM_ID), groupData(ALICE, memberIds));
    await setDoc(doc(db, 'invites', INVITE_CODE), inviteData(ROOM_ID, ALICE));
  });
}

function newGroup(ownerId: string, overrides: Record<string, unknown> = {}) {
  return {
    type: 'group',
    name: 'Riders',
    ownerId,
    memberIds: [ownerId],
    inviteCode: INVITE_CODE,
    lastJoin: null,
    lastMessage: null,
    createdAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    ...overrides,
  };
}

function newInvite(createdBy: string, overrides: Record<string, unknown> = {}) {
  return { roomId: ROOM_ID, createdBy, createdAt: serverTimestamp(), ...overrides };
}

/** The batch the app writes to create a group: the room and its invite together. */
function createGroup(
  db: Firestore,
  room: Record<string, unknown>,
  invite: Record<string, unknown>,
  code = INVITE_CODE,
) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'rooms', ROOM_ID), room);
  batch.set(doc(db, 'invites', code), invite);
  return batch.commit();
}

describe('groups: create', () => {
  it('allows creating a group with its invite in one batch', async () => {
    await assertSucceeds(createGroup(dbAs(env, ALICE), newGroup(ALICE), newInvite(ALICE)));
  });

  it('denies a group without its invite', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(setDoc(doc(db, 'rooms', ROOM_ID), newGroup(ALICE)));
  });

  it('denies naming someone else as the owner', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(
      createGroup(db, newGroup(ALICE, { ownerId: BOB, memberIds: [BOB] }), newInvite(ALICE)),
    );
  });

  it('denies adding other members at creation', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(
      createGroup(db, newGroup(ALICE, { memberIds: [ALICE, BOB] }), newInvite(ALICE)),
    );
  });

  it('denies an extra field on the room', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(createGroup(db, newGroup(ALICE, { topic: 'x' }), newInvite(ALICE)));
  });

  it('denies an extra field on the invite', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(createGroup(db, newGroup(ALICE), newInvite(ALICE, { uses: 0 })));
  });

  it('denies a name over the cap', async () => {
    const db = dbAs(env, ALICE);
    const name = 'a'.repeat(limits.roomNameMaxLength + 1);
    await assertFails(createGroup(db, newGroup(ALICE, { name }), newInvite(ALICE)));
  });

  it('denies a malformed invite code', async () => {
    const db = dbAs(env, ALICE);
    const code = 'abcd2345';
    await assertFails(
      createGroup(db, newGroup(ALICE, { inviteCode: code }), newInvite(ALICE), code),
    );
  });
});

describe('groups: read', () => {
  beforeEach(() => seedGroup());

  it('lets a member fetch the room', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, BOB), 'rooms', ROOM_ID)));
  });

  it('denies a non-member', async () => {
    await assertFails(getDoc(doc(dbAs(env, CAROL), 'rooms', ROOM_ID)));
  });

  it('lets a user list their own rooms with a capped query', async () => {
    const db = dbAs(env, BOB);
    const mine = query(
      collection(db, 'rooms'),
      where('memberIds', 'array-contains', BOB),
      orderBy('lastActivityAt', 'desc'),
      limit(limits.roomListLimit),
    );
    await assertSucceeds(getDocs(mine));
  });

  it('denies a query without a limit or over the cap', async () => {
    const db = dbAs(env, BOB);
    const rooms = collection(db, 'rooms');
    await assertFails(getDocs(query(rooms, where('memberIds', 'array-contains', BOB))));
    await assertFails(
      getDocs(
        query(rooms, where('memberIds', 'array-contains', BOB), limit(limits.roomListLimit + 1)),
      ),
    );
  });

  it("denies listing someone else's rooms", async () => {
    const db = dbAs(env, CAROL);
    const theirs = query(
      collection(db, 'rooms'),
      where('memberIds', 'array-contains', BOB),
      limit(limits.roomListLimit),
    );
    await assertFails(getDocs(theirs));
  });
});

describe('invites', () => {
  beforeEach(() => seedGroup());

  it('lets a signed-in user fetch a code they know', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, CAROL), 'invites', INVITE_CODE)));
  });

  it('denies a guest', async () => {
    await assertFails(getDoc(doc(guestDb(env), 'invites', INVITE_CODE)));
  });

  it('denies listing codes', async () => {
    await assertFails(getDocs(query(collection(dbAs(env, CAROL), 'invites'), limit(1))));
  });

  it("denies deleting another user's invite", async () => {
    await assertFails(deleteDoc(doc(dbAs(env, BOB), 'invites', INVITE_CODE)));
  });
});

describe('groups: rename', () => {
  beforeEach(() => seedGroup());

  it('allows the owner to rename', async () => {
    await assertSucceeds(
      updateDoc(doc(dbAs(env, ALICE), 'rooms', ROOM_ID), { name: 'Night riders' }),
    );
  });

  it('denies a member', async () => {
    await assertFails(updateDoc(doc(dbAs(env, BOB), 'rooms', ROOM_ID), { name: 'Mine now' }));
  });

  it('denies an extra field', async () => {
    await assertFails(
      updateDoc(doc(dbAs(env, ALICE), 'rooms', ROOM_ID), { name: 'Night riders', topic: 'x' }),
    );
  });

  it('denies a name over the cap', async () => {
    const name = 'a'.repeat(limits.roomNameMaxLength + 1);
    await assertFails(updateDoc(doc(dbAs(env, ALICE), 'rooms', ROOM_ID), { name }));
  });
});

describe('groups: reset the invite code', () => {
  const NEW_CODE = 'WXYZ6789';

  beforeEach(() => seedGroup());

  function resetInvite(db: Firestore, invite: Record<string, unknown>, deleteOld = true) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'invites', NEW_CODE), invite);
    batch.update(doc(db, 'rooms', ROOM_ID), { inviteCode: NEW_CODE });
    if (deleteOld) batch.delete(doc(db, 'invites', INVITE_CODE));
    return batch.commit();
  }

  it('allows the owner to swap the code in one batch', async () => {
    await assertSucceeds(resetInvite(dbAs(env, ALICE), newInvite(ALICE)));
  });

  it('denies keeping the old invite alive', async () => {
    await assertFails(resetInvite(dbAs(env, ALICE), newInvite(ALICE), false));
  });

  it('denies a member', async () => {
    await assertFails(resetInvite(dbAs(env, BOB), newInvite(BOB)));
  });

  it('denies an extra field on the new invite', async () => {
    await assertFails(resetInvite(dbAs(env, ALICE), newInvite(ALICE, { note: 'x' })));
  });
});

describe('groups: membership', () => {
  beforeEach(() => seedGroup([ALICE, BOB, CAROL]));

  it('allows the owner to remove a member', async () => {
    await assertSucceeds(
      updateDoc(doc(dbAs(env, ALICE), 'rooms', ROOM_ID), { memberIds: arrayRemove(CAROL) }),
    );
  });

  it('denies a member removing another member', async () => {
    await assertFails(
      updateDoc(doc(dbAs(env, BOB), 'rooms', ROOM_ID), { memberIds: arrayRemove(CAROL) }),
    );
  });

  it('denies the owner removing themself', async () => {
    await assertFails(
      updateDoc(doc(dbAs(env, ALICE), 'rooms', ROOM_ID), { memberIds: arrayRemove(ALICE) }),
    );
  });

  it('denies an extra field with a removal', async () => {
    await assertFails(
      updateDoc(doc(dbAs(env, ALICE), 'rooms', ROOM_ID), {
        memberIds: arrayRemove(CAROL),
        kicked: [CAROL],
      }),
    );
  });

  it('allows a member to leave', async () => {
    await assertSucceeds(
      updateDoc(doc(dbAs(env, BOB), 'rooms', ROOM_ID), { memberIds: arrayRemove(BOB) }),
    );
  });

  it('denies the owner leaving', async () => {
    await assertFails(
      updateDoc(doc(dbAs(env, ALICE), 'rooms', ROOM_ID), { memberIds: arrayRemove(ALICE) }),
    );
  });

  it('denies an extra field when leaving', async () => {
    await assertFails(
      updateDoc(doc(dbAs(env, BOB), 'rooms', ROOM_ID), {
        memberIds: arrayRemove(BOB),
        note: 'bye',
      }),
    );
  });
});

describe('groups: join with an invite code', () => {
  const DAVE = 'dave';

  beforeEach(() => seedGroup());

  function join(uid: string, update: Record<string, unknown>) {
    return updateDoc(doc(dbAs(env, uid), 'rooms', ROOM_ID), update);
  }

  it('allows joining with the current code', async () => {
    await assertSucceeds(
      join(CAROL, { memberIds: arrayUnion(CAROL), lastJoin: { uid: CAROL, code: INVITE_CODE } }),
    );
  });

  it('denies a wrong code', async () => {
    await assertFails(
      join(CAROL, { memberIds: arrayUnion(CAROL), lastJoin: { uid: CAROL, code: 'WXYZ6789' } }),
    );
  });

  it('denies joining without proving the code', async () => {
    await assertFails(join(CAROL, { memberIds: arrayUnion(CAROL) }));
  });

  it("denies reusing someone else's proof", async () => {
    await assertSucceeds(
      join(CAROL, { memberIds: arrayUnion(CAROL), lastJoin: { uid: CAROL, code: INVITE_CODE } }),
    );
    await assertFails(join(DAVE, { memberIds: arrayUnion(DAVE) }));
  });

  it('denies claiming another identity in the proof', async () => {
    await assertFails(
      join(CAROL, { memberIds: arrayUnion(CAROL), lastJoin: { uid: DAVE, code: INVITE_CODE } }),
    );
  });

  it('denies adding someone else', async () => {
    await assertFails(
      join(CAROL, { memberIds: arrayUnion(DAVE), lastJoin: { uid: CAROL, code: INVITE_CODE } }),
    );
  });

  it('denies an extra field', async () => {
    await assertFails(
      join(CAROL, {
        memberIds: arrayUnion(CAROL),
        lastJoin: { uid: CAROL, code: INVITE_CODE },
        name: 'Taken over',
      }),
    );
  });

  it('denies an extra field inside the proof', async () => {
    await assertFails(
      join(CAROL, {
        memberIds: arrayUnion(CAROL),
        lastJoin: { uid: CAROL, code: INVITE_CODE, at: 1 },
      }),
    );
  });

  it('denies joining a full room', async () => {
    const full = [
      ALICE,
      ...Array.from({ length: limits.roomMaxMembers - 1 }, (_, i) => `user${i}`),
    ];
    await seed(env, (db) => setDoc(doc(db, 'rooms', ROOM_ID), groupData(ALICE, full)));
    await assertFails(
      join(CAROL, { memberIds: arrayUnion(CAROL), lastJoin: { uid: CAROL, code: INVITE_CODE } }),
    );
  });
});

describe('groups: delete', () => {
  beforeEach(() => seedGroup());

  function deleteGroup(db: Firestore, withInvite = true) {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'rooms', ROOM_ID));
    if (withInvite) batch.delete(doc(db, 'invites', INVITE_CODE));
    return batch.commit();
  }

  it('allows the owner to delete the room and its invite', async () => {
    await assertSucceeds(deleteGroup(dbAs(env, ALICE)));
  });

  it('denies leaving the invite behind', async () => {
    await assertFails(deleteGroup(dbAs(env, ALICE), false));
  });

  it('denies a member', async () => {
    await assertFails(deleteDoc(doc(dbAs(env, BOB), 'rooms', ROOM_ID)));
  });
});
