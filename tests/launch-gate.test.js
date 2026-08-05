// Unit tests for gated launch orchestration — checklist §6.1.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LAUNCH_STORAGE_PREFIX,
  consumeLaunchPayload,
  createLaunchToken,
  openGatedLaunch,
  parseLaunchTokenFromHash,
  prepareGatedLaunch,
  storeLaunchPayload,
} from '../src/ui/launch-gate.js';
import { MemoryStorage } from './helpers/memory-storage.js';

describe('Launch gate (§6.1)', () => {
  it('stores presentation URLs under opaque tokens only', () => {
    const storage = new MemoryStorage();
    const token = 'abc123';
    const url = 'https://docs.google.com/presentation/d/abc/present';

    storeLaunchPayload(token, url, storage);

    assert.equal(storage.getItem(`${LAUNCH_STORAGE_PREFIX}${token}`), url);
    assert.equal(storage.getItem(url), null);
  });

  it('prepareGatedLaunch puts token in hash fragment, not the Slides URL', () => {
    const token = 'launch-token';
    const url = 'https://docs.google.com/presentation/d/secret-id/present';
    const handle = prepareGatedLaunch(token, url, new MemoryStorage());

    assert.equal(handle.launchPath, 'launch.html#launch-token');
    assert.ok(!handle.launchPath.includes('secret-id'));
    assert.ok(!handle.launchPath.includes('docs.google.com'));
  });

  it('consumeLaunchPayload reads once and clears storage', () => {
    const storage = new MemoryStorage();
    const token = 'once';
    const url = 'https://docs.google.com/presentation/d/once/present';

    storeLaunchPayload(token, url, storage);
    assert.equal(consumeLaunchPayload(token, storage), url);
    assert.equal(consumeLaunchPayload(token, storage), null);
  });

  it('openGatedLaunch opens launch page and rolls back when pop-up blocked', () => {
    const storage = new MemoryStorage();
    /** @type {string[]} */
    const opened = [];

    assert.throws(
      () =>
        openGatedLaunch('https://docs.google.com/presentation/d/x/present', {
          createToken: () => 'blocked-token',
          storage,
          openWindow: () => null,
        }),
      /Pop-up blocked/,
    );

    assert.equal(storage.getItem(`${LAUNCH_STORAGE_PREFIX}blocked-token`), null);

    openGatedLaunch('https://docs.google.com/presentation/d/x/present', {
      createToken: () => 'ok-token',
      storage,
      openWindow: (path) => {
        opened.push(path);
        return {};
      },
    });

    assert.deepEqual(opened, ['launch.html#ok-token']);
  });

  it('parseLaunchTokenFromHash strips the leading hash', () => {
    assert.equal(parseLaunchTokenFromHash('#token-value'), 'token-value');
    assert.equal(parseLaunchTokenFromHash(''), null);
  });

  it('createLaunchToken returns a non-empty string', () => {
    assert.ok(createLaunchToken().length > 8);
  });
});
