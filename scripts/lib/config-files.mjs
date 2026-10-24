// Reads and writes the two per-user config files: src/environments/environment.firebase.ts
// (the web app config) and .firebaserc (the CLI's default project). Both are gitignored.

/** The fields of the web config the app uses. Storage and Analytics stay out on purpose. */
export const WEB_CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId', 'messagingSenderId'];
const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'];

// Firebase config values are ids, keys and host names: nothing that needs escaping.
const SAFE_VALUE = /^[\w.:-]+$/;

/** Picks and checks the fields the app needs from `firebase apps:sdkconfig WEB --json`. */
export function pickWebConfig(sdkConfig) {
  if (!sdkConfig || typeof sdkConfig !== 'object') {
    throw new Error('The Firebase CLI returned no web app config.');
  }
  const config = {};
  for (const key of WEB_CONFIG_KEYS) {
    const value = sdkConfig[key];
    if (value === undefined || value === null || value === '') {
      if (REQUIRED_KEYS.includes(key)) throw new Error(`The web app config has no "${key}".`);
      continue;
    }
    if (typeof value !== 'string' || !SAFE_VALUE.test(value)) {
      throw new Error(`The web app config has an unexpected "${key}": ${JSON.stringify(value)}`);
    }
    config[key] = value;
  }
  return config;
}

export function renderEnvironmentFile(config) {
  const lines = WEB_CONFIG_KEYS.filter((key) => key in config).map(
    (key) => `    ${key}: '${config[key]}',`,
  );
  return [
    '// Written by `npm run setup`. Your own Firebase web config: these values identify',
    '// your project and are not secrets, but the file is gitignored because it belongs',
    '// to whoever cloned the repository. Template: environment.firebase.example.ts.',
    "import type { AppEnvironment } from './environment.model';",
    '',
    'export const environment: AppEnvironment = {',
    '  firebase: {',
    ...lines,
    '  },',
    '};',
    '',
  ].join('\n');
}

export function renderFirebaserc(projectId) {
  return `${JSON.stringify({ projects: { default: projectId } }, null, 2)}\n`;
}

/** The project id in an environment file, or null when it still holds the template's placeholders. */
export function projectIdFromEnvironment(text) {
  if (text.includes('YOUR_')) return null;
  return /projectId:\s*'([^']+)'/.exec(text)?.[1] ?? null;
}

/** The default project in a .firebaserc file, or null. */
export function projectIdFromFirebaserc(text) {
  try {
    const value = JSON.parse(text)?.projects?.default;
    return typeof value === 'string' && value ? value : null;
  } catch {
    return null;
  }
}
