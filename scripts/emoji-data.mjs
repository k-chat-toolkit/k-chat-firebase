// Writes src/app/shared/emoji/unicode-emoji.json from the emojibase-data package.
//
//   npm run emoji-data                      rewrite the file (after upgrading emojibase-data)
//   node scripts/emoji-data.mjs --check     fail when the file is out of date
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildEmojiRows, renderEmojiFile } from './lib/emoji-data.mjs';
import { EMOJI_DATA_FILE } from './lib/paths.mjs';

const require = createRequire(import.meta.url);
const check = process.argv.includes('--check');

const next = renderEmojiFile(
  buildEmojiRows({
    en: require('emojibase-data/en/compact.json'),
    vi: require('emojibase-data/vi/compact.json'),
    shortcodes: require('emojibase-data/en/shortcodes/iamcal.json'),
    versions: require('emojibase-data/versions/emoji.json'),
  }),
);

let current = '';
try {
  current = readFileSync(EMOJI_DATA_FILE, 'utf8');
} catch {
  // Not generated yet.
}

if (next === current) {
  console.log('unicode-emoji.json matches emojibase-data.');
} else if (check) {
  console.error(
    'unicode-emoji.json is out of date. Run `npm run emoji-data` and commit the result.',
  );
  process.exit(1);
} else {
  writeFileSync(EMOJI_DATA_FILE, next);
  console.log('Wrote src/app/shared/emoji/unicode-emoji.json.');
}
