// Small terminal prompts for `npm run setup`. Without a terminal (CI, pipes) every
// question fails with a hint to pass the answer as a flag instead.
import { createInterface } from 'node:readline/promises';

export class NeedsAnswerError extends Error {}

export function createPrompt({ input = process.stdin, output = process.stdout } = {}) {
  const interactive = Boolean(input.isTTY);

  async function ask(question) {
    if (!interactive) throw new NeedsAnswerError(question);
    const rl = createInterface({ input, output });
    try {
      return (await rl.question(question)).trim();
    } finally {
      rl.close();
    }
  }

  return {
    /** Picks one of `choices` ({label, value}) by number; Enter takes `defaultIndex`. */
    async choose(question, choices, { defaultIndex = 0, flag } = {}) {
      if (!interactive) {
        throw new NeedsAnswerError(`${question} Pass it with ${flag ?? 'a flag'}.`);
      }
      output.write(`\n${question}\n`);
      choices.forEach((choice, index) => output.write(`  ${index + 1}. ${choice.label}\n`));
      for (;;) {
        const answer = await ask(`Number [${defaultIndex + 1}]: `);
        const index = answer === '' ? defaultIndex : Number(answer) - 1;
        if (Number.isInteger(index) && index >= 0 && index < choices.length) {
          return choices[index].value;
        }
        output.write(`Type a number from 1 to ${choices.length}.\n`);
      }
    },

    /** Yes or no; Enter takes `defaultYes`. */
    async confirm(question, { defaultYes = false, flag = '--yes' } = {}) {
      if (!interactive) throw new NeedsAnswerError(`${question} Pass ${flag} to agree.`);
      const answer = (await ask(`${question} ${defaultYes ? '[Y/n]' : '[y/N]'} `)).toLowerCase();
      return answer === '' ? defaultYes : answer === 'y' || answer === 'yes';
    },

    /** Free text; Enter takes `fallback`. */
    async text(question, { fallback = '', flag } = {}) {
      if (!interactive) throw new NeedsAnswerError(`${question} Pass it with ${flag ?? 'a flag'}.`);
      const answer = await ask(fallback ? `${question} [${fallback}]: ` : `${question}: `);
      return answer || fallback;
    },
  };
}
