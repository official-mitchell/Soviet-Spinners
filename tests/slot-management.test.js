// Unit tests for slot management helpers — checklist §2.1–§2.2.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  addOption,
  clearSession,
  createMemoryStorage,
  createSlot,
  getState,
  loadSession,
  setStorageBackend,
} from '../src/data/index.js';
import {
  getDeleteSlotMessage,
  shouldConfirmSlotDelete,
} from '../src/ui/slot-actions.js';

describe('Slot management UI logic (§2.1–§2.2)', () => {
  beforeEach(() => {
    setStorageBackend(createMemoryStorage());
    clearSession();
    loadSession();
  });

  it('add slot increments count and assigns sequential order', () => {
    const initialCount = getState().slots.length;
    const created = createSlot('Presenter');
    const second = createSlot('Deck');

    const slots = [...getState().slots].sort((a, b) => a.order - b.order);
    assert.equal(slots.length, initialCount + 2);
    assert.equal(slots.at(-2)?.id, created.id);
    assert.equal(slots.at(-1)?.id, second.id);
    assert.deepEqual(
      slots.map((slot) => slot.order),
      slots.map((_, index) => index),
    );
  });

  it('shouldConfirmSlotDelete is false when slot has zero options', () => {
    const slot = createSlot('Empty');
    assert.equal(shouldConfirmSlotDelete(slot), false);
  });

  it('shouldConfirmSlotDelete is true when slot has options', () => {
    const slot = createSlot('Filled');
    addOption(slot.id, 'Jordan');
    const refreshed = getState().slots.find((entry) => entry.id === slot.id);
    assert.ok(refreshed);
    assert.equal(shouldConfirmSlotDelete(refreshed), true);
    assert.match(getDeleteSlotMessage(refreshed), /Slot 'Filled' has 1 option/);
  });
});
