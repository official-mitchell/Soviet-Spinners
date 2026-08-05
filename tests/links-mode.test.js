// Unit tests for links mode slots and option URLs.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  addOption,
  clearSession,
  clearSlotOptions,
  createMemoryStorage,
  createSlot,
  getState,
  loadSession,
  setSlotLinksMode,
  setStorageBackend,
  updateOptionLink,
} from '../src/data/index.js';

describe('Links mode', () => {
  beforeEach(() => {
    setStorageBackend(createMemoryStorage());
    clearSession();
    loadSession();
  });

  it('setSlotLinksMode toggles the slot flag', () => {
    const slot = createSlot('Links');
    setSlotLinksMode(slot.id, true);

    const refreshed = getState().slots.find((entry) => entry.id === slot.id);
    assert.equal(refreshed?.linksMode, true);
  });

  it('addOption stores an optional url', () => {
    const slot = createSlot('Links');
    const option = addOption(slot.id, 'Deck 1', 'https://example.com/deck');

    assert.equal(option.label, 'Deck 1');
    assert.equal(option.url, 'https://example.com/deck');
  });

  it('updateOptionLink normalizes bare domains', () => {
    const slot = createSlot('Links');
    const option = addOption(slot.id, 'Deck 1');
    const updated = updateOptionLink(slot.id, option.id, 'slides.google.com/presentation');

    assert.equal(updated.url, 'https://slides.google.com/presentation');
  });

  it('clearSlotOptions removes active and eliminated options', () => {
    const slot = createSlot('Links');
    addOption(slot.id, 'One', 'https://example.com/one');
    addOption(slot.id, 'Two', 'https://example.com/two');

    clearSlotOptions(slot.id);

    const refreshed = getState().slots.find((entry) => entry.id === slot.id);
    assert.deepEqual(refreshed?.options, []);
    assert.deepEqual(refreshed?.eliminatedOptions, []);
    assert.equal(refreshed?.currentResult, null);
  });
});
