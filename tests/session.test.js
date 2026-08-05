// Unit tests for session persistence — checklist §1.2.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  clearSession,
  createMemoryStorage,
  createSlot,
  getActiveSlotCount,
  getCurrentRound,
  getFrozenSlotCount,
  getRoundHistory,
  getState,
  getTotalRounds,
  loadSession,
  replaceState,
  resetState,
  saveSession,
  setStorageBackend,
  setTotalRounds,
  updateSlotTitle,
} from '../src/data/index.js';

describe('Session state & persistence (§1.2)', () => {
  beforeEach(() => {
    setStorageBackend(createMemoryStorage());
    clearSession();
    loadSession();
  });

  it('loadSession falls back to a default single-slot state', () => {
    const state = getState();

    assert.equal(state.slots.length, 1);
    assert.equal(state.slots[0].title, 'New Slot');
    assert.equal(state.currentRound, 1);
    assert.equal(state.totalRounds, 20);
    assert.deepEqual(state.roundHistory, []);
  });

  it('derived getters reflect current session values', () => {
    assert.equal(getCurrentRound(), 1);
    assert.equal(getTotalRounds(), 20);
    assert.equal(getActiveSlotCount(), 1);
    assert.equal(getFrozenSlotCount(), 0);
    assert.deepEqual(getRoundHistory(), []);

    createSlot('Second');
    createSlot('Third');
    assert.equal(getActiveSlotCount(), 3);

    setTotalRounds(12);
    assert.equal(getTotalRounds(), 12);
  });

  it('getFrozenSlotCount counts slots with frozen=true', () => {
    const session = getState();
    session.slots.push({
      id: 'frozen-slot',
      title: 'Deck',
      options: [],
      frozen: true,
      revealMode: 'gated',
      order: 1,
    });
    replaceState(session);

    assert.equal(getActiveSlotCount(), 1);
    assert.equal(getFrozenSlotCount(), 1);
  });

  it('saveSession persists full state and loadSession rehydrates it', () => {
    createSlot('Presenter');
    createSlot('Deck');
    updateSlotTitle(getState().slots[1].id, 'Renamed Presenter');
    setTotalRounds(8);

    const beforeSave = getState();
    saveSession();

    resetState();
    const reloaded = loadSession();

    assert.deepEqual(reloaded.slots.map((s) => s.title), beforeSave.slots.map((s) => s.title));
    assert.equal(reloaded.totalRounds, 8);
    assert.equal(reloaded.currentRound, 1);
    assert.deepEqual(reloaded.roundHistory, []);
  });

  it('mutations auto-save so reload matches pre-refresh snapshot', () => {
    const deck = createSlot('Deck');
    updateSlotTitle(deck.id, 'Wildcard');
    setTotalRounds(5);

    const snapshot = getState();

    resetState();
    const restored = loadSession();

    assert.equal(restored.slots.length, snapshot.slots.length);
    assert.equal(restored.totalRounds, snapshot.totalRounds);
    assert.equal(
      restored.slots.find((slot) => slot.id === deck.id)?.title,
      'Wildcard',
    );
  });

  it('loadSession recovers from corrupt storage with defaults', () => {
    const memory = createMemoryStorage();
    setStorageBackend(memory);
    memory.setItem('soviet-spinners-session', '{not valid json');

    const restored = loadSession();
    assert.equal(restored.slots.length, 1);
    assert.equal(restored.slots[0].title, 'New Slot');
  });
});
