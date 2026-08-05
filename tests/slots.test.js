// Unit tests for Slot entity CRUD — checklist §1.1.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  clearSession,
  createMemoryStorage,
  createSlot,
  deleteSlot,
  getSlots,
  loadSession,
  reorderSlots,
  setStorageBackend,
  updateSlotTitle,
} from '../src/data/index.js';

describe('Slot entity (§1.1)', () => {
  beforeEach(() => {
    setStorageBackend(createMemoryStorage());
    clearSession();
    loadSession();
  });

  it('createSlot returns defaults: title, frozen false, revealMode immediate', () => {
    const slot = createSlot();

    assert.equal(slot.title, 'New Slot');
    assert.equal(slot.frozen, false);
    assert.equal(slot.eliminateOnSpin, false);
    assert.equal(slot.linksMode, false);
    assert.equal(slot.revealMode, 'immediate');
    assert.deepEqual(slot.options, []);
    assert.equal(typeof slot.id, 'string');
    assert.ok(slot.id.length > 0);
  });

  it('createSlot accepts a custom title', () => {
    const slot = createSlot('Presenter');
    assert.equal(slot.title, 'Presenter');
  });

  it('deleteSlot removes a slot when more than one exists', () => {
    const first = createSlot('One');
    const second = createSlot('Two');

    deleteSlot(first.id);

    const slots = getSlots();
    assert.equal(slots.length, 2);
    assert.ok(slots.some((slot) => slot.id === second.id));
    assert.ok(!slots.some((slot) => slot.id === first.id));
  });

  it('deleteSlot throws when attempting to delete the last slot', () => {
    const onlySlot = getSlots()[0];

    assert.throws(
      () => deleteSlot(onlySlot.id),
      /Cannot delete the last remaining slot/,
    );
    assert.equal(getSlots().length, 1);
  });

  it('updateSlotTitle updates the slot title', () => {
    const slot = createSlot('Deck');
    const updated = updateSlotTitle(slot.id, 'Wildcard');

    assert.equal(updated.title, 'Wildcard');
    assert.equal(getSlots()[1].title, 'Wildcard');
  });

  it('reorderSlots reassigns order values', () => {
    const initial = getSlots()[0];
    const a = createSlot('A');
    const b = createSlot('B');

    reorderSlots([b.id, initial.id, a.id]);

    const slots = getSlots();
    assert.deepEqual(slots.map((slot) => slot.title), ['B', initial.title, 'A']);
    assert.deepEqual(slots.map((slot) => slot.order), [0, 1, 2]);
  });

  it('reorderSlots rejects unknown ids', () => {
    createSlot('Extra');
    assert.throws(
      () => reorderSlots(['missing-id']),
      /Reorder ids must include every slot exactly once/,
    );
  });
});
