# K-Chat Toolkit (Firebase)

A rapid-setup chat toolkit that you can deploy and host yourself in minutes, running entirely on Firebase's free **Spark** tier: Angular 22 on Firebase Hosting, Firebase Authentication, and Cloud Firestore.

There are no servers to maintain, no containers to run, and no billing requirements for normal usage. Clone the repo, run a single setup command to connect your Firebase project, and launch your ready-to-use chat application.

---

## 📑 Table of Contents

- [🚀 Part 1: Clone & Deploy Instantly (For Users & Self-Hosters)](#-part-1-clone--deploy-instantly-for-users--self-hosters)
  - [1. Feature Matrix & Plan Requirements](#1-feature-matrix--plan-requirements)
  - [2. Prerequisites](#2-prerequisites)
  - [3. Instant Setup & Deploy (3 Steps)](#3-instant-setup--deploy-3-steps)
  - [4. Creating an Admin Account](#4-creating-an-admin-account)
  - [5. Staying on the Free Plan](#5-staying-on-the-free-plan)
  - [6. Common Deployment Gotchas](#6-common-deployment-gotchas)
- [🛠️ Part 2: Developer Guide (For Extending & Customizing)](#️-part-2-developer-guide-for-extending--customizing)
  - [1. Project Structure & Architecture](#1-project-structure--architecture)
  - [2. Multi-Backend Architecture (`BackendCapabilities`)](#2-multi-backend-architecture-backendcapabilities)
  - [3. Local Offline Development (Emulator Suite)](#3-local-offline-development-emulator-suite)
  - [4. Commands Reference](#4-commands-reference)
  - [5. Firebase CLI Power Tools](#5-firebase-cli-power-tools)
  - [6. Configuration & Secret Management](#6-configuration--secret-management)
  - [7. Security Rules & Data Model](#7-security-rules--data-model)
  - [8. Customization (Branding, Translations, Limits)](#8-customization-branding-translations-limits)
  - [9. Quality Gates & Contributing](#9-quality-gates--contributing)

---

# 🚀 Part 1: Clone & Deploy Instantly (For Users & Self-Hosters)

_Deploy your own private Slack-like chat application in under 5 minutes without touching backend code._

### 1. Feature Matrix & Plan Requirements

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
| **Languages**         | English & Vietnamese (instant switch)       |    ✅ Included    |                   Included                    | Active                 |
| **Media & Files**     | File & Image Attachments                    |   🔒 **Locked**   |     ⚡ **Requires Blaze** (Cloud Storage)     | Disabled with tooltip  |
|                       | User Photo Avatars                          |   🔒 **Locked**   |   ⚡ **Requires Blaze** (Initials on Spark)   | Initials avatar        |
| **Realtime Presence** | "User is typing..." Indicator               |   🔒 **Locked**   |    ⚡ High write frequency exhausts quota     | Disabled in config     |
|                       | Online / Offline Status Badge               |   🔒 **Locked**   |    ⚡ Heartbeat writes exhaust Spark quota    | Disabled in config     |
| **Push & Server**     | Mobile / Background Push Notifications      |   🔒 **Locked**   | ⚡ **Requires Blaze** (Cloud Functions / FCM) | Web notifications only |
|                       | Server-side Data Export / Webhooks          |   🔒 **Locked**   |    ⚡ **Requires Blaze** (Cloud Functions)    | Client-side only       |

---

### 2. Prerequisites

You only need two things to deploy your chat app:

1. **Node.js** 24.15 or newer (or 26+), with npm.
2. **A Google account** (to host on Firebase).

> [!NOTE]
> You do **not** need Java, Docker, or a global Firebase CLI. All tools and deployment utilities are bundled in this repository.

---

### 3. Instant Setup & Deploy (3 Steps)

#### Step 1: Create a free Firebase project

1. In the [Firebase Console](https://console.firebase.google.com), click **Create a project** (keep the free Spark plan).
2. Under **Build → Authentication → Sign-in method**, enable:
   - **Email/Password**
   - **Google** (select your support email).

#### Step 2: Clone and run the setup wizard

Open your terminal and run:

```bash
git clone https://github.com/k-chat-toolkit/k-chat-firebase.git k-chat
cd k-chat
npm ci
npm run setup
```

The interactive wizard will:

- Open a browser window to log in with your Google account.
- Let you choose your Firebase project.
- Automatically provision Cloud Firestore in your preferred region.
- Write your client environment configuration.
- Deploy the production security rules and composite indexes.

#### Step 3: Deploy to the web

```bash
npm run deploy
```

Once finished, the CLI will output your live URL:

```text
✔  Deploy complete!
Hosting URL: https://<your-project-id>.web.app
```

_(Optional: Run `npm start` before deploying if you wish to preview locally on `http://localhost:4300` against your live project)._

---

### 4. Creating an Admin Account

Admins can delete any custom emoji across the app. To make yourself an admin:

1. Sign in to your deployed chat app once so your user account is created.
2. In the [Firebase Console](https://console.firebase.google.com), open **Build → Authentication → Users** and copy your **User UID**.
3. Open **Build → Firestore Database → Data**. Click **Start collection** (or select existing `admins` collection):
   - **Collection ID:** `admins`
   - **Document ID:** Paste your **User UID**.
   - **Field:** Add a descriptive field (e.g., `email`: `your-email@example.com`).
4. Reload your chat app. You now have full admin privileges.

---

### 5. Staying on the Free Plan

The Firebase **Spark plan** offers generous daily and monthly allowances:

| Service             | Free Daily Allowance                                           | How K-Chat Stays Within Limits                                                                                                                                                                                         |
| :------------------ | :------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cloud Firestore** | 50,000 reads / day<br>20,000 writes / day<br>1 GiB stored data | • Tabs keep at most 3 realtime listeners.<br>• Older messages load in pages of 30 on demand.<br>• Room list uses last-message copies (1 read per room).<br>• Custom emoji are stored as compressed base64 (max 24 KB). |
| **Authentication**  | 50,000 monthly active users                                    | • Email/Password and Google sign-in are free.                                                                                                                                                                          |
| **Hosting**         | 10 GB stored<br>360 MB transfer / day                          | • Compressed initial bundle is ~250 KB.<br>• Assets are fingerprinted and cached for 1 year.                                                                                                                           |

There are no surprise bills: if daily quota is reached, operations pause until midnight Pacific Time.

---

### 6. Common Deployment Gotchas

- **Room list is empty right after first deploy:** Firestore composite indexes take 2–5 minutes to build on Google's servers. Refresh the page after a few minutes.
- **Google Sign-in error (`auth/unauthorized-domain`):** If you use a custom domain, add it under **Authentication → Settings → Authorized domains** in the Firebase Console.
- **"This sign-in method is not enabled":** Make sure you enabled Email/Password or Google under **Authentication → Sign-in method**.

---

# 🛠️ Part 2: Developer Guide (For Extending & Customizing)

_For developers who want to inspect the source code, run offline emulators, add features, or customize styling._

---

### 1. Project Structure & Architecture

```text
k-chat-firebase/
├── firestore/                  # Firestore security rules, composite indexes, and limits.json
├── scripts/                    # Interactive setup, emulator runner, and configuration validators
├── src/
│   ├── environments/           # Environment configuration (local emulator vs production)
│   ├── app/
│   │   ├── core/               # Singleton services, authentication, models, and i18n
│   │   │   ├── auth/           # AuthService and route guards
│   │   │   ├── backend/        # BackendCapabilities contract and feature flags
│   │   │   ├── data/           # Firestore data services (profiles, rooms, messages, emoji)
│   │   │   ├── firebase/       # Direct Firebase SDK providers (no AngularFire wrapper)
│   │   │   └── i18n/           # Translation dictionaries (English and Vietnamese)
│   │   ├── shared/             # Reusable UI primitives (dialogs, icons, avatar, formatting utils)
│   │   └── features/           # Screen modules: auth, workspace, chat, rooms, direct, profile
```

- **Architecture Standards:**
  - Standalone components throughout (`OnPush` change detection).
  - Reactive state managed using **Angular Signals**.
  - TypeScript path aliases strictly enforced: `@core/*`, `@shared/*`, `@features/*`, `@env/*`, `@limits`. Relative `../../` cross-layer imports are refused by ESLint.
  - Plain Firebase JS SDK with zero wrapper lag.

---

### 2. Multi-Backend Architecture (`BackendCapabilities`)

The frontend is decoupled from Firebase-specific assumptions using the `BackendCapabilities` contract (`@core/backend/backend-capabilities`):

```typescript
export interface BackendCapabilities {
  attachments: boolean; // File and image uploads
  typingIndicator: boolean; // Live typing notifications
  presence: boolean; // Online/offline status badges
  customEmoji: boolean; // User-uploaded custom emoji
  reactions: boolean; // Emoji reactions on messages
  replies: boolean; // Threaded quote replies
  formattingToolbar: boolean; // Slack-style markdown editor toolbar
  editMessage: boolean; // Message edit support
  deleteMessage: boolean; // Soft-delete support
  mentions: boolean; // Member @mention support
  pinnedMessages: boolean; // Message pinning
}
```

When integrating another backend (such as Convex, Supabase, or PocketBase), simply provide an alternate capabilities object. Any unsupported feature automatically and cleanly disables itself in the UI.

---

### 3. Local Offline Development (Emulator Suite)

If you have **Java 21+** installed, you can develop and test the entire stack completely offline without touching real Firebase servers:

```bash
npm run dev
```

1. Open `http://localhost:4300` (User 1).
2. Open `http://[::1]:4300` or an Incognito tab (User 2) to test realtime messaging.
3. Open `http://127.0.0.1:4000` to inspect local Authentication and Firestore records via the **Firebase Emulator UI**.
4. Test data persists locally in `.emulator-data/` between runs.

---

### 4. Commands Reference

| Command                  | Description                                                                   |
| :----------------------- | :---------------------------------------------------------------------------- |
| `npm run dev`            | Runs local Auth + Firestore emulators and starts the Angular dev server.      |
| `npm run emulators`      | Runs only the Firebase emulators with Emulator UI on `http://127.0.0.1:4000`. |
| `npm run setup`          | Connects to a Firebase project, creates database, and deploys rules.          |
| `npm start`              | Runs Angular dev server on `http://localhost:4300` against your live project. |
| `npm run build`          | Builds production artifacts into `dist/k-chat/browser`.                       |
| `npm run deploy`         | Full deploy: builds app, deploys Hosting, Firestore rules, and indexes.       |
| `npm run deploy:hosting` | **Fast deploy:** builds and deploys only Hosting (~5-10s).                    |
| `npm run deploy:rules`   | Deploys only Firestore security rules without rebuilding frontend.            |
| `npm test`               | Runs unit tests (82 Vitest tests + 25 Node test runner scripts).              |
| `npm run test:rules`     | Runs 126 security rules unit tests on the Firestore emulator.                 |
| `npm run lint`           | Runs ESLint, Prettier check, limits sync check, and emoji data check.         |
| `npm run format`         | Formats all source files with Prettier.                                       |
| `npm run limits`         | Syncs `firestore/limits.json` into `firestore.rules`.                         |
| `npm run emoji-data`     | Rebuilds `unicode-emoji.json` table from `emojibase-data`.                    |

**Default Port Allocations:**

- Angular App: `4300`
- Auth Emulator: `9099`
- Firestore Emulator: `8180`
- Hosting Emulator: `5050`
- Emulator UI: `4000`

---

### 5. Firebase CLI Power Tools

For fast, developer-friendly deployments without running full checks:

#### A. Fast Hosting Updates

```bash
npm run deploy:hosting
# or with a release message:
npm run build && npx firebase deploy --only hosting -m "Update composer styling"
```

#### B. Preview Channels (Temporary PR & Branch Demos)

Deploy to a preview channel without affecting live production:

```bash
npm run build
npx firebase hosting:channel:deploy pr-feature-preview --expires 24h
```

- List preview channels: `npx firebase hosting:channel:list`
- Delete preview channel: `npx firebase hosting:channel:delete pr-feature-preview`

#### C. Deploy Security Rules or Indexes Only

```bash
npx firebase deploy --only firestore:rules
npx firebase deploy --only firestore:indexes
```

#### D. Switch Environments (Dev / Staging / Prod)

```bash
npx firebase use --add    # Associate a project alias
npx firebase use prod     # Switch active project
npm run deploy
```

#### E. Instant Rollback

```bash
# Rollback live production to a previous version or preview channel:
npx firebase hosting:clone <project-id>:<channel-or-version> <project-id>:live
```

---

### 6. Configuration & Secret Management

| File                                               | Status            | Description                                            |          Secret?          |
| :------------------------------------------------- | :---------------- | :----------------------------------------------------- | :-----------------------: |
| `src/environments/environment.firebase.ts`         | Gitignored        | Active Firebase web app config.                        | No (public client config) |
| `src/environments/environment.firebase.example.ts` | Committed         | Template with placeholders.                            |            No             |
| `src/environments/environment.ts`                  | Committed         | Local emulator configuration (`demo-k-chat`).          |            No             |
| `.firebaserc`                                      | Gitignored        | Default Firebase CLI project target.                   |            No             |
| `firebase.json`                                    | Committed         | Hosting rewrite rules and emulator port mappings.      |            No             |
| `firestore/limits.json`                            | Committed         | Single source of truth for input lengths and caps.     |            No             |
| CLI OAuth Token                                    | Profile directory | Stored in `~/.config/configstore/firebase-tools.json`. |  **YES (Never commit)**   |

---

### 7. Security Rules & Data Model

Security in this architecture is 100% serverless: [`firestore/firestore.rules`](firestore/firestore.rules) is the sole authorization layer.

- **4 Core Rules Principles:**
  1. **Strict length limits:** User input caps live in `firestore/limits.json` and are synced to rules via `npm run limits`.
  2. **Pinned document schemas:** Creates require `hasAll` and `hasOnly`. Updates require `diff().affectedKeys().hasOnly(...)`. Extra fields are denied.
  3. **Server-side identity:** `senderId`, `ownerId`, and `createdBy` must match `request.auth.uid`. Timestamps must equal `request.time` (`serverTimestamp()`).
  4. **Strict emulator tests:** 126 unit tests in `firestore/tests/` verify allowed, denied, and malformed write cases.

```text
Firestore Collections:
├── users/{uid}                  # User profile (displayName, createdAt, updatedAt)
├── rooms/{roomId}               # Group chat rooms with member list and inviteCode
├── rooms/{uidA_uidB}            # 1-to-1 direct chat rooms
│   └── messages/{id}            # Realtime messages (text, senderId, replyTo, reactions)
├── invites/{code}               # Invite code to roomId mapping
├── customEmoji/{name}           # Custom emoji base64 images (max 200)
├── meta/customEmoji             # Atomic counter tracking customEmoji count
└── admins/{uid}                 # Admin permissions list (written in Console only)
```

---

### 8. Customization (Branding, Translations, Limits)

- **App Branding & Name:**
  - Update `app.name` in `src/app/core/i18n/locales/en.ts` and `vi.ts`.
  - Update `<title>` in `src/index.html`.
- **Styling & Design Tokens:**
  - Colors, typography, and dark-mode variables are defined at the top of `src/styles.css`.
- **Adding Languages:**
  - Copy `src/app/core/i18n/locales/vi.ts` to `src/app/core/i18n/locales/<locale>.ts`.
  - Register the new locale in `src/app/core/i18n/i18n.service.ts`.
- **Adjusting Data Limits:**
  - Modify `firestore/limits.json`, run `npm run limits`, and redeploy rules using `npm run deploy:rules`.

---

### 9. Quality Gates & Contributing

Before opening a pull request or merging to `main`, ensure all quality gates pass:

```bash
npm run lint          # 100% clean check (ESLint, Prettier, Limits, Emoji)
npm test              # 107/107 unit tests pass
npm run test:rules    # 126/126 security rules pass on emulator
```

Review [RULES.md](RULES.md) for branch naming conventions, commit formats, and repository standards.

---

## License

No license has been chosen yet: all rights reserved.
