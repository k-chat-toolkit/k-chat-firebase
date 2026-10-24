import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  pickWebConfig,
  projectIdFromEnvironment,
  projectIdFromFirebaserc,
  renderEnvironmentFile,
  renderFirebaserc,
} from './config-files.mjs';

const SDK_CONFIG = {
  projectId: 'my-chat',
  appId: '1:1234:web:abcd',
  storageBucket: 'my-chat.firebasestorage.app',
  apiKey: 'AIzaFakeKey-123',
  authDomain: 'my-chat.firebaseapp.com',
  messagingSenderId: '1234',
  measurementId: 'G-XYZ',
};

describe('pickWebConfig', () => {
  it('keeps only the fields the app uses', () => {
    assert.deepEqual(pickWebConfig(SDK_CONFIG), {
      apiKey: 'AIzaFakeKey-123',
      authDomain: 'my-chat.firebaseapp.com',
      projectId: 'my-chat',
      appId: '1:1234:web:abcd',
      messagingSenderId: '1234',
    });
  });

  it('rejects a config without a required field', () => {
    assert.throws(() => pickWebConfig({ ...SDK_CONFIG, apiKey: '' }), /apiKey/);
  });

  it('rejects a value that would need escaping', () => {
    assert.throws(
      () => pickWebConfig({ ...SDK_CONFIG, projectId: "x'; alert(1); '" }),
      /projectId/,
    );
  });
});

describe('environment file', () => {
  it('round-trips the project id', () => {
    const text = renderEnvironmentFile(pickWebConfig(SDK_CONFIG));
    assert.match(text, /export const environment: AppEnvironment = \{/);
    assert.equal(projectIdFromEnvironment(text), 'my-chat');
  });

  it('treats the template placeholders as no project', () => {
    assert.equal(projectIdFromEnvironment("projectId: 'YOUR_PROJECT_ID',"), null);
  });
});

describe('.firebaserc', () => {
  it('round-trips the default project', () => {
    assert.equal(projectIdFromFirebaserc(renderFirebaserc('my-chat')), 'my-chat');
  });

  it('returns null for broken JSON', () => {
    assert.equal(projectIdFromFirebaserc('{'), null);
  });
});
