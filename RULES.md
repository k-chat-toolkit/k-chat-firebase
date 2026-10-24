# Repository rules

How this repository works. The README explains how to use the kit; this file is for anyone who changes it. The history of a decision lives in the commit that made it, not here.

## Branches

- `main` is the default branch. It always builds and passes every gate.
- **Task branches:**
  - Work happens on a short-lived branch named `<type>/<slug>`, for example `feature/typing-indicator` or `fix/join-race`.
  - The type is one of `feature`, `fix`, `docs`, `chore`, `refactor`, `test`.
  - The slug uses lowercase letters, digits and dashes.
- **Merging:**
  - Run the [quality gates](#quality-gates) on the branch first.
  - Merge with `git merge --no-ff`, so every task stays one visible merge commit.
  - Delete the branch after the merge.
- **History:**
  - Never force-push `main` or rewrite its history.
  - The owner of the repository is the only one who can order an exception.

## Commits

- Write subjects in English, in the imperative, without a trailing period. For example: `Cap invite queries in the rules`.
- Keep the subject under 72 characters. Explain the _why_ in the body when the diff does not show it.
- A merge commit keeps git's default subject.
- **Authorship:**
  - Commits carry the author's own name and email.
  - No line names a tool, a bot or an AI model: no `Co-Authored-By:` trailer and no "Generated with" footer.
  - Nothing in a branch name or a pull request does either.

## Code

- **Language:** comments, identifiers, log messages and commit messages are in English. User-facing text lives in the translation files, never inline.
- **Comments say why.** Say why the code is the way it is, not what the next line does. Keep the history of a change in its commit, not in a comment.
- **Layers and imports:**
  - `src/app/core` is app-wide logic with no UI.
  - `src/app/shared` is reusable UI and pure helpers.
  - `src/app/features/<screen>` is one folder per screen.
  - Import across layers with the aliases `@core/*`, `@shared/*`, `@features/*`, `@env/*` and `@limits`, never with `../../`. ESLint enforces it.
- **Firebase access:**
  - Only `src/app/core/firebase` initializes Firebase.
  - Reads and writes of Firestore documents go through the services in `src/app/core/data`.
  - Every write names the rules branch it relies on, in its doc comment.
- **Components:**
  - Standalone and `OnPush`.
  - State in signals.
  - Routed pages are lazy-loaded.
  - A realtime listener is stopped when its owner is destroyed.
- **Translations:**
  - Every UI string is a key in `src/app/core/i18n/locales/en.ts` and in every other locale. The `Translations` type makes a missing key a compile error.
  - Placeholders (`{name}`) must match across locales; a unit test checks them.
- **Accessibility:**
  - Interactive elements are real buttons and links.
  - An icon-only button has an `aria-label`.
  - `npm run lint` runs the Angular template accessibility rules.

## Security rules

There is no server: `firestore/firestore.rules` is the only authorization layer. Every change to it, or to a write in `src/app/core/data`, follows this checklist:

1. **Length caps in one place.**
   - Every user-written string has a cap in `firestore/limits.json`.
   - Run `npm run limits` to copy the caps into the rules.
   - The client enforces the same cap from the same file, through `@core/limits`.
2. **Pinned schemas.**
   - Creates check `hasAll` and `hasOnly` on the keys.
   - Updates check `diff().affectedKeys().hasOnly(...)` for one allowed action each.
3. **Server-side identity.**
   - A client never asserts who it is. Fields such as `senderId`, `ownerId`, `createdBy` and `lastJoin.uid` must equal `request.auth.uid`.
   - Time fields must equal `request.time`, which means the client writes them with `serverTimestamp()`.
4. **Bounded reads.** Every `allow list` checks `request.query.limit` against a page size from `limits.json`.
5. **Tests for three cases.**
   - Each allowed write path has an emulator test for the allowed case, the denied case and the extra-field case, in `firestore/tests/`.
   - Run `npm run test:rules`.
   - When a rule is new, break it on purpose once and watch its test fail.

## Free tier

The kit must keep working on the Spark plan.

- **Only Spark services:** Authentication (email/password, Google), Cloud Firestore, Hosting and the Emulator Suite.
- **Nothing that needs Blaze:** no Cloud Functions, no Cloud Storage, no paid APIs.
- **Listeners:** a screen adds a realtime listener only when its data must update live. Count the listeners a tab holds at once (three today) and keep the README's "Staying on the free plan" section true.
- **Writes:** no write without a user action. Presence, typing indicators and read receipts in Firestore are out for this reason.

## Config and secrets

- **The per-user web config never goes into git:**
  - `src/environments/environment.firebase.ts` and `.firebaserc` belong to whoever cloned the repository.
  - Their `.example` templates are committed.
- **What else stays out:** service account keys, CI tokens and `.env` files never go into the repository.
- **CLI sign-in:** the Firebase CLI's sign-in stays in the user profile, outside the repository.

## Quality gates

Before merging into `main`, all of these pass on the branch:

```bash
npm run lint
npm test
npm run test:rules
npm run build    # needs a connected copy (npm run setup)
```

If the change touches the UI, also run it once with `npm run dev`, in English and in Vietnamese, at desktop and at phone width.

## Dependencies

- **Exact versions:** `package.json` pins exact versions (`.npmrc` sets `save-exact`). `package-lock.json` is committed.
- **Age:** a new dependency, or a new version of one, must have been published at least two weeks earlier. Install with `npm install --before=<date two weeks ago>`.
- **Upgrades:** upgrade Angular packages together, and the Firebase SDK together with `@firebase/rules-unit-testing`. Run every gate after an upgrade.
- **New runtime dependencies:**
  - Add one only when the platform or the existing ones cannot do the job.
  - The first page load already carries the Firebase SDK, so keep everything else lazy.
