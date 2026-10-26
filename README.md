# K-Chat Toolkit (Firebase)

A rapid-setup chat toolkit that you can deploy and host yourself in minutes, running entirely on Firebase's free **Spark** tier: Angular 22 on Firebase Hosting, Firebase Authentication, and Cloud Firestore.

There are no servers to maintain, no containers to run, and no billing requirements for normal usage. Clone the repo, run a single setup command to connect your Firebase project, and launch your ready-to-use chat application.

The user interface follows a modern Slack-like layout, supports both English and Vietnamese out-of-the-box, and uses a modular `BackendCapabilities` architecture so unsupported or quota-heavy features are cleanly disabled.

---

## Feature Matrix & Plan Requirements

The toolkit is designed to maximize what is possible on Firebase's free **Spark plan** without incurring unexpected charges. Features requiring paid upgrades (the Blaze pay-as-you-go plan) or server code are gracefully toggled off in the UI.

| Feature Category      | Feature                                     | Spark Plan (Free) |           Blaze Plan / Paid Unlock            | Frontend State         |
| :-------------------- | :------------------------------------------ | :---------------: | :-------------------------------------------: | :--------------------- |
| **Authentication**    | Email & Password (with reset flow)          |    ✅ Included    |                   Included                    | Active                 |
|                       | Google One-Click Sign-in                    |    ✅ Included    |                   Included                    | Active                 |
| **Chat Spaces**       | 1-to-1 Direct Messaging                     |    ✅ Included    |                   Included                    | Active                 |
|                       | Group Rooms (Code & Link Invite)            |    ✅ Included    |                   Included                    | Active                 |
|                       | Owner Controls (Rename, Kick, Delete)       |    ✅ Included    |                   Included                    | Active                 |
| **Messaging**         | Realtime Sync (30/page, scroll-up paging)   |    ✅ Included    |                   Included                    | Active                 |
|                       | Edit & Soft-delete Own Messages             |    ✅ Included    |                   Included                    | Active                 |
|                       | Slack-style Formatting Toolbar & Markdown   |    ✅ Included    |                   Included                    | Active                 |
|                       | Reactions (`reactions.{uid}`)               |    ✅ Included    |                   Included                    | Active                 |
|                       | Quote Replies & `@` Mentions                |    ✅ Included    |                   Included                    | Active                 |
| **Emoji**             | Standard Unicode Picker & Autocomplete      |    ✅ Included    |                   Included                    | Active                 |
|                       | Custom Emoji (Base64 in Firestore, max 200) |    ✅ Included    |                   Included                    | Active                 |
| **Notifications**     | Desktop & Tab Badge Notifications           |    ✅ Included    |                   Included                    | Active (when tab open) |
| **Media & Files**     | File & Image Attachments                    |   🔒 **Locked**   |     ⚡ **Requires Blaze** (Cloud Storage)     | Disabled with tooltip  |
|                       | User Photo Avatars                          |   🔒 **Locked**   |   ⚡ **Requires Blaze** (Initials on Spark)   | Initials avatar        |
| **Realtime Presence** | "User is typing..." Indicator               |   🔒 **Locked**   |    ⚡ High write frequency exhausts quota     | Disabled in config     |
|                       | Online / Offline Status Badge               |   🔒 **Locked**   |    ⚡ Heartbeat writes exhaust Spark quota    | Disabled in config     |
| **Push & Server**     | Mobile / Background Push Notifications      |   🔒 **Locked**   | ⚡ **Requires Blaze** (Cloud Functions / FCM) | Web notifications only |
|                       | Server-side Data Export / Webhooks          |   🔒 **Locked**   |    ⚡ **Requires Blaze** (Cloud Functions)    | Client-side only       |

---

## Contents

