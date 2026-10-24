// Absolute paths of the files the scripts read and write.
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export const LIMITS_JSON = join(ROOT, 'firestore', 'limits.json');
export const RULES_FILE = join(ROOT, 'firestore', 'firestore.rules');
export const FIREBASERC = join(ROOT, '.firebaserc');
export const ENVIRONMENT_FILE = join(ROOT, 'src', 'environments', 'environment.firebase.ts');
export const EMULATOR_DATA_DIR = join(ROOT, '.emulator-data');

/** The project the Emulator Suite runs. A `demo-` id never touches a real project. */
export const DEMO_PROJECT_ID = 'demo-k-chat';
