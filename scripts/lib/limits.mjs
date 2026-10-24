// Turns firestore/limits.json into the generated block of firestore/firestore.rules.
// The JSON file is the one place where limits are defined: the Angular app imports
// it directly, and the rules get a copy of each value as a function.

export const BEGIN_MARKER = '// <limits>';
export const END_MARKER = '// </limits>';

const NAME = /^[a-z][A-Za-z0-9]*$/;
const SAFE_STRING = /^[A-Za-z0-9]+$/;

/** Throws when a limit could not be written safely into the rules language. */
export function validateLimits(limits) {
  if (limits === null || typeof limits !== 'object' || Array.isArray(limits)) {
    throw new Error('limits.json must hold one JSON object.');
  }
  for (const [name, value] of Object.entries(limits)) {
    if (!NAME.test(name)) {
      throw new Error(`Limit "${name}" must be a camelCase name.`);
    }
    const isCount = Number.isInteger(value) && value > 0;
    const isText = typeof value === 'string' && SAFE_STRING.test(value);
    if (!isCount && !isText) {
      throw new Error(`Limit "${name}" must be a positive integer or a letters-and-digits string.`);
    }
  }
}

/** Renders the lines between the markers, indented like the rules file. */
export function renderLimitsBlock(limits, indent = '    ') {
  validateLimits(limits);
  const lines = [
    `${indent}${BEGIN_MARKER} Generated from firestore/limits.json by \`npm run limits\`. Do not edit by hand.`,
  ];
  for (const [name, value] of Object.entries(limits)) {
    const literal = typeof value === 'string' ? `'${value}'` : String(value);
    lines.push(`${indent}function ${name}() { return ${literal}; }`);
  }
  lines.push(`${indent}${END_MARKER}`);
  return lines.join('\n');
}

/** Returns the rules text with its generated block replaced by `limits`. */
export function applyLimits(rulesText, limits) {
  const eol = rulesText.includes('\r\n') ? '\r\n' : '\n';
  const lines = rulesText.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim().startsWith(BEGIN_MARKER));
  const end = lines.findIndex((line) => line.trim() === END_MARKER);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(`firestore.rules must contain "${BEGIN_MARKER}" ... "${END_MARKER}".`);
  }
  const indent = lines[begin].slice(0, lines[begin].indexOf(BEGIN_MARKER));
  const block = renderLimitsBlock(limits, indent).split('\n');
  return [...lines.slice(0, begin), ...block, ...lines.slice(end + 1)].join(eol);
}
