// The steps of `npm run setup`, written against small interfaces (cli, prompt,
// files, log) so a test can run the whole flow with fakes.
import {
  pickWebConfig,
  projectIdFromEnvironment,
  renderEnvironmentFile,
  renderFirebaserc,
} from './config-files.mjs';

export class SetupError extends Error {}

const APP_NAME = 'K-Chat Lite';

/**
 * Common Firestore locations. Every location has the same free quota; pick the
 * one closest to your users. The choice is permanent for the project.
 */
export const LOCATIONS = [
  { value: 'asia-southeast1', label: 'asia-southeast1 (Singapore)' },
  { value: 'asia-northeast1', label: 'asia-northeast1 (Tokyo)' },
  { value: 'asia-south1', label: 'asia-south1 (Mumbai)' },
  { value: 'australia-southeast1', label: 'australia-southeast1 (Sydney)' },
  { value: 'eur3', label: 'eur3 (Europe, multi-region)' },
  { value: 'europe-west1', label: 'europe-west1 (Belgium)' },
  { value: 'nam5', label: 'nam5 (United States, multi-region)' },
  { value: 'us-central1', label: 'us-central1 (Iowa)' },
  { value: 'southamerica-east1', label: 'southamerica-east1 (São Paulo)' },
];

/**
 * @param {object} deps
 * @param {{ json(args: string[]): Promise<any>, run(args: string[]): Promise<number> }} deps.cli
 * @param {ReturnType<import('./prompt.mjs').createPrompt>} deps.prompt
 * @param {{ read(name: 'environment' | 'firebaserc'): string | null, write(name: string, text: string): void }} deps.files
 * @param {{ step(text: string): void, info(text: string): void }} deps.log
 * @param {{ project?: string, app?: string, location?: string, yes?: boolean, skipDeploy?: boolean }} deps.options
 * @returns {Promise<{ projectId: string, appId: string }>}
 */
