import limits from '@limits';

/**
 * Length caps and page sizes, read from firestore/limits.json: the same file
 * the security rules are generated from, so the client and the rules agree.
 *
 * The client counts UTF-16 code units (`string.length`) and the rules count
 * characters, so a string the client accepts is never longer for the rules.
 */
export const LIMITS = Object.freeze({ ...limits });

export type Limits = typeof LIMITS;
