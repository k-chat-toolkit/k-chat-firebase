// Runs the Firebase CLI that package.json pins (firebase-tools), so nobody needs
// a global install and everyone runs the same version.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, dirname, join } from 'node:path';
import { ROOT } from './paths.mjs';

const require = createRequire(import.meta.url);

function firebaseBin() {
  const manifestPath = require.resolve('firebase-tools/package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.firebase;
  return join(dirname(manifestPath), bin);
}

/**
 * The `bin` folder of the JDK that `java` really runs, or null.
 *
 * On Windows, Oracle's installer puts a launcher (`Common Files\Oracle\Java\javapath\java.exe`)
 * on PATH that starts the real JVM as a second process. The Firebase CLI stops the launcher,
 * the JVM keeps running, and the next run fails with "port taken". Putting the real `bin`
 * first on PATH makes the CLI start, and stop, the JVM itself.
 */
export function realJavaBin() {
  const probe = spawnSync('java', ['-XshowSettings:properties', '-version'], { encoding: 'utf8' });
  const match = /^\s*java\.home = (.+)$/m.exec(`${probe.stderr ?? ''}${probe.stdout ?? ''}`);
  return match ? join(match[1].trim(), 'bin') : null;
}

/** The environment for child processes: local binaries such as `ng` come first on PATH. */
export function childEnv(extra = {}) {
  const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === 'PATH') ?? 'PATH';
  const first = [join(ROOT, 'node_modules', '.bin')];
  const javaBin = realJavaBin();
  if (javaBin) first.push(javaBin);
  const path = [...first, process.env[pathKey] ?? ''].join(delimiter);
  return { ...process.env, [pathKey]: path, ...extra };
}

/**
 * Runs `firebase <args>` with the terminal attached and resolves with its exit code.
 * Ctrl+C reaches the CLI directly; this process waits for it to shut down cleanly.
 */
export function runFirebase(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [firebaseBin(), ...args], {
      cwd: ROOT,
      env: childEnv(),
      stdio: 'inherit',
    });
    const ignore = () => {};
    process.on('SIGINT', ignore);
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      process.off('SIGINT', ignore);
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

/** Runs `firebase <args> --json` without a terminal and returns the parsed `result`. */
export function firebaseJson(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [firebaseBin(), ...args, '--json'], {
      cwd: ROOT,
      env: childEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('exit', () => {
      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        reject(
          new Error(`firebase ${args.join(' ')} printed no JSON.\n${stderr || stdout}`.trim()),
        );
        return;
      }
      if (parsed.status === 'success') {
        resolve(parsed.result);
      } else {
        reject(new Error(parsed.error ?? `firebase ${args.join(' ')} failed.`));
      }
    });
  });
}
