import type { FirebaseOptions } from 'firebase/app';

/** Where the local Emulator Suite listens. Keep in sync with `emulators` in firebase.json. */
export interface EmulatorHosts {
  readonly authUrl: string;
  readonly firestoreHost: string;
  readonly firestorePort: number;
}

export interface AppEnvironment {
  /** The web app config from the Firebase console: Project settings → General → Your apps. */
  readonly firebase: FirebaseOptions;
  /** When set, the app talks to the Emulator Suite instead of the project in `firebase`. */
  readonly emulators?: EmulatorHosts;
}
