// Unit tests for round tracking — checklist §7.1–§7.2.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  addOption,
  clearSession,
  createMemoryStorage,
  createSlot,
  forceSelect,
  getActiveSlotCount,
  getCurrentRound,
  getFrozenSlotCount,
  getRoundHistory,
  getState,
  getTotalRounds,
  loadSession,
  setSlotFrozen,
  setStorageBackend,
  setTotalRounds,
  spinUnfrozen,
  unlockAll,
  updateSlotTitle,
} from '../src/data/index.js';

describe('Round tracking (§7.1)', () => {
  beforeEach(() => {
    setStorageBackend(createMemoryStorage());
    clearSession();
  });

  it('setTotalRounds persists a positive integer minimum of 1', () => {
    assert.equal(setTotalRounds(12), 12);
    assert.equal(getTotalRounds(), 12);

    loadSession();
    assert.equal(getTotalRounds(), 12);

    assert.equal(setTotalRounds(0), 1);
    assert.equal(setTotalRounds(3.9), 3);
  });

  it('active and frozen counts reflect live slot state', () => {
    const second = createSlot('Second');
    addOption(getState().slots[0].id, 'One');
    addOption(second.id, 'Two');

    assert.equal(getActiveSlotCount(), 2);
    assert.equal(getFrozenSlotCount(), 0);

    setSlotFrozen(second.id, true);
    assert.equal(getActiveSlotCount(), 1);
    assert.equal(getFrozenSlotCount(), 1);

    unlockAll();
    assert.equal(getActiveSlotCount(), 2);
    assert.equal(getFrozenSlotCount(), 0);
  });

  it('currentRound increments only when a spin round completes', () => {
    const slot = getState().slots[0];
    addOption(slot.id, 'Pick');

    assert.equal(getCurrentRound(), 1);
    spinUnfrozen();
    assert.equal(getCurrentRound(), 2);
    assert.equal(getRoundHistory().length, 1);
  });
});

describe('Round history log (§7.2)', () => {
  beforeEach(() => {
    setStorageBackend(createMemoryStorage());
    clearSession();
  });

  it('appends round records with number, results, forced flags, and timestamp', () => {
    const slotA = getState().slots[0];
    const slotB = createSlot('Deck');
    addOption(slotA.id, 'Presenter');
    addOption(slotB.id, 'Slides deck');

    spinUnfrozen();

    const round = getRoundHistory()[0];
    assert.equal(round.roundNumber, 1);
    assert.ok(round.timestamp > 0);
    assert.equal(round.results.length, 2);
    assert.ok(Array.isArray(round.forcedSlotIds));
  });

  it('history is append-only across late-add and force-select mid-session', () => {
    const slotA = getState().slots[0];
    const slotB = createSlot('Wildcard');
    addOption(slotA.id, 'Alpha');
    addOption(slotB.id, 'Beta');

    spinUnfrozen();
    const roundOne = structuredClone(getRoundHistory()[0]);

    addOption(slotA.id, 'Mid-round pick');
    const midRoundOption = getState().slots[0].options.find((option) => option.label === 'Mid-round pick');
    assert.ok(midRoundOption);
    forceSelect(slotA.id, midRoundOption.id);
    addOption(slotB.id, 'Late entry');

    assert.equal(getRoundHistory().length, 1);
    assert.deepEqual(getRoundHistory()[0], roundOne);

    addOption(slotB.id, 'Next spin');
    spinUnfrozen();
    assert.equal(getRoundHistory().length, 2);
    assert.deepEqual(getRoundHistory()[0], roundOne);
    assert.equal(getRoundHistory()[1].roundNumber, 2);
  });

  it('force-select alone does not append or overwrite history entries', () => {
    const slot = getState().slots[0];
    addOption(slot.id, 'Forced pick');
    addOption(slot.id, 'Other pick');

    const optionId = getState().slots[0].options[0].id;
    forceSelect(slot.id, optionId);

    assert.equal(getRoundHistory().length, 0);
    assert.equal(getCurrentRound(), 1);
  });

  it('carried forced frozen slots remain flagged in later round history', () => {
    const forcedSlot = getState().slots[0];
    const spinner = createSlot('Spinner');
    addOption(forcedSlot.id, 'Forced pick');
    addOption(spinner.id, 'Fresh pick');

    const forcedOptionId = getState().slots[0].options[0].id;
    forceSelect(forcedSlot.id, forcedOptionId);
    setSlotFrozen(forcedSlot.id, true);
    addOption(spinner.id, 'Next pick');
    spinUnfrozen();

    const round = getRoundHistory()[0];
    assert.ok(round.forcedSlotIds.includes(forcedSlot.id));
    assert.ok(round.results.some((result) => result.slotId === forcedSlot.id));
  });

  it('history keeps slotTitle snapshots after slot rename', () => {
    const slot = getState().slots[0];
    updateSlotTitle(slot.id, 'Presenter A');
    addOption(slot.id, 'Pick');
    spinUnfrozen();

    updateSlotTitle(slot.id, 'Renamed Presenter');
    const storedTitle = getRoundHistory()[0].results[0].slotTitle;

    assert.equal(storedTitle, 'Presenter A');
  });
});
