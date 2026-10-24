# K-Chat Lite

A slimmed-down chat app that you host yourself, on Firebase's free **Spark** plan: Angular on Firebase Hosting, Firebase Authentication and Cloud Firestore. There is no server to run and no bill to pay at low use. Clone it, connect it to your own Firebase project with one command, and deploy your own copy.

The UI follows Slack's layout, with fewer features, and speaks English and Vietnamese.

- **Sign in** with email and password (with a password reset email) or with Google.
- **Profile:** a display name, picked at the first sign-in. Avatars are initials on a color.
- **Group rooms** that people join with an 8-character invite code or an invite link. The owner can rename the room, reset the code, remove members and delete the room. Members can leave.
- **1-to-1 chats**, opened from the member list of a room you share.
- **Realtime messages:** the newest 30 arrive live, older ones load 30 at a time as you scroll up. You can edit and delete your own messages.
- **Room list** sorted by latest activity, with a preview of the last message and unread markers.
- **English and Vietnamese UI**, switchable at any time, with no reload.
- **Local mode:** `npm run dev` runs everything on the Firebase Emulator Suite. You need no Firebase account for it.

## Contents

- [Quick start](#quick-start)
- [Commands](#commands)
- [Config files](#config-files)
- [Staying on the free plan](#staying-on-the-free-plan)
- [What is not included, and why](#what-is-not-included-and-why)
- [Security model](#security-model)
- [Project structure](#project-structure)
- [Customizing](#customizing)
- [Troubleshooting](#troubleshooting)

## Quick start

### What you need

- **Node.js** 24.15 or newer (or 26+), with npm.
- **Java** 21 or newer. The Firestore emulator runs on it; `npm run dev` and `npm run test:rules` need it.
- **A Google account**, once you connect a real Firebase project.

The Firebase CLI comes with the project (`firebase-tools` in `devDependencies`), so you do not install it globally.

### 1. Try it locally, without a Firebase project

```bash
git clone <this repository> k-chat
cd k-chat
npm ci
npm run dev
```

Then:

1. Open http://localhost:4300 and create an account.
   - Accounts and messages live in the local emulators only.
   - They are kept in `.emulator-data/` between runs.
2. To chat with yourself as a second user, open the same app in a private window, or at http://[::1]:4300. Each origin keeps its own sign-in.
3. The Emulator UI at http://127.0.0.1:4000 shows the users and documents.
4. Press Ctrl+C to stop. The emulators save their data on the way out.

### 2. Connect your own Firebase project

Do these four steps once.

1. **Create a project.**
   - In the [Firebase console](https://console.firebase.google.com), choose _Create a project_.
   - Google Analytics is not needed.
   - New projects start on the free Spark plan; stay on it.
2. **Add a web app.**
   - Open _Project settings → General → Your apps → Add app → Web_.
   - Give it any name.
   - You can skip Hosting setup and the config snippet; the next steps handle both.
3. **Turn on sign-in.**
   - Open _Build → Authentication → Get started → Sign-in method_.
   - Enable **Email/Password**.
   - Enable **Google**, and pick a support email.
4. **Run setup:**

   ```bash
   npm run setup
   ```

   It signs the Firebase CLI in to your Google account (a browser window opens the first time), then:
   - lets you pick the project and its web app;
   - writes your config into `src/environments/environment.firebase.ts` and `.firebaserc`;
   - creates the Firestore database if the project has none (it asks for a location, which cannot be changed later; pick the one closest to your users);
   - deploys the security rules and indexes.

   Run `npm run setup -- --help` for flags. You can use them to skip the questions, for example in CI.

### 3. Run it on your project, then publish it

```bash
npm start        # http://localhost:4300, against your real project
npm run deploy   # build + Hosting + rules + indexes
```

`npm run deploy` prints your site address, for example `https://<project-id>.web.app`.

- **First deploy:** the CLI may ask to create the default Hosting site. Answer yes.
- **Right after the first deploy:** the composite index for the room list can take a few minutes to build. Until it is ready the room list stays empty, and the browser console says the index is building.
- **Another domain:** if you serve the app from a domain other than `*.web.app` / `*.firebaseapp.com`, add it under _Authentication → Settings → Authorized domains_ so Google sign-in works there.

## Commands

| Command              | What it does                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`        | Runs the Auth and Firestore emulators on the `demo-k-chat` project, plus `ng serve` against them. Needs no Firebase account.     |
| `npm run emulators`  | Runs the emulators alone, with the Emulator UI at http://127.0.0.1:4000.                                                         |
| `npm run setup`      | Connects this copy to your Firebase project: writes the config, creates the database, and deploys the rules and indexes.         |
| `npm start`          | Runs `ng serve` on http://localhost:4300 against your project. Needs `npm run setup` first.                                      |
| `npm run build`      | Builds for production into `dist/k-chat/browser`, with your project's config.                                                    |
| `npm run deploy`     | Builds, then deploys Hosting, the Firestore rules and the indexes to the project in `.firebaserc`.                               |
| `npm test`           | Runs the unit tests: the Angular app (Vitest) and the Node scripts (`node --test`).                                              |
| `npm run test:rules` | Runs the security rules suite against the Firestore emulator.                                                                    |
| `npm run lint`       | Runs ESLint, type-checks the rules suite, checks formatting with Prettier, and checks that the rules limits match `limits.json`. |
| `npm run format`     | Formats every file with Prettier.                                                                                                |
| `npm run limits`     | Copies `firestore/limits.json` into the generated block of `firestore/firestore.rules`.                                          |

Dev servers use fixed ports, so they do not collide with another Angular app on 4200 or a service on 8080:

| Service     | Port |
| ----------- | ---- |
| App         | 4300 |
| Auth        | 9099 |
| Firestore   | 8180 |
| Hosting     | 5050 |
| Emulator UI | 4000 |

To change a port, edit `firebase.json`, plus `src/environments/environment.ts` for the emulators, or `angular.json` for the app.

## Config files

Every file that holds configuration. Only your Firebase CLI sign-in is a secret, and it never lives in the repository.

| File                                               | Created by                                | Where                                                                                   | Contents                                                                                                                                  | Secret?                                                                                                    |
| -------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/environments/environment.firebase.ts`         | `npm run setup`, or you, from the example | your clone only (gitignored)                                                            | Your web app config: `apiKey`, `authDomain`, `projectId`, `appId`, `messagingSenderId`                                                    | No. It identifies your project; the security rules protect the data. It is gitignored because it is yours. |
| `src/environments/environment.firebase.example.ts` | this repository                           | committed                                                                               | A template of the file above, with placeholders                                                                                           | No                                                                                                         |
| `src/environments/environment.ts`                  | this repository                           | committed                                                                               | The local setup: the `demo-k-chat` project and the emulator addresses. Builds for your project replace it with `environment.firebase.ts`. | No                                                                                                         |
| `.firebaserc`                                      | `npm run setup`                           | your clone only (gitignored)                                                            | The default project of the Firebase CLI, used by `npm run deploy`                                                                         | No                                                                                                         |
| `.firebaserc.example`                              | this repository                           | committed                                                                               | A template of the file above                                                                                                              | No                                                                                                         |
| `firebase.json`                                    | this repository                           | committed                                                                               | Hosting settings (folder, rewrites, headers), Firestore file paths, emulator ports                                                        | No                                                                                                         |
| `firestore/firestore.rules`                        | this repository                           | committed                                                                               | The security rules. The `<limits>` block is generated from `limits.json`.                                                                 | No                                                                                                         |
| `firestore/firestore.indexes.json`                 | this repository                           | committed                                                                               | The room list's composite index; text fields left out of indexing                                                                         | No                                                                                                         |
| `firestore/limits.json`                            | this repository                           | committed                                                                               | Length caps and page sizes, shared by the app and the rules                                                                               | No                                                                                                         |
| `.emulator-data/`                                  | `npm run dev`, `npm run emulators`        | your clone only (gitignored)                                                            | The local emulators' users and documents                                                                                                  | No (test data)                                                                                             |
| Firebase CLI sign-in                               | `npm run setup` (or `npx firebase login`) | your user profile (`~/.config/configstore/firebase-tools.json`), outside the repository | OAuth tokens for your Google account                                                                                                      | **Yes.** Never copy it into the repository. `npx firebase logout` removes it.                              |

Setup reads `environment.firebase.ts` and `.firebaserc` before writing them. If they point at another project, it asks before replacing them.

## Staying on the free plan

The Spark plan's daily and monthly allowances, per the [Firebase pricing page](https://firebase.google.com/pricing) as of October 2026:

| Service        | Free allowance                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Firestore      | 1 GiB stored; 50,000 reads, 20,000 writes and 20,000 deletes **per day** (reset around midnight Pacific time); 10 GiB outbound per month. One free database per project. |
| Authentication | 50,000 monthly active users with email/password and Google. Phone sign-in is not available on Spark.                                                                     |
| Hosting        | 10 GB stored, 360 MB transferred per day                                                                                                                                 |

Past an allowance, requests fail until it resets: there is no surprise bill on Spark. Actions then fail with _"This app has used up today's free quota"_.

How the app keeps its usage small:

- **Few listeners.** A tab holds at most three realtime listeners:
  - your profile;
  - your room list (one query for every room you are in);
  - the open room's newest 30 messages.
- **Pages, not histories.**
  - Older messages are fetched once, 30 at a time, when you scroll up.
  - The rules refuse a message query unless it has a limit of 30 or less, and a room list query unless it has a limit of 100 or less. A bug or a curious user cannot read a whole history in one go.
- **No per-room reads for the list.** Each room stores a copy of its last message, so the room list costs one read per room. The rules check that the copy matches a real message.
- **Profiles once per session.** Other people's names are fetched once and cached for the session.
- **A local cache.**
  - Firestore keeps a persistent cache, shared across tabs.
  - A listener that reconnects within 30 minutes is billed only for documents that changed.
  - After 30 minutes offline, the listener counts as a new query.
- **Unread markers cost nothing.** They live in the browser's `localStorage`, not in Firestore. The trade-off: another device does not know what you read here.
- **Small documents.**
  - A message holds at most 2,000 characters, so at most a few KB.
  - A room holds at most 100 member ids, plus one message copy, so about 12 KB at worst.
  - Firestore's limit is 1 MiB per document, far away.
  - Message text is left out of indexing, which saves storage and write work.

A rough budget: sending a message costs 2 writes (the message and the room's preview), so 20,000 writes a day allow about 10,000 messages. Opening the app and one busy room costs roughly:

- the rooms in your list;
- 30 messages;
- one read for the rules' membership check;
- one read per new face.

That comes to about 50 reads, so 50,000 reads allow about 1,000 such visits a day.

The first visit downloads about 250 KB, compressed. Later visits reuse the cached files, which are fingerprinted and cached for a year; only `index.html` is fetched again. So 360 MB a day of Hosting covers more than a thousand new visitors a day.

Two things can still use up a quota: a very busy room, or someone signed in who hammers the API on purpose. For the second, see [App Check](https://firebase.google.com/docs/app-check) in _Not included_.

## What is not included, and why

| Feature                         | Why it is left out                                                                                                                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Images, files, uploaded avatars | **Cloud Storage for Firebase requires the paid Blaze plan.** Since 2026-02-03, a Spark project has no access to any Storage bucket ([Firebase FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)). Avatars are initials instead. |
| Push notifications              | Sending a push needs a trusted server holding the project's credentials; a browser cannot do it safely. The usual server is Cloud Functions, which also needs Blaze. The app has realtime updates while it is open, and unread markers.                               |
| Cloud Functions (server code)   | Needs the Blaze plan. Everything the app needs is enforced by the security rules instead.                                                                                                                                                                             |
| Online status and "typing…"     | Both need a stream of writes from every open tab, which uses up the 20,000 daily writes fast.                                                                                                                                                                         |
| Searching for people            | Searching by email or name would make every profile listable. Profiles can only be fetched one by one, by id, and you learn ids by sharing a room.                                                                                                                    |
| Blocking people                 | Not in this version. A room owner can remove members.                                                                                                                                                                                                                 |
| Deleting your account           | Removing someone's messages from every room safely needs a server.                                                                                                                                                                                                    |
| App Check                       | Free (reCAPTCHA Enterprise has a free tier) and recommended once you go public, but it needs keys from your project. Add it when you launch.                                                                                                                          |

## Security model

There is no server, so the [security rules](firestore/firestore.rules) are the only thing that decides who may read or write what. Four rules of thumb run through them:

1. **Every string a user writes has a length cap.**
   - The caps live in one file, [`firestore/limits.json`](firestore/limits.json).
   - The app imports it, and `npm run limits` copies it into the rules.
   - `npm run lint` fails if the two drift apart.
2. **Every document has a fixed schema.** Creates must have exactly the expected keys (`hasAll` + `hasOnly`). Updates may change only the keys of one allowed action (`diff().affectedKeys().hasOnly`). An extra field is refused.
3. **Identity comes from `request.auth.uid`, never from the client.** For example, a message's `senderId` must equal the caller's uid, and so must a room's `ownerId` at creation.
4. **Every write path has emulator tests** for the allowed case, the denied case and the extra-field case: see [`firestore/tests/`](firestore/tests).

The data model:

| Path                           | Fields                                                                                                         | Who may do what                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `users/{uid}`                  | `displayName`, `createdAt`, `updatedAt`                                                                        | Anyone signed in may fetch one profile; nobody may list them. Only you write yours. The email stays in Authentication.       |
| `rooms/{roomId}`, group        | `type`, `name`, `ownerId`, `memberIds`, `inviteCode`, `lastJoin`, `lastMessage`, `createdAt`, `lastActivityAt` | Members read. The owner renames, resets the code, removes members, deletes. Members leave and refresh the preview.           |
| `rooms/{uidA_uidB}`, 1-to-1    | `type`, `memberIds`, `lastMessage`, `createdAt`, `lastActivityAt`                                              | The two members only. The id is both uids, sorted, so a pair has one room.                                                   |
| `rooms/{roomId}/messages/{id}` | `senderId`, `text`, `createdAt`, `editedAt`, `deleted`                                                         | Members read, 30 at a time, and send. The sender edits or soft-deletes. The group owner hard-deletes when deleting the room. |
| `invites/{code}`               | `roomId`, `createdBy`, `createdAt`                                                                             | Anyone signed in may fetch a code they know; nobody may list codes.                                                          |

How joining works without a server:

1. The joiner looks up `invites/{code}` to find the room.
2. The joiner adds their own uid to `memberIds`.
3. In the same write, the joiner sets `lastJoin = {uid, code}`. The rules accept the join only if that code equals the room's current `inviteCode`.
4. The joiner cannot read the room before joining, so they cannot learn the code from it.

Resetting the code swaps the invite in one batch, so the old link stops working at once. A removed member who still knows the current code can rejoin. That is why the app suggests resetting the code after removing someone.

## Project structure

```
firestore/              security rules, indexes, limits.json, and the rules test suite
scripts/                setup, emulator and config-check scripts (Node, no dependencies)
src/
  environments/         environment.ts (emulators), the per-user config and its template
  app/
    core/               app-wide services and models, no UI
      auth/             AuthService and route guards
      data/             Firestore access: profiles, rooms, messages, unread markers
      errors/           error codes → translated messages
      firebase/         providers for the Firebase app, Auth and Firestore
      i18n/             I18nService and the en / vi dictionaries
      models/           document types and their parsers
    shared/             reusable UI (avatar, icon, dialog, language switcher) and utils
    features/           one folder per screen: auth, onboarding, workspace, chat, rooms, direct, profile
```

Imports use the TypeScript path aliases from `tsconfig.json` instead of long relative paths: `@core/*`, `@shared/*`, `@features/*`, `@env/*` and `@limits`. ESLint refuses `../../` imports.

The app uses the plain Firebase JS SDK with Angular signals: no AngularFire, so it never waits for a wrapper to support a new Angular release. Every page is standalone, `OnPush` and lazy-loaded.

## Customizing

- **Name and texts:**
  - Every UI string is in `src/app/core/i18n/locales/en.ts` and `vi.ts`. The type check fails if a key is missing from a language.
  - The app's name is the `app.name` key; other strings say `{app}` and get it filled in. To rename the app, change `app.name` in each locale, the `<title>` in `src/index.html`, and `APP_NAME` in `scripts/lib/setup-flow.mjs` (the name `npm run setup` gives a new web app).
- **Another language:**
  1. Copy `vi.ts` to, say, `fr.ts` and translate it.
  2. Add `'fr'` to `Locale` and `LOCALES` in `src/app/core/i18n/i18n.service.ts`.
  3. Add the dictionary to `TABLES`, plus a `locale.fr` key in every dictionary.
- **Colors:** the design tokens are at the top of `src/styles.css`, light and dark.
- **Limits:** edit `firestore/limits.json`, run `npm run limits`, then `npm run test:rules`. Redeploy the rules with `npm run deploy`.

## Troubleshooting

- **`Could not start Firestore Emulator, port taken`**
  - Another emulator is still running. Stop it, or change the port in `firebase.json`.
  - On Windows with Oracle's Java, the `java` on PATH is a launcher. If the CLI stops only the launcher, the emulator keeps running. The npm scripts work around this. If you run `npx firebase emulators:*` yourself, put your JDK's `bin` folder first on PATH, or end the leftover `java` process.
- **`java` not found:** install a JDK (21 or newer) and open a new terminal.
- **`npm start` / `npm run build` says the copy is not connected:** run `npm run setup`, or use `npm run dev`.
- **The room list stays empty right after the first deploy:** the composite index is still building. Wait a few minutes and reload.
- **Google sign-in fails with `auth/unauthorized-domain`:** add your domain under _Authentication → Settings → Authorized domains_.
- **"This sign-in method is not enabled":** enable Email/Password or Google under _Authentication → Sign-in method_.
- **npm warns that install scripts were skipped:** newer npm versions skip package install scripts unless you approve them. Nothing in this kit needs them.

## Contributing

See [RULES.md](RULES.md) for how this repository works: branches, commits, code rules, the security-rules checklist and the quality gates.

## License

No license has been chosen yet: all rights reserved.
