import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import type { AppEnvironment } from '@env/environment.model';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');
export const FIRESTORE = new InjectionToken<Firestore>('FIRESTORE');

/**
 * Provides the Firebase app, Authentication and Firestore from the plain JS SDK.
 *
 * Firestore keeps a persistent cache shared by all tabs: reopening the app
 * shows cached data at once, and a listener that resumes within 30 minutes is
 * billed only for the documents that changed.
 */
export function provideFirebase(environment: AppEnvironment): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: FIREBASE_APP, useFactory: () => initializeApp(environment.firebase) },
    {
      provide: FIREBASE_AUTH,
      deps: [FIREBASE_APP],
      useFactory: (app: FirebaseApp) => {
        const auth = initializeAuth(app, {
          persistence: [indexedDBLocalPersistence, browserLocalPersistence],
          popupRedirectResolver: browserPopupRedirectResolver,
        });
        if (environment.emulators) {
          connectAuthEmulator(auth, environment.emulators.authUrl, { disableWarnings: true });
        }
        return auth;
      },
    },
    {
      provide: FIRESTORE,
      deps: [FIREBASE_APP],
      useFactory: (app: FirebaseApp) => {
        const db = initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
          // Against the local emulator the streaming transport can stall for many seconds
          // before the SDK falls back on its own; long polling answers at once. Production
          // keeps the default, which detects the right transport by itself.
          ...(environment.emulators ? { experimentalForceLongPolling: true } : {}),
        });
        if (environment.emulators) {
          const { firestoreHost, firestorePort } = environment.emulators;
          connectFirestoreEmulator(db, firestoreHost, firestorePort);
        }
        return db;
      },
    },
  ]);
}
