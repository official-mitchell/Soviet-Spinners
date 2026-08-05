// Unit tests for launch interstitial display — checklist §6.1.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  getInterstitialVisibleText,
  interstitialTextLeaksUrl,
  runLaunchInterstitial,
  startCountdown,
} from '../src/ui/launch-display.js';
import { MemoryStorage } from './helpers/memory-storage.js';

const SECRET_URL = 'https://docs.google.com/presentation/d/secret-deck-id/present';

describe('Launch interstitial (§6.1)', () => {
  it('visible interstitial copy never includes the Slides URL or deck id', () => {
    const visibleText = getInterstitialVisibleText();

    assert.equal(interstitialTextLeaksUrl(visibleText, SECRET_URL), false);
    assert.ok(!visibleText.includes('secret-deck-id'));
    assert.ok(!visibleText.includes('docs.google.com'));
  });

  it('launch.html contains no anchors or Slides URL text', () => {
    const html = readFileSync(new URL('../launch.html', import.meta.url), 'utf8');

    assert.ok(!html.includes('<a '));
    assert.ok(!html.includes('docs.google.com'));
    assert.ok(!html.includes('/presentation/d/'));
  });

  it('runLaunchInterstitial navigates after countdown without writing URL to DOM', () => {
    const storage = new MemoryStorage();
    storage.setItem('soviet-spinners:launch:token-1', SECRET_URL);

    /** @type {string[]} */
    const navigated = [];
    /** @type {string[]} */
    const domValues = [];

    runLaunchInterstitial({
      location: { hash: '#token-1', replace: () => undefined },
      storage,
      document: {
        querySelector(selector) {
          if (selector === '[data-countdown]') {
            return {
              textContent: '4',
              set textContent(value) {
                domValues.push(String(value));
              },
            };
          }

          return null;
        },
        documentElement: {
          requestFullscreen: () => Promise.resolve(),
        },
      },
      requestFullscreen: () => Promise.resolve(),
      replaceLocation: (url) => navigated.push(url),
      startCountdown: (_seconds, onTick, onComplete) => {
        onTick(1);
        onComplete();
        return () => undefined;
      },
      onNavigate: (url) => navigated.push(url),
    });

    assert.deepEqual(navigated, [SECRET_URL]);
    assert.ok(domValues.every((value) => !value.includes('secret-deck-id')));
    assert.ok(domValues.every((value) => !value.includes('docs.google.com')));
  });

  it('startCountdown ticks down and completes', () => {
    /** @type {number[]} */
    const ticks = [];
    let completed = false;

    startCountdown(
      2,
      (secondsRemaining) => ticks.push(secondsRemaining),
      () => {
        completed = true;
      },
      {
        setIntervalFn: (callback) => {
          callback();
          callback();
          return 1;
        },
        clearIntervalFn: () => undefined,
      },
    );

    assert.deepEqual(ticks, [2, 1]);
    assert.equal(completed, true);
  });
});
