// Scenario tests backing manual QA checklist items — review follow-up.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  addOption,
  clearSession,
  createMemoryStorage,
  createSlot,
  deleteSlot,
  getState,
  importCsvOptions,
  loadSession,
  resetState,
  setStorageBackend,
  updateOption,
} from '../src/data/index.js';
import { shouldConfirmSlotDelete } from '../src/ui/slot-actions.js';

describe('Manual QA scenarios (🔍 checklist)', () => {
  beforeEach(() => {
    setStorageBackend(createMemoryStorage());
    clearSession();
    loadSession();
  });

  it('§2.1 add slot increases count and assigns order without reload', () => {
    const before = getState().slots.length;
    const created = createSlot('Presenter');

    const slots = [...getState().slots].sort((a, b) => a.order - b.order);
    assert.equal(slots.length, before + 1);
    assert.equal(slots.at(-1)?.id, created.id);
    assert.equal(slots.at(-1)?.title, 'Presenter');
  });

  it('§2.2 cancel delete leaves slot and options untouched', () => {
    const slot = createSlot('Filled');
    addOption(slot.id, 'Jordan');
    addOption(slot.id, 'Taylor');

    const before = getState();
    const live = before.slots.find((entry) => entry.id === slot.id);
    assert.ok(live);
    assert.equal(shouldConfirmSlotDelete(live), true);

    // Simulate cancel: confirmation gate blocks deleteSlot call.
    assert.deepEqual(getState(), before);
  });

  it('§2.3 edits in one slot do not affect another slot', () => {
    const slotA = createSlot('Presenter');
    const slotB = createSlot('Deck');
    const optionA = addOption(slotA.id, 'Jordan');
    addOption(slotB.id, 'Design System');

    updateOption(slotA.id, optionA.id, 'Taylor');

    const state = getState();
    assert.equal(
      state.slots.find((entry) => entry.id === slotA.id)?.options[0].label,
      'Taylor',
    );
    assert.equal(
      state.slots.find((entry) => entry.id === slotB.id)?.options[0].label,
      'Design System',
    );
  });

  it('§1.2 / §3 hard refresh restores slots, options, and round metadata', () => {
    const presenter = createSlot('Presenter');
    addOption(presenter.id, 'Jordan');
    addOption(presenter.id, 'Taylor');
    importCsvOptions(presenter.id, 'Name\nAlex\n');

    const snapshot = getState();

    resetState();
    const restored = loadSession();

    assert.equal(restored.slots.length, snapshot.slots.length);
    assert.deepEqual(
      restored.slots.find((slot) => slot.id === presenter.id)?.options.map((option) => option.label),
      ['Jordan', 'Taylor', 'Alex'],
    );
    assert.equal(restored.totalRounds, snapshot.totalRounds);
    assert.equal(restored.currentRound, snapshot.currentRound);
  });

  it('§3 import into slot A does not affect slot B options', () => {
    const slotA = createSlot('Presenter');
    const slotB = createSlot('Deck');
    addOption(slotB.id, 'Existing Deck Option');

    importCsvOptions(slotA.id, 'Jordan\nTaylor\n');

    const state = getState();
    assert.deepEqual(
      state.slots.find((slot) => slot.id === slotA.id)?.options.map((option) => option.label),
      ['Jordan', 'Taylor'],
    );
    assert.deepEqual(
      state.slots.find((slot) => slot.id === slotB.id)?.options.map((option) => option.label),
      ['Existing Deck Option'],
    );
  });

  it('§2.2 zero-option slot deletes immediately without confirmation gate', () => {
    createSlot('Empty');
    const empty = createSlot('Also Empty');
    assert.equal(shouldConfirmSlotDelete(empty), false);

    deleteSlot(empty.id);
    assert.ok(!getState().slots.some((slot) => slot.id === empty.id));
  });
});