- [Quick start](#quick-start)
- [Feature Matrix & Plan Requirements](#feature-matrix--plan-requirements)
- [Commands](#commands)
- [Firebase CLI for Developers](#firebase-cli-for-developers)
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
- **A Google account** (to connect your free Firebase project).
- _(Optional)_ **Java** 21 or newer: Only needed if you want to run the local offline Firebase Emulator Suite (`npm run dev` or `npm run test:rules`). End-users deploying to Firebase do **not** need Java installed.

The Firebase CLI comes bundled with this project (`firebase-tools` in `devDependencies`), so you do not need to install it globally.

### 1. Instant Setup & Deploy (Connect to Firebase in 1 Command)

To connect and deploy your app to Firebase:

1. **Create a project & turn on Auth:**
   - In the [Firebase Console](https://console.firebase.google.com), click _Create a project_ (stay on the free Spark plan).
   - Under _Build → Authentication → Sign-in method_, enable **Email/Password** and **Google**.
2. **Install and run the interactive setup:**
   ```bash
   git clone https://github.com/k-chat-toolkit/k-chat-firebase.git k-chat
   cd k-chat
   npm ci
   npm run setup
   ```
   The interactive wizard signs in to Google, links your Firebase project, provisions Cloud Firestore, generates your config files, and deploys the production security rules and composite indexes automatically.
3. **Run or publish:**
   ```bash
   npm start        # Launch locally on http://localhost:4300 against your Firebase project
   npm run deploy   # Build and deploy to Firebase Hosting (https://<project-id>.web.app)
   ```

`npm run deploy` prints your live site address, for example `https://<project-id>.web.app`.

- **First deploy:** the CLI may ask to create the default Hosting site. Answer yes.
- **Right after the first deploy:** the composite index for the room list can take a few minutes to build. Until it is ready the room list stays empty, and the browser console says the index is building.
- **Another domain:** if you serve the app from a domain other than `*.web.app` / `*.firebaseapp.com`, add it under _Authentication → Settings → Authorized domains_ so Google sign-in works there.
- **Make yourself an admin:** sign in to the app once, then follow [Admins](#customizing) under _Customizing_. It takes a minute in the Firebase console.

### 2. (Optional) Try Offline with the Emulator Suite

If you have Java installed and wish to test offline without creating a Firebase account:

```bash
npm run dev
```

1. Open http://localhost:4300 and create a local account. Accounts and messages live in the local emulators only (persisted in `.emulator-data/`).
2. To chat with a second user, open the app in a private/incognito window or at http://[::1]:4300.
3. The Emulator UI at http://127.0.0.1:4000 lets you inspect local users and documents.
4. Press `Ctrl+C` to stop. Emulators save data on exit.

## Commands

| Command                  | What it does                                                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`            | Runs the Auth and Firestore emulators on the `demo-k-chat` project, plus `ng serve` against them. Needs no Firebase account.                                                  |
| `npm run emulators`      | Runs the emulators alone, with the Emulator UI at http://127.0.0.1:4000.                                                                                                      |
| `npm run setup`          | Connects this copy to your Firebase project: writes the config, creates the database, and deploys the rules and indexes.                                                      |
| `npm start`              | Runs `ng serve` on http://localhost:4300 against your project. Needs `npm run setup` first.                                                                                   |
| `npm run build`          | Builds for production into `dist/k-chat/browser`, with your project's config.                                                                                                 |
| `npm run deploy`         | Builds, then deploys Hosting, the Firestore rules and the indexes to the project in `.firebaserc`.                                                                            |
| `npm run deploy:hosting` | Builds, then deploys only Hosting (skips rules and indexes for fast ~5–10s updates).                                                                                          |
| `npm run deploy:rules`   | Deploys only Firestore security rules (no frontend rebuild).                                                                                                                  |
| `npm test`               | Runs the unit tests: the Angular app (Vitest) and the Node scripts (`node --test`).                                                                                           |
| `npm run test:rules`     | Runs the security rules suite against the Firestore emulator.                                                                                                                 |
| `npm run lint`           | Runs ESLint, type-checks the rules suite, checks formatting with Prettier, and checks that the rules limits match `limits.json` and the emoji table matches `emojibase-data`. |
| `npm run format`         | Formats every file with Prettier.                                                                                                                                             |
| `npm run limits`         | Copies `firestore/limits.json` into the generated block of `firestore/firestore.rules`.                                                                                       |
| `npm run emoji-data`     | Rebuilds the emoji picker's table, `src/app/shared/emoji/unicode-emoji.json`, from the `emojibase-data` dev dependency.                                                       |

Dev servers use fixed ports, so they do not collide with another Angular app on 4200 or a service on 8080:

| Service     | Port |
| ----------- | ---- |
| App         | 4300 |
| Auth        | 9099 |
| Firestore   | 8180 |
| Hosting     | 5050 |
| Emulator UI | 4000 |

To change a port, edit `firebase.json`, plus `src/environments/environment.ts` for the emulators, or `angular.json` for the app.

## Firebase CLI for Developers

For developers who manage deployments directly or want fast, granular control without running full pipeline checks, the bundled `firebase-tools` CLI can be invoked with `npx firebase` (or via dedicated npm scripts).

### 1. Fast Hosting-Only Deployments

When you only update Angular templates, styles, or frontend logic, skip redeploying Firestore rules and indexes for near-instant uploads (~5–10s):

```bash
# Using npm shortcut:
npm run deploy:hosting

# Or direct CLI with release note:
npm run build
npx firebase deploy --only hosting -m "Update Slack toolbar and composer styles"
```

### 2. Preview Channels (Zero-Risk Branch & PR Previews)

Firebase Hosting Preview Channels allow you to test changes on a temporary live URL without touching production:

```bash
npm run build

# Deploy to a preview channel (default expires in 7 days):
npx firebase hosting:channel:deploy pr-feature-preview

# Deploy with custom expiration (e.g. 24 hours):
npx firebase hosting:channel:deploy pr-feature-preview --expires 24h
```

This outputs a dedicated URL (e.g., `https://<project-id>--pr-feature-preview-<hash>.web.app`).

**Manage preview channels:**

```bash
# List all active preview channels:
npx firebase hosting:channel:list

# Delete a preview channel when done:
npx firebase hosting:channel:delete pr-feature-preview
```

### 3. Deploy Security Rules or Indexes Only

Modify and deploy database rules without touching or rebuilding the frontend application:

```bash
# Deploy Firestore security rules only:
npm run deploy:rules
# or:
npx firebase deploy --only firestore:rules

# Deploy Firestore indexes only:
npx firebase deploy --only firestore:indexes
```

### 4. Managing Multi-Environment Projects (Dev / Staging / Prod)

Easily switch targets between different Firebase projects using `.firebaserc` aliases:

```bash
# List all accessible Firebase projects:
npx firebase projects:list

# Check the currently active project:
npx firebase use

# Add an environment alias (e.g., 'staging' or 'prod'):
npx firebase use --add

# Switch to a target environment and deploy:
npx firebase use prod
npm run deploy
```

### 5. Instant Rollback

If a bad frontend build goes to production, rollback instantly via Firebase Console (_Hosting → Release history → Roll back_) or clone a previous release tag:

```bash
# Clone a specific preview channel or version to live production:
npx firebase hosting:clone <project-id>:<channel-or-version> <project-id>:live
```

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
- **Profiles once per session.** Other people's names are fetched once and cached for the session. The member list of a room is fetched only when you open its details or type `@`.
- **Reactions ride on the message.** A reaction is one write to the message, and it arrives through the listener the room already has.
- **Custom emoji are read on demand.**
  - An emoji seen in a message costs one read per name per session.
  - The whole list (at most 200, one page) is read once per session, when you open the picker or type `:name`.
  - Images are shrunk in the browser to 64 px and at most 24,000 characters, so the whole list is at most about 5 MB, usually far less.
- **Desktop notifications cost nothing.** They come from the room list's listener.
- **A local cache.**
  - Firestore keeps a persistent cache, shared across tabs.
  - A listener that reconnects within 30 minutes is billed only for documents that changed.
  - After 30 minutes offline, the listener counts as a new query.
- **Unread markers cost nothing.** They live in the browser's `localStorage`, not in Firestore. The trade-off: another device does not know what you read here. Recently used emoji and the notification setting are kept the same way.
- **Small documents.**
  - A message holds at most 2,000 characters, so at most a few KB. Reactions add at most 10 per member, about 40 KB in a full room of 100.
  - A room holds at most 100 member ids, plus one message copy, so about 12 KB at worst.
  - Firestore's limit is 1 MiB per document, far away.
  - Message text, reactions and emoji images are left out of indexing, which saves storage and write work.

A rough budget: sending a message costs 2 writes (the message and the room's preview), so 20,000 writes a day allow about 10,000 messages. A reaction costs 1 write; a reply costs one more read, for the rules to check the original. Opening the app and one busy room costs roughly:

- the rooms in your list;
- 30 messages;
- one read for the rules' membership check;
- one read per new face.

That comes to about 50 reads, so 50,000 reads allow about 1,000 such visits a day.

The first visit downloads about 250 KB, compressed. The emoji table (about 63 KB) loads the first time someone opens the picker or types `:name`. Later visits reuse the cached files, which are fingerprinted and cached for a year; only `index.html` is fetched again. So 360 MB a day of Hosting covers more than a thousand new visitors a day.

Two things can still use up a quota: a very busy room, or someone signed in who hammers the API on purpose. For the second, see [App Check](https://firebase.google.com/docs/app-check) in _Not included_.

## What is not included, and why

| Feature                         | Why it is left out                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Images, files, uploaded avatars | **Cloud Storage for Firebase requires the paid Blaze plan.** Since 2026-02-03, a Spark project has no access to any Storage bucket ([Firebase FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)). Avatars are initials instead. Custom emoji fit because they are tiny: they are stored in Firestore as data URLs. |
| Push notifications              | Sending a push needs a trusted server holding the project's credentials; a browser cannot do it safely. The usual server is Cloud Functions, which also needs Blaze. The app shows desktop notifications while it is open, even in a background tab, and unread markers.                                                                                 |
| Cloud Functions (server code)   | Needs the Blaze plan. Everything the app needs is enforced by the security rules instead.                                                                                                                                                                                                                                                                |
| Online status and "typing…"     | Both need a stream of writes from every open tab, which uses up the 20,000 daily writes fast.                                                                                                                                                                                                                                                            |
| Searching for people            | Searching by email or name would make every profile listable. Profiles can only be fetched one by one, by id, and you learn ids by sharing a room.                                                                                                                                                                                                       |
| Blocking people                 | Not in this version. A room owner can remove members.                                                                                                                                                                                                                                                                                                    |
| Deleting your account           | Removing someone's messages from every room safely needs a server.                                                                                                                                                                                                                                                                                       |
| App Check                       | Free (reCAPTCHA Enterprise has a free tier) and recommended once you go public, but it needs keys from your project. Add it when you launch.                                                                                                                                                                                                             |

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

| Path                           | Fields                                                                                                         | Who may do what                                                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users/{uid}`                  | `displayName`, `createdAt`, `updatedAt`                                                                        | Anyone signed in may fetch one profile; nobody may list them. Only you write yours. The email stays in Authentication.                                                                 |
| `rooms/{roomId}`, group        | `type`, `name`, `ownerId`, `memberIds`, `inviteCode`, `lastJoin`, `lastMessage`, `createdAt`, `lastActivityAt` | Members read. The owner renames, resets the code, removes members, deletes. Members leave and refresh the preview.                                                                     |
| `rooms/{uidA_uidB}`, 1-to-1    | `type`, `memberIds`, `lastMessage`, `createdAt`, `lastActivityAt`                                              | The two members only. The id is both uids, sorted, so a pair has one room.                                                                                                             |
| `rooms/{roomId}/messages/{id}` | `senderId`, `text`, `createdAt`, `editedAt`, `deleted`, `replyTo`, and `reactions` once someone reacts         | Members read, 30 at a time, and send. The sender edits or soft-deletes. Any member reacts, changing only `reactions.{their uid}`. The group owner hard-deletes when deleting the room. |
| `invites/{code}`               | `roomId`, `createdBy`, `createdAt`                                                                             | Anyone signed in may fetch a code they know; nobody may list codes.                                                                                                                    |
| `customEmoji/{name}`           | `image`, `createdBy`, `createdAt`                                                                              | Anyone signed in reads, lists one capped page, and adds. No update. The person who added it, or an admin, deletes.                                                                     |
| `meta/customEmoji`             | `count`, `lastName`                                                                                            | Moves by one in the same batch as each emoji added or deleted, which caps the set at `customEmojiMax`.                                                                                 |
| `admins/{uid}`                 | any                                                                                                            | Written in the Firebase console only. A client may check its own entry.                                                                                                                |

How joining works without a server:

1. The joiner looks up `invites/{code}` to find the room.
2. The joiner adds their own uid to `memberIds`.
3. In the same write, the joiner sets `lastJoin = {uid, code}`. The rules accept the join only if that code equals the room's current `inviteCode`.
4. The joiner cannot read the room before joining, so they cannot learn the code from it.

A message's `replyTo` holds the original's id and sender; the rules check both against a real message in the room. A mention is stored in the text as `<@uid>`, as in Slack, so it still points at the right person after a rename.

Resetting the code swaps the invite in one batch, so the old link stops working at once. A removed member who still knows the current code can rejoin. That is why the app suggests resetting the code after removing someone.

## Project structure

```
firestore/              security rules, indexes, limits.json, and the rules test suite
scripts/                setup, emulator, config-check and emoji-table scripts (Node)
src/
  environments/         environment.ts (emulators), the per-user config and its template
  app/
    core/               app-wide services and models, no UI
      auth/             AuthService and route guards
      data/             Firestore access: profiles, rooms, messages, custom emoji; unread markers and recent emoji
      errors/           error codes → translated messages
      firebase/         providers for the Firebase app, Auth and Firestore
      i18n/             I18nService and the en / vi dictionaries
      models/           document types and their parsers
      notifications/    desktop notifications and the tab title
    shared/             reusable UI (avatar, icon, dialog, language switcher), the emoji table, and utils
    features/           one folder per screen: auth, onboarding, workspace, chat, rooms, direct, emoji, profile
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
- **Admins:** an admin may delete anyone's custom emoji. The role is already in the rules that setup deploys; you only list who has it. The list is the Firestore collection `admins`, and the rules let no client write to it, so a user can never make themselves an admin: only the Firebase console can.
  1. The person signs in to the app once, so their account exists.
  2. In the Firebase console, open _Build → Authentication → Users_ and copy their **User UID** (the copy icon next to it). The email column tells you who is who.
  3. Open _Build → Firestore Database → Data_. Choose _Start collection_ (the first time) with the collection ID `admins`, or open `admins` and choose _Add document_.
  4. Paste the UID as the **Document ID**. Add one field so the list is readable, for example `email` (string) set to their address; the rules only look at the ID.
  5. The person reloads the app. To take the role back, delete the document.

  On the emulators (`npm run dev`), do the same in the Emulator UI at http://127.0.0.1:4000: the users are under _Authentication_, the data under _Firestore_.

- **Emoji table:** after upgrading `emojibase-data`, run `npm run emoji-data` and commit the new `unicode-emoji.json`. Emoji newer than version 15 are left out, since many devices cannot draw them yet.

## Troubleshooting

- **`Could not start Firestore Emulator, port taken`**
  - Another emulator is still running. Stop it, or change the port in `firebase.json`.
  - On Windows with Oracle's Java, the `java` on PATH is a launcher. If the CLI stops only the launcher, the emulator keeps running. The npm scripts work around this. If you run `npx firebase emulators:*` yourself, put your JDK's `bin` folder first on PATH, or end the leftover `java` process.
- **`java` not found:** only needed when running the local offline emulator (`npm run dev` / `npm run test:rules`). Install a JDK (21 or newer) and open a new terminal, or run `npm run setup` to deploy directly to Firebase without Java.
- **`npm start` / `npm run build` says the copy is not connected:** run `npm run setup`, or use `npm run dev`.
- **The room list stays empty right after the first deploy:** the composite index is still building. Wait a few minutes and reload.
- **Google sign-in fails with `auth/unauthorized-domain`:** add your domain under _Authentication → Settings → Authorized domains_.
- **"This sign-in method is not enabled":** enable Email/Password or Google under _Authentication → Sign-in method_.
- **npm warns that install scripts were skipped:** newer npm versions skip package install scripts unless you approve them. Nothing in this kit needs them.

## Contributing

See [RULES.md](RULES.md) for how this repository works: branches, commits, code rules, the security-rules checklist and the quality gates.

## License

No license has been chosen yet: all rights reserved.
