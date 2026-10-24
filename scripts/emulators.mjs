// Runs the Firebase Emulator Suite on the `demo-k-chat` project. A `demo-`
// project needs no Firebase account and can never reach a real project.
//
//   node scripts/emulators.mjs dev         emulators + `ng serve` against them
//   node scripts/emulators.mjs start       emulators only (UI at http://127.0.0.1:4000)
//   node scripts/emulators.mjs rules-test  Firestore emulator + the rules test suite
//
// `dev` and `start` keep their data in .emulator-data/ between runs.
import { mkdirSync } from 'node:fs';
import { runFirebase } from './lib/firebase-cli.mjs';
import { DEMO_PROJECT_ID, EMULATOR_DATA_DIR } from './lib/paths.mjs';

const mode = process.argv[2];
const project = ['--project', DEMO_PROJECT_ID];
// `--export-on-exit` takes an optional folder, so it gets one explicitly.
const keepData = ['--import', EMULATOR_DATA_DIR, '--export-on-exit', EMULATOR_DATA_DIR];

let args;
switch (mode) {
  case 'dev':
    args = [
      'emulators:exec',
      'ng serve --configuration emulators',
      ...project,
      '--only',
      'auth,firestore',
      '--ui',
      ...keepData,
    ];
    break;
  case 'start':
    args = ['emulators:start', ...project, '--only', 'auth,firestore', ...keepData];
    break;
  case 'rules-test':
    args = [
      'emulators:exec',
      'vitest run --config firestore/vitest.config.mts',
      ...project,
      '--only',
      'firestore',
    ];
    break;
  default:
    console.error('Usage: node scripts/emulators.mjs <dev|start|rules-test>');
    process.exit(2);
}

if (mode !== 'rules-test') {
  mkdirSync(EMULATOR_DATA_DIR, { recursive: true });
}

process.exitCode = await runFirebase(args);
