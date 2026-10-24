// Copies firestore/limits.json into the generated block of firestore/firestore.rules.
//
//   npm run limits            rewrite the block
//   node scripts/sync-limits.mjs --check   fail when the block is out of date
import { readFileSync, writeFileSync } from 'node:fs';
import { applyLimits } from './lib/limits.mjs';
import { LIMITS_JSON, RULES_FILE } from './lib/paths.mjs';

const check = process.argv.includes('--check');

const limits = JSON.parse(readFileSync(LIMITS_JSON, 'utf8'));
const current = readFileSync(RULES_FILE, 'utf8');
const next = applyLimits(current, limits);

if (next === current) {
  console.log('firestore.rules limits match firestore/limits.json.');
} else if (check) {
  console.error(
    'firestore.rules limits are out of date. Run `npm run limits` and commit the result.',
  );
  process.exit(1);
} else {
  writeFileSync(RULES_FILE, next);
  console.log('Updated the limits block in firestore/firestore.rules.');
}
