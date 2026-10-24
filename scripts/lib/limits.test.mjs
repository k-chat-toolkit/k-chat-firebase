import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { applyLimits, renderLimitsBlock, validateLimits } from './limits.mjs';
import { LIMITS_JSON, RULES_FILE } from './paths.mjs';

describe('limits', () => {
  it('renders numbers and strings as rules functions', () => {
    const block = renderLimitsBlock({ maxThings: 3, alphabet: 'AB2' }, '');
    assert.match(block, /^function maxThings\(\) \{ return 3; \}$/m);
    assert.match(block, /^function alphabet\(\) \{ return 'AB2'; \}$/m);
  });

  it('refuses values that could break the rules file', () => {
    assert.throws(() => validateLimits({ bad: "x'; }" }), /bad/);
    assert.throws(() => validateLimits({ negative: -1 }), /negative/);
    assert.throws(() => validateLimits({ 'not-camel': 1 }), /not-camel/);
  });

  it('replaces only the block between the markers', () => {
    const rules = [
      'a',
      '  // <limits> old',
      '  function x() { return 1; }',
      '  // </limits>',
      'b',
    ].join('\n');
    const next = applyLimits(rules, { x: 2 });
    assert.equal(next.split('\n')[0], 'a');
    assert.equal(next.split('\n').at(-1), 'b');
    assert.match(next, /^ {2}function x\(\) \{ return 2; \}$/m);
  });

  it('matches the committed rules file', () => {
    const limits = JSON.parse(readFileSync(LIMITS_JSON, 'utf8'));
    const rules = readFileSync(RULES_FILE, 'utf8');
    assert.equal(applyLimits(rules, limits), rules, 'Run `npm run limits`.');
  });
});
