import type { AppEnvironment } from './environment.model';

/**
 * The local environment: the Emulator Suite on the `demo-k-chat` project.
 * A `demo-` project needs no Firebase account and can never reach a real one.
 *
 * `npm start`, `npm run build` and `npm run deploy` replace this file with
 * environment.firebase.ts, which `npm run setup` writes from your own project.
 */
export const environment: AppEnvironment = {
  firebase: {
    apiKey: 'demo-api-key',
    authDomain: 'demo-k-chat.firebaseapp.com',
    projectId: 'demo-k-chat',
    appId: 'demo-app-id',
  },
  emulators: {
    authUrl: 'http://127.0.0.1:9099',
    firestoreHost: '127.0.0.1',
    firestorePort: 8180,
  },
};
