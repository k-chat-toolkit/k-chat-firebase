import {
  computed,
  inject,
  Injectable,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  catchError,
  filter,
  firstValueFrom,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { docSnapshots } from '@core/firebase/snapshots';
import { FIRESTORE } from '@core/firebase/firebase.providers';
import { profileFromSnapshot, type UserProfile } from '@core/models/user-profile';

/** `profile` is undefined while loading and null when the user has no profile yet. */
interface MyProfileState {
  readonly uid: string | null;
  readonly profile: UserProfile | null | undefined;
}

const STARTING: MyProfileState = { uid: null, profile: undefined };

/**
 * Profiles: one realtime listener on your own profile, and a one-time fetch,
 * cached for the session, for everyone else you see.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly db = inject(FIRESTORE);
  private readonly auth = inject(AuthService);
  private readonly others = new Map<string, WritableSignal<UserProfile | null | undefined>>();

  private readonly myState$ = toObservable(this.auth.user).pipe(
    switchMap((user) => {
      if (user === undefined) return of(STARTING);
      if (user === null) return of<MyProfileState>({ uid: null, profile: null });
      return docSnapshots(doc(this.db, 'users', user.uid)).pipe(
        map((snapshot): MyProfileState => ({
          uid: user.uid,
          profile: profileFromSnapshot(snapshot),
        })),
        tap(({ profile }) => profile && this.entry(profile.uid).set(profile)),
        startWith<MyProfileState>({ uid: user.uid, profile: undefined }),
        catchError(() => of<MyProfileState>({ uid: user.uid, profile: null })),
      );
    }),
    // One Firestore listener, however many subscribers.
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  private readonly myState = toSignal(this.myState$, { initialValue: STARTING });

  /** Your own profile, live. */
  readonly me = computed(() => this.myState().profile);

  /** Waits for the profile of the signed-in `uid`: the profile, or null if it has none yet. */
  loadMine(uid: string): Promise<UserProfile | null> {
    return firstValueFrom(
      this.myState$.pipe(
        filter((state) => state.uid === uid && state.profile !== undefined),
        map((state) => state.profile ?? null),
      ),
    );
  }

  /** Someone's profile: undefined while loading, null if it does not exist. One read per session. */
  profile(uid: string): Signal<UserProfile | null | undefined> {
    const known = this.others.get(uid);
    if (known) return known;
    const entry = this.entry(uid);
    getDoc(doc(this.db, 'users', uid)).then(
      (snapshot) => entry.set(profileFromSnapshot(snapshot)),
      () => entry.set(null),
    );
    return entry;
  }

  /** Creates your profile on first use, renames it afterwards. */
  async saveMyDisplayName(displayName: string): Promise<void> {
    const ref = doc(this.db, 'users', this.auth.requireUid());
    if (this.me()) {
      await updateDoc(ref, { displayName, updatedAt: serverTimestamp() });
    } else {
      // Mirrors `match /users/{uid}` → `allow create` in firestore.rules.
      await setDoc(ref, {
        displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  private entry(uid: string): WritableSignal<UserProfile | null | undefined> {
    let entry = this.others.get(uid);
    if (!entry) {
      entry = signal<UserProfile | null | undefined>(undefined);
      this.others.set(uid, entry);
    }
    return entry;
  }
}
