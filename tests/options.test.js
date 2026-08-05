// Unit tests for option CRUD — checklist §2.3.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  addOption,
  clearSession,
  createMemoryStorage,
  createSlot,
  deleteOption,
  getState,
  loadSession,
  reorderOptions,
  resetState,
  setStorageBackend,
  toggleOptionHighlight,
  updateOption,
} from '../src/data/index.js';

describe('Option editing (§2.3)', () => {
  beforeEach(() => {
    setStorageBackend(createMemoryStorage());
    clearSession();
    loadSession();
  });

  it('addOption appends to the correct slot only', () => {
    const slotA = createSlot('Presenter');
    const slotB = createSlot('Deck');

    addOption(slotA.id, 'Jordan');
    addOption(slotB.id, 'Design System');

    const state = getState();
    assert.deepEqual(state.slots.find((s) => s.id === slotA.id)?.options.map((o) => o.label), ['Jordan']);
    assert.deepEqual(state.slots.find((s) => s.id === slotB.id)?.options.map((o) => o.label), ['Design System']);
  });

  it('updateOption and deleteOption are scoped to one slot', () => {
    const slotA = createSlot('A');
    const slotB = createSlot('B');
    const optionA = addOption(slotA.id, 'One');
    addOption(slotB.id, 'Two');

    updateOption(slotA.id, optionA.id, 'One Updated');
    deleteOption(slotA.id, optionA.id);

    const state = getState();
    assert.equal(state.slots.find((s) => s.id === slotA.id)?.options.length, 0);
    assert.equal(state.slots.find((s) => s.id === slotB.id)?.options[0].label, 'Two');
  });

  it('reorderOptions persists sequence after reload', () => {
    const slot = createSlot('Presenter');
    const first = addOption(slot.id, 'Jordan');
    const second = addOption(slot.id, 'Taylor');
    const third = addOption(slot.id, 'Alex');

    reorderOptions(slot.id, [third.id, first.id, second.id]);
    resetState();
    loadSession();

    const labels = getState()
      .slots.find((entry) => entry.id === slot.id)
      ?.options.map((option) => option.label);

    assert.deepEqual(labels, ['Alex', 'Jordan', 'Taylor']);
  });

  it('toggleOptionHighlight toggles cosmetic flag', () => {
    const slot = createSlot('Deck');
    const option = addOption(slot.id, 'Design System');

    toggleOptionHighlight(slot.id, option.id);
    assert.equal(
      getState().slots.find((entry) => entry.id === slot.id)?.options[0].highlighted,
      true,
    );

    toggleOptionHighlight(slot.id, option.id);
    assert.equal(
      getState().slots.find((entry) => entry.id === slot.id)?.options[0].highlighted,
      false,
    );
  });
});
