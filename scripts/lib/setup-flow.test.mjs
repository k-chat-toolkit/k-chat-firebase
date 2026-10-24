import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { projectIdFromEnvironment, projectIdFromFirebaserc } from './config-files.mjs';
import { NeedsAnswerError } from './prompt.mjs';
import { renderNextSteps, runSetup, SetupError } from './setup-flow.mjs';

const SDK_CONFIG = {
  apiKey: 'AIzaFakeKey',
  authDomain: 'my-chat.firebaseapp.com',
  projectId: 'my-chat',
  appId: '1:1:web:a',
  messagingSenderId: '1',
};

/** A fake Firebase CLI: canned answers per command, and a log of what ran. */
function fakeCli(overrides = {}) {
  const answers = {
    'login:list': [{ user: { email: 'me@example.com' } }],
    'projects:list': [{ projectId: 'my-chat', displayName: 'My chat' }],
    'apps:list': [{ appId: '1:1:web:a', displayName: 'Web' }],
    'apps:create': { appId: '1:1:web:new' },
    'apps:sdkconfig': { sdkConfig: SDK_CONFIG },
    'firestore:databases:list': [
      {
        name: 'projects/my-chat/databases/(default)',
        type: 'FIRESTORE_NATIVE',
        locationId: 'nam5',
      },
    ],
    ...overrides,
  };
  const ran = [];
  return {
    ran,
    json: async (args) => {
      ran.push(['json', ...args]);
      return structuredClone(answers[args[0]]);
    },
    run: async (args) => {
      ran.push(['run', ...args]);
      return 0;
    },
  };
}

function fakeFiles(initial = {}) {
  const store = { ...initial };
  return {
    store,
    read: (name) => store[name] ?? null,
    write: (name, text) => (store[name] = text),
  };
}

/** A prompt that must not be used: setup should not ask when the answer is known. */
const silentPrompt = {
  choose: async (question) => {
    throw new NeedsAnswerError(question);
  },
  confirm: async (question) => {
    throw new NeedsAnswerError(question);
  },
};

const log = { step() {}, info() {} };

describe('runSetup', () => {
  it('writes both config files and deploys the rules for a ready project', async () => {
    const cli = fakeCli();
    const files = fakeFiles();
    const result = await runSetup({
      cli,
      prompt: silentPrompt,
      files,
      log,
      options: { project: 'my-chat' },
    });
    assert.deepEqual(result, { projectId: 'my-chat', appId: '1:1:web:a' });
    assert.equal(projectIdFromEnvironment(files.store.environment), 'my-chat');
    assert.equal(projectIdFromFirebaserc(files.store.firebaserc), 'my-chat');
    assert.deepEqual(cli.ran.at(-1), [
      'run',
      'deploy',
      '--only',
      'firestore:rules,firestore:indexes',
      '--project',
      'my-chat',
    ]);
  });

  it('creates a missing web app and database when told to', async () => {
    const cli = fakeCli({ 'apps:list': [], 'firestore:databases:list': [] });
    const files = fakeFiles();
    await runSetup({
      cli,
      prompt: silentPrompt,
      files,
      log,
      options: { project: 'my-chat', location: 'asia-southeast1', yes: true },
    });
    assert.ok(cli.ran.some((call) => call[1] === 'apps:create'));
    const create = cli.ran.find((call) => call[1] === 'firestore:databases:create');
    assert.deepEqual(create.slice(2), [
      '(default)',
      '--location',
      'asia-southeast1',
      '--edition',
      'standard',
      '--project',
      'my-chat',
    ]);
  });

  it('asks which project when the account has several and none was given', async () => {
    const cli = fakeCli({
      'projects:list': [{ projectId: 'other' }, { projectId: 'my-chat', displayName: 'My chat' }],
    });
    const asked = [];
    const prompt = {
      ...silentPrompt,
      choose: async (question, choices) => {
        asked.push(question);
        return choices[1].value;
      },
    };
    const result = await runSetup({ cli, prompt, files: fakeFiles(), log, options: {} });
    assert.equal(result.projectId, 'my-chat');
    assert.equal(asked.length, 1);
  });

  it('refuses a project the account does not have', async () => {
    await assert.rejects(
      runSetup({
        cli: fakeCli(),
        prompt: silentPrompt,
        files: fakeFiles(),
        log,
        options: { project: 'nope' },
      }),
      SetupError,
    );
  });

  it('asks before replacing a config for another project', async () => {
    const files = fakeFiles({ environment: "projectId: 'old-project'," });
    await assert.rejects(
      runSetup({
        cli: fakeCli(),
        prompt: silentPrompt,
        files,
        log,
        options: { project: 'my-chat' },
      }),
      NeedsAnswerError,
    );
    assert.equal(files.store.environment, "projectId: 'old-project',");
  });

  it('stops on a Datastore-mode database', async () => {
    const cli = fakeCli({
      'firestore:databases:list': [
        { name: 'projects/my-chat/databases/(default)', type: 'DATASTORE_MODE' },
      ],
    });
    await assert.rejects(
      runSetup({
        cli,
        prompt: silentPrompt,
        files: fakeFiles(),
        log,
        options: { project: 'my-chat' },
      }),
      /Datastore mode/,
    );
  });

  it('skips the deploy with --skip-deploy', async () => {
    const cli = fakeCli();
    await runSetup({
      cli,
      prompt: silentPrompt,
      files: fakeFiles(),
      log,
      options: { project: 'my-chat', skipDeploy: true },
    });
    assert.ok(!cli.ran.some((call) => call[1] === 'deploy'));
  });
});

describe('renderNextSteps', () => {
  it("links the project's sign-in providers, users list and Firestore data", () => {
    const text = renderNextSteps('my-chat');
    for (const path of [
      'authentication/providers',
      'authentication/users',
      'firestore/databases/-default-/data',
    ]) {
      assert.ok(text.includes(`https://console.firebase.google.com/project/my-chat/${path}`), path);
    }
  });

  it('does not claim the rules are live after --skip-deploy', () => {
    assert.match(renderNextSteps('my-chat'), /rules and indexes are live/);
    assert.match(renderNextSteps('my-chat', { deployed: false }), /not deployed yet/);
  });

  it('says how to make an admin, and that only the console can', () => {
    const text = renderNextSteps('my-chat');
    assert.match(text, /"admins"/);
    assert.match(text, /Document ID is that UID/);
    assert.match(text, /Only the console can add or remove admins/);
  });
});
