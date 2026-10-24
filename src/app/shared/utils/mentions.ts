/** A room member, as the composer offers them after "@". */
export interface MentionCandidate {
  readonly uid: string;
  readonly name: string;
}

/**
 * How a mention is stored in message text, as in Slack: by uid, not by name, so
 * it still points at the right person after a rename.
 */
export function mentionToken(uid: string): string {
  return `<@${uid}>`;
}

const MENTION = /<@([A-Za-z0-9]{1,128})>/g;
/** What may come right before "@" for it to start a mention. */
const BEFORE_MENTION = /[\s([{"'“‘]/;
/** A name ends where no letter or digit follows it: "@An," mentions An, "@Anh" does not. */
const NAME_CHARACTER = /[\p{L}\p{N}_]/u;

/**
 * Turns "@Display Name" into "<@uid>" for every member whose exact name follows an "@".
 * Longer names win, so "@An Nguyen" is not read as "@An". When two members share
 * a name, the first one in `members` wins: the composer puts the people you picked first.
 */
export function encodeMentions(text: string, members: readonly MentionCandidate[]): string {
  if (!text.includes('@')) return text;
  // A stable sort keeps the caller's order among names of the same length.
  const byLength = members.filter((m) => m.name).sort((a, b) => b.name.length - a.name.length);
  let out = '';
  let index = 0;
  while (index < text.length) {
    const startsMention =
      text[index] === '@' && (index === 0 || BEFORE_MENTION.test(text[index - 1]));
    if (startsMention) {
      const rest = text.slice(index + 1);
      const member = byLength.find(
        (m) => rest.startsWith(m.name) && !NAME_CHARACTER.test(rest.charAt(m.name.length)),
      );
      if (member) {
        out += mentionToken(member.uid);
        index += 1 + member.name.length;
        continue;
      }
    }
    out += text[index];
    index++;
  }
  return out;
}

/**
 * Turns every "<@uid>" back into "@Display Name", for editing and for previews.
 * A token whose name is unknown (null) stays as it is, so it is never lost.
 */
export function decodeMentions(text: string, nameOf: (uid: string) => string | null): string {
  return text.replace(MENTION, (token, uid: string) => {
    const name = nameOf(uid);
    return name === null ? token : `@${name}`;
  });
}

export function mentionsUser(text: string, uid: string): boolean {
  return uid !== '' && text.includes(mentionToken(uid));
}
