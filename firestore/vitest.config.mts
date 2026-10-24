// Vitest config for the security rules suite. Run it with `npm run test:rules`,
// which starts the Firestore emulator around it.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Every file clears the same emulator database, so files run one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
