import type { AppEnvironment } from './environment.model';

/**
 * Template for environment.firebase.ts, the config of your own Firebase project.
 *
 * `npm run setup` writes environment.firebase.ts for you. To write it by hand,
 * copy this file to environment.firebase.ts and paste the values from the
 * Firebase console: Project settings → General → Your apps → SDK setup and
 * configuration → Config.
 *
 * These values identify your project; they are not secrets. The security rules
 * protect the data. The real file is still gitignored, because it belongs to
 * whoever cloned the repository.
 */
export const environment: AppEnvironment = {
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    appId: 'YOUR_APP_ID',
    messagingSenderId: 'YOUR_SENDER_ID',
  },
};
