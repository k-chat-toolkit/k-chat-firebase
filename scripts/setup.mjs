// npm run setup — connects this copy of K-Chat Lite to your own Firebase project.
//
// It signs in the Firebase CLI if needed, lets you pick the project and its web app,
// writes src/environments/environment.firebase.ts and .firebaserc, creates the
// Firestore database if the project has none, and deploys the rules and indexes.
//
//   npm run setup
//   npm run setup -- --project my-project --app 1:123:web:abc --location asia-southeast1 --yes
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { firebaseJson, runFirebase } from './lib/firebase-cli.mjs';
import { ENVIRONMENT_FILE, FIREBASERC } from './lib/paths.mjs';
import { createPrompt, NeedsAnswerError } from './lib/prompt.mjs';
import { runSetup, SetupError } from './lib/setup-flow.mjs';

const USAGE = `Usage: npm run setup [-- options]

  --project <id>     Firebase project id (otherwise you pick from a list)
  --app <appId>      web app id, when the project has several
  --location <id>    Firestore location, when the project has no database yet
  --yes              create a missing web app and replace existing config without asking
  --skip-deploy      write the config only; do not deploy the rules and indexes
  --help             show this help`;

const { values: options } = parseArgs({
  options: {
    project: { type: 'string' },
    app: { type: 'string' },
    location: { type: 'string' },
    yes: { type: 'boolean', default: false },
    'skip-deploy': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (options.help) {
  console.log(USAGE);
  process.exit(0);
}

const FILES = { environment: ENVIRONMENT_FILE, firebaserc: FIREBASERC };

try {
  const { projectId } = await runSetup({
    cli: { json: firebaseJson, run: runFirebase },
    prompt: createPrompt(),
    files: {
      read: (name) => (existsSync(FILES[name]) ? readFileSync(FILES[name], 'utf8') : null),
      write: (name, text) => writeFileSync(FILES[name], text),
    },
    log: {
      step: (text) => console.log(`\n▸ ${text}`),
      info: (text) => console.log(`  ${text}`),
    },
    options: {
      project: options.project,
      app: options.app,
      location: options.location,
      yes: options.yes,
      skipDeploy: options['skip-deploy'],
    },
  });
  console.log(`
Done. Two things left:

  1. Turn on the sign-in methods, if you have not yet: Email/Password and Google.
     https://console.firebase.google.com/project/${projectId}/authentication/providers

  2. Run the app on your project, then publish it:
     npm start          http://localhost:4300
     npm run deploy     prints your Hosting URL, e.g. https://${projectId}.web.app
`);
} catch (error) {
  if (error instanceof SetupError || error instanceof NeedsAnswerError) {
    console.error(`\nSetup stopped: ${error.message}`);
  } else {
    console.error('\nSetup failed:', error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
}
