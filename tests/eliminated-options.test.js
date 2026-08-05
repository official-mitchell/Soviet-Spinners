// Unit tests for per-round option elimination — no repeat draws.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  addOption,
  clearSession,
  createMemoryStorage,
  createSlot,
  forceSelect,
  getState,
  loadSession,
  setStorageBackend,
  spinUnfrozen,
  writeRaw,
} from '../src/data/index.js';
import { normalizeSession } from '../src/data/models.js';

describe('Eliminated options', () => {
  beforeEach(() => {
    setStorageBackend(createMemoryStorage());
    clearSession();
  });

  it('spin removes the drawn option from the active pool and records it as eliminated', () => {
    const slot = getState().slots[0];
    addOption(slot.id, 'Alpha');
    addOption(slot.id, 'Beta');

    spinUnfrozen();

    const updated = getState().slots[0];
    assert.equal(updated.options.length, 1);
    assert.equal(updated.eliminatedOptions?.length, 1);
    assert.ok(updated.eliminatedOptions?.some((option) => option.label === updated.currentResult?.label));
  });

  it('eliminated options cannot be force-selected again', () => {
    const slot = getState().slots[0];
    addOption(slot.id, 'Only pick');
    spinUnfrozen();

    const eliminatedId = getState().slots[0].eliminatedOptions?.[0]?.id;
    assert.ok(eliminatedId);
    assert.throws(() => forceSelect(slot.id, eliminatedId), /Option not found/);
  });

  it('normalizeSession backfills eliminated options from round history', () => {
    const slot = getState().slots[0];
    addOption(slot.id, 'Historical pick');
    spinUnfrozen();

    const snapshot = getState();
    snapshot.slots[0].eliminatedOptions = [];

    writeRaw(JSON.stringify(snapshot));
    loadSession();

    const reloaded = getState().slots[0];
    assert.equal(reloaded.options.length, 0);
    assert.equal(reloaded.eliminatedOptions?.length, 1);
    assert.equal(reloaded.eliminatedOptions?.[0]?.label, 'Historical pick');
  });

  it('each slot tracks its own eliminated options independently', () => {
    const slotA = getState().slots[0];
    const slotB = createSlot('Deck');
    addOption(slotA.id, 'Presenter');
    addOption(slotB.id, 'Deck one');
    addOption(slotB.id, 'Deck two');

    spinUnfrozen();

    const state = getState();
    assert.equal(state.slots.find((entry) => entry.id === slotA.id)?.eliminatedOptions?.length, 1);
    assert.equal(state.slots.find((entry) => entry.id === slotB.id)?.eliminatedOptions?.length, 1);
    assert.equal(state.slots.find((entry) => entry.id === slotB.id)?.options.length, 1);
  });
});

describe('reconcileEliminatedOptions', () => {
  it('does not duplicate entries already present in eliminatedOptions', () => {
    const session = normalizeSession({
      slots: [
        {
          id: 'slot-1',
          title: 'Presenter',
          options: [],
          eliminatedOptions: [{ id: 'opt-1', label: 'Alpha' }],
          frozen: false,
          revealMode: 'immediate',
          order: 0,
        },
      ],
      totalRounds: 10,
      currentRound: 2,
      roundHistory: [
        {
          roundNumber: 1,
          results: [{ slotId: 'slot-1', optionId: 'opt-1', label: 'Alpha' }],
          forcedSlotIds: [],
          timestamp: Date.now(),
        },
      ],
    });

    assert.equal(session.slots[0].eliminatedOptions.length, 1);
  });
});
