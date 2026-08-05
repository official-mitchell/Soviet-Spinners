// Unit tests for session normalization on load — review follow-up.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  clearSession,
  createMemoryStorage,
  getState,
  loadSession,
  normalizeSession,
  setStorageBackend,
  writeRaw,
} from '../src/data/index.js';

describe('Session normalization', () => {
  beforeEach(() => {
    setStorageBackend(createMemoryStorage());
    clearSession();
  });

  it('normalizeSession repairs partial slot and option shapes', () => {
    const normalized = normalizeSession({
      slots: [
        {
          title: 'Presenter',
          options: [{ label: 'Jordan' }, { label: '  ' }, { label: 'Taylor', id: 'opt-1' }],
        },
      ],
      totalRounds: -3,
      currentRound: 0,
      roundHistory: [{ roundNumber: 1, results: [{ slotId: 'a', optionId: 'b' }] }],
    });

    assert.equal(normalized.slots.length, 1);
    assert.equal(normalized.slots[0].title, 'Presenter');
    assert.equal(typeof normalized.slots[0].id, 'string');
    assert.deepEqual(normalized.slots[0].options.map((option) => option.label), ['Jordan', 'Taylor']);
    assert.equal(normalized.totalRounds, 20);
    assert.equal(normalized.currentRound, 1);
    assert.equal(normalized.roundHistory.length, 1);
  });

  it('loadSession persists repaired state after normalization', () => {
    writeRaw(JSON.stringify({
      slots: [{ title: 'Deck', options: [{ label: 'Slides' }] }],
      totalRounds: 12,
      currentRound: 2,
      roundHistory: [],
    }));

    loadSession();

    const reloaded = getState();
    assert.equal(reloaded.slots[0].title, 'Deck');
    assert.deepEqual(reloaded.slots[0].options.map((option) => option.label), ['Slides']);
    assert.equal(reloaded.totalRounds, 12);
    assert.equal(reloaded.currentRound, 2);
  });

  it('loadSession falls back to defaults when no valid slots remain', () => {
    writeRaw(JSON.stringify({ slots: [], totalRounds: 5, currentRound: 1, roundHistory: [] }));
    const restored = loadSession();

    assert.equal(restored.slots.length, 1);
    assert.equal(restored.slots[0].title, 'New Slot');
  });
});
