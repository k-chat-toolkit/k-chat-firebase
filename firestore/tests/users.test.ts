import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  ALICE,
  BOB,
  createTestEnv,
  dbAs,
  guestDb,
  limits,
  profileData,
  seed,
  SEEDED_AT,
  vietnameseText,
} from './support';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(() => env.cleanup());

beforeEach(() => env.clearFirestore());

function newProfile(displayName: string) {
  return { displayName, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
}

describe('users: read', () => {
  beforeEach(() => seed(env, (db) => setDoc(doc(db, 'users', BOB), profileData('Bob'))));

  it('lets a signed-in user fetch any profile', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, ALICE), 'users', BOB)));
  });

  it('denies a guest', async () => {
    await assertFails(getDoc(doc(guestDb(env), 'users', BOB)));
  });

  it('denies listing profiles', async () => {
    await assertFails(getDocs(collection(dbAs(env, ALICE), 'users')));
  });
});

describe('users: create', () => {
  it('allows creating your own profile', async () => {
    await assertSucceeds(setDoc(doc(dbAs(env, ALICE), 'users', ALICE), newProfile('Alice')));
  });

  it("denies creating someone else's profile", async () => {
    await assertFails(setDoc(doc(dbAs(env, ALICE), 'users', BOB), newProfile('Bob')));
  });

  it('denies an extra field', async () => {
    await assertFails(
      setDoc(doc(dbAs(env, ALICE), 'users', ALICE), {
        ...newProfile('Alice'),
        email: 'a@example.com',
      }),
    );
  });

  it('denies a missing field', async () => {
    await assertFails(
      setDoc(doc(dbAs(env, ALICE), 'users', ALICE), {
        displayName: 'Alice',
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('counts characters, not bytes, up to the cap', async () => {
    const name = vietnameseText(limits.displayNameMaxLength);
    await assertSucceeds(setDoc(doc(dbAs(env, ALICE), 'users', ALICE), newProfile(name)));
  });

  it('denies a name over the cap', async () => {
    const name = 'a'.repeat(limits.displayNameMaxLength + 1);
    await assertFails(setDoc(doc(dbAs(env, ALICE), 'users', ALICE), newProfile(name)));
  });

  it('denies a blank or untrimmed name', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(setDoc(doc(db, 'users', ALICE), newProfile('   ')));
    await assertFails(setDoc(doc(db, 'users', ALICE), newProfile(' Alice')));
  });

  it('denies a client-chosen timestamp', async () => {
    await assertFails(
      setDoc(doc(dbAs(env, ALICE), 'users', ALICE), {
        displayName: 'Alice',
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
      }),
    );
  });
});

describe('users: update and delete', () => {
  beforeEach(() => seed(env, (db) => setDoc(doc(db, 'users', ALICE), profileData('Alice'))));

  it('allows renaming yourself', async () => {
    await assertSucceeds(
      updateDoc(doc(dbAs(env, ALICE), 'users', ALICE), {
        displayName: 'Alice N.',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies renaming someone else', async () => {
    await assertFails(
      updateDoc(doc(dbAs(env, BOB), 'users', ALICE), {
        displayName: 'Mallory',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies an extra field', async () => {
    await assertFails(
      updateDoc(doc(dbAs(env, ALICE), 'users', ALICE), {
        displayName: 'Alice',
        updatedAt: serverTimestamp(),
        role: 'admin',
      }),
    );
  });

  it('denies rewriting createdAt', async () => {
    await assertFails(
      updateDoc(doc(dbAs(env, ALICE), 'users', ALICE), {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies deleting a profile', async () => {
    await assertFails(deleteDoc(doc(dbAs(env, ALICE), 'users', ALICE)));
  });
});