export async function runSetup({ cli, prompt, files, log, options }) {
  // 1. A signed-in Firebase CLI.
  log.step('Checking the Firebase CLI sign-in');
  const accounts = await cli.json(['login:list']).catch(() => null);
  if (!Array.isArray(accounts) || accounts.length === 0) {
    log.info('Not signed in yet: opening `firebase login`.');
    if ((await cli.run(['login'])) !== 0) throw new SetupError('Firebase sign-in did not finish.');
  }

  // 2. The project.
  log.step('Finding your Firebase projects');
  const projects = (await cli.json(['projects:list'])) ?? [];
  let projectId = options.project;
  if (projectId) {
    if (!projects.some((project) => project.projectId === projectId)) {
      throw new SetupError(`Your account has no project "${projectId}".`);
    }
  } else if (projects.length === 0) {
    throw new SetupError(
      'Your account has no Firebase project. Create one at https://console.firebase.google.com and run setup again.',
    );
  } else {
    projectId = await prompt.choose(
      `Which Firebase project should ${APP_NAME} use?`,
      projects.map((project) => ({
        label: project.displayName
          ? `${project.displayName} (${project.projectId})`
          : project.projectId,
        value: project.projectId,
      })),
      { flag: '--project <id>' },
    );
  }
  log.info(`Project: ${projectId}`);

  // 3. The web app.
  log.step('Finding the web app');
  const apps = (await cli.json(['apps:list', 'WEB', '--project', projectId])) ?? [];
  let appId = options.app;
  if (appId) {
    if (!apps.some((app) => app.appId === appId)) {
      throw new SetupError(`Project ${projectId} has no web app "${appId}".`);
    }
  } else if (apps.length === 1) {
    appId = apps[0].appId;
  } else if (apps.length > 1) {
    appId = await prompt.choose(
      'Which web app?',
      apps.map((app) => ({
        label: `${app.displayName ?? app.appId} (${app.appId})`,
        value: app.appId,
      })),
      { flag: '--app <appId>' },
    );
  } else {
    const create =
      options.yes ||
      (await prompt.confirm(
        `Project ${projectId} has no web app yet. Create one named "${APP_NAME}"?`,
        {
          defaultYes: true,
        },
      ));
    if (!create)
      throw new SetupError('Add a web app in the Firebase console, then run setup again.');
    appId = (await cli.json(['apps:create', 'WEB', APP_NAME, '--project', projectId]))?.appId;
    if (!appId) throw new SetupError('The Firebase CLI did not return the new app id.');
  }
  log.info(`Web app: ${appId}`);

  // 4. Its config, into the two gitignored files.
  log.step('Writing your config');
  const sdk = await cli.json(['apps:sdkconfig', 'WEB', appId, '--project', projectId]);
  const config = pickWebConfig(sdk?.sdkConfig);
  const existing = files.read('environment');
  const existingProject = existing === null ? null : projectIdFromEnvironment(existing);
  if (existingProject && existingProject !== projectId && !options.yes) {
    const replace = await prompt.confirm(
      `environment.firebase.ts points at project ${existingProject}. Replace it with ${projectId}?`,
    );
    if (!replace) throw new SetupError('Kept the existing config; nothing changed.');
  }
  files.write('environment', renderEnvironmentFile(config));
  files.write('firebaserc', renderFirebaserc(projectId));
  log.info('Wrote src/environments/environment.firebase.ts and .firebaserc.');

  // 5. The Firestore database: created here if the project has none.
  log.step('Checking the Firestore database');
  const databases =
    (await cli.json(['firestore:databases:list', '--project', projectId]).catch(() => [])) ?? [];
  const defaultDatabase = databases.find((database) =>
    /\/databases\/\(default\)$/.test(database.name ?? ''),
  );
  if (!defaultDatabase) {
    const location =
      options.location ??
      (await prompt.choose(
        'Where should Firestore keep the data? Pick the region closest to your users. This cannot be changed later.',
        LOCATIONS,
        { flag: '--location <id>' },
      ));
    const created = await cli.run([
      'firestore:databases:create',
      '(default)',
      '--location',
      location,
      '--edition',
      'standard',
      '--project',
      projectId,
    ]);
    if (created !== 0) {
      throw new SetupError(
        `Could not create the database. Create it in the console (Build → Firestore Database → Create database, Standard edition), then run setup again: https://console.firebase.google.com/project/${projectId}/firestore`,
      );
    }
  } else if (defaultDatabase.type === 'DATASTORE_MODE') {
    throw new SetupError(
      `The (default) database is in Datastore mode. ${APP_NAME} needs Firestore in Native mode.`,
    );
  } else {
    log.info(`Database: (default) in ${defaultDatabase.locationId ?? 'its location'}`);
  }

  // 6. The security rules and indexes.
  if (options.skipDeploy) {
    log.info('Skipped deploying the rules and indexes (--skip-deploy).');
  } else {
    log.step('Deploying the security rules and indexes');
    const deployed = await cli.run([
      'deploy',
      '--only',
      'firestore:rules,firestore:indexes',
      '--project',
      projectId,
    ]);
    if (deployed !== 0)
      throw new SetupError('Deploying the rules and indexes failed; see the output above.');
  }

  return { projectId, appId };
}

/**
 * What is left after setup, with links into the project's console. Admins are
 * listed in Firestore's `admins` collection, which the rules let no client write,
 * so the console is the only place to add one.
 */
export function renderNextSteps(projectId, { deployed = true } = {}) {
  const base = `https://console.firebase.google.com/project/${projectId}`;
  const status = deployed
    ? 'The security rules and indexes are live.'
    : 'The rules and indexes are not deployed yet (--skip-deploy): npm run deploy sends them.';
  return `
Done. ${status} What is left:

  1. Turn on the sign-in methods, if you have not yet: Email/Password and Google.
     ${base}/authentication/providers

  2. Run the app on your project, then publish it:
     npm start          http://localhost:4300
     npm run deploy     prints your Hosting URL, e.g. https://${projectId}.web.app

  3. Make yourself an admin (an admin can delete anyone's custom emoji):
     a. Sign in to the app once, so your account exists.
     b. Copy your User UID from the users list:
        ${base}/authentication/users
     c. In Firestore, start the collection "admins" (or open it) and add a document
        whose Document ID is that UID, with one field such as email = your address:
        ${base}/firestore/databases/-default-/data
     Only the console can add or remove admins; the app has no way to.
`;
}
