// Stops `npm start`, `npm run build` and `npm run deploy` early, with a clear
// message, when this copy is not connected to a Firebase project yet.
//
//   node scripts/check-config.mjs            the web config must exist
//   node scripts/check-config.mjs --deploy   ...and .firebaserc must name the same project
import { existsSync, readFileSync } from 'node:fs';
import { projectIdFromEnvironment, projectIdFromFirebaserc } from './lib/config-files.mjs';
import { ENVIRONMENT_FILE, FIREBASERC } from './lib/paths.mjs';

const deploy = process.argv.includes('--deploy');

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const NOT_CONNECTED = [
  'This copy of K-Chat Lite is not connected to a Firebase project yet.',
  '',
  '  npm run setup   connect it to your project (see README.md, "Quick start")',
  '  npm run dev     or try it first on local emulators, no project needed',
].join('\n');

if (!existsSync(ENVIRONMENT_FILE)) fail(NOT_CONNECTED);

const appProject = projectIdFromEnvironment(readFileSync(ENVIRONMENT_FILE, 'utf8'));
if (!appProject) {
  fail(`src/environments/environment.firebase.ts still holds placeholders.\n\n${NOT_CONNECTED}`);
}

if (deploy) {
  const cliProject = existsSync(FIREBASERC)
    ? projectIdFromFirebaserc(readFileSync(FIREBASERC, 'utf8'))
    : null;
  if (!cliProject) fail(`.firebaserc names no default project.\n\n${NOT_CONNECTED}`);
  if (cliProject !== appProject) {
    fail(
      `The app is configured for "${appProject}" but .firebaserc deploys to "${cliProject}".\n` +
        'Run `npm run setup` again to make them match.',
    );
  }
  console.log(`Deploying to ${cliProject}.`);
}
