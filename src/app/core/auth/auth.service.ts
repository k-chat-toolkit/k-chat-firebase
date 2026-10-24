import { effect, inject, Injectable, signal } from '@angular/core';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { FIREBASE_AUTH } from '@core/firebase/firebase.providers';
import { I18nService } from '@core/i18n/i18n.service';

/** The signed-in user; `undefined` until Firebase has restored the session. */
export type AuthState = User | null | undefined;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly i18n = inject(I18nService);

  private readonly state = signal<AuthState>(undefined);

  /** The signed-in user, `null` when signed out, `undefined` while starting up. */
  readonly user = this.state.asReadonly();

  constructor() {
    onAuthStateChanged(this.auth, (user) => this.state.set(user));
    // Password reset emails follow the UI language.
    effect(() => {
      this.auth.languageCode = this.i18n.locale();
    });
  }

  /** Resolves once Firebase has restored the session: the user, or null. */
  async ready(): Promise<User | null> {
    await this.auth.authStateReady();
    return this.auth.currentUser;
  }

  /** The signed-in user's uid. Only call it behind the auth guard. */
  requireUid(): string {
    const user = this.auth.currentUser;
    if (!user) throw new Error('No signed-in user.');
    return user.uid;
  }

  async signIn(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email.trim(), password);
  }

  async signUp(email: string, password: string): Promise<void> {
    await createUserWithEmailAndPassword(this.auth, email.trim(), password);
  }

  async signInWithGoogle(): Promise<void> {
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  /** Resolves even when no account exists, so the UI cannot reveal who has one. */
  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email.trim());
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    }
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }
}
