// Unit tests for spin mechanics — checklist §4.1–§4.2.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  addOption,
  buildSpinPlan,
  clearSession,
  commitSpinDraws,
  createMemoryStorage,
  createSlot,
  deleteOption,
  forceSelect,
  getCurrentRound,
  getRoundHistory,
  getState,
  loadSession,
  planSpin,
  setSlotFrozen,
  setSlotRevealMode,
  setStorageBackend,
  shuffleAll,
  spinUnfrozen,
  surpriseMe,
  updateSlotTitle,
} from '../src/data/index.js';

describe('Spin mechanics (§4.1–§4.2)', () => {
  beforeEach(() => {
    setStorageBackend(createMemoryStorage());
    clearSession();
    loadSession();
  });

  it('spinUnfrozen skips frozen slots and removes drawn options from pool', () => {
    const active = createSlot('Active');
    const frozen = createSlot('Frozen');
    addOption(active.id, 'Active pick');
    addOption(frozen.id, 'Frozen pick');
    setSlotFrozen(frozen.id, true);

    spinUnfrozen();

    const state = getState();
    const activeSlot = state.slots.find((slot) => slot.id === active.id);
    const frozenSlot = state.slots.find((slot) => slot.id === frozen.id);

    assert.equal(activeSlot?.options.length, 0);
    assert.ok(activeSlot?.currentResult);
    assert.equal(frozenSlot?.options.length, 1);
    assert.equal(frozenSlot?.currentResult, undefined);
    assert.equal(getRoundHistory().length, 1);
  });

  it('surpriseMe spins frozen slots without changing frozen flags', () => {
    const slot = getState().slots[0];
    addOption(slot.id, 'Only option');
    setSlotFrozen(slot.id, true);

    surpriseMe();

    const updated = getState().slots.find((entry) => entry.id === slot.id);
    assert.equal(updated?.frozen, true);
    assert.equal(updated?.options.length, 0);
    assert.ok(updated?.currentResult);
  });

  it('shuffleAll reorders options without selecting or removing them', () => {
    const slot = getState().slots[0];
    addOption(slot.id, 'Alpha');
    addOption(slot.id, 'Beta');
    addOption(slot.id, 'Gamma');

    const labelsBefore = getState().slots[0].options.map((option) => option.label).sort();
    shuffleAll();

    const updated = getState().slots[0];
    const labelsAfter = updated.options.map((option) => option.label).sort();
    assert.deepEqual(labelsAfter, labelsBefore);
    assert.equal(updated.currentResult, undefined);
  });

  it('forceSelect sets result, keeps pool intact, and logs forced slot id', () => {
    const slot = getState().slots[0];
    addOption(slot.id, 'One');
    addOption(slot.id, 'Two');
    const optionId = getState().slots[0].options[0].id;

    const result = forceSelect(slot.id, optionId);
    const state = getState();

    assert.equal(result.forced, true);
    assert.equal(state.slots[0].currentResult?.optionId, optionId);
    assert.equal(state.slots[0].options.length, 2);
    assert.ok(state.currentRoundForcedSlotIds.includes(slot.id));
  });

  it('add-option mid-round does not alter an existing drawn result', () => {
    const slot = getState().slots[0];
    addOption(slot.id, 'Drawn');
    spinUnfrozen();

    const before = getState().slots[0].currentResult;
    addOption(slot.id, 'Late entry');
    const after = getState().slots[0];

    assert.deepEqual(after.currentResult, before);
    assert.equal(after.options.length, 1);
    assert.equal(after.options[0].label, 'Late entry');
  });

  it('commitSpinDraws records forced slots in round history', () => {
    const slotA = getState().slots[0];
    const slotB = createSlot('Second');
    addOption(slotA.id, 'Forced');
    addOption(slotB.id, 'Spun');
    const forcedOptionId = getState().slots[0].options[0].id;

    forceSelect(slotA.id, forcedOptionId);
    setSlotFrozen(slotA.id, true);
    const plan = planSpin(false);
    commitSpinDraws(plan.draws);

    const round = getRoundHistory()[0];
    assert.ok(round.forcedSlotIds.includes(slotA.id));
    assert.ok(round.results.some((result) => result.slotId === slotA.id));
    assert.ok(round.results.some((result) => result.slotId === slotB.id));
  });

  it('gated spin sets revealed=false until revealSlot is called', () => {
    const slot = getState().slots[0];
    addOption(slot.id, 'Secret deck');
    setSlotRevealMode(slot.id, 'gated');

    spinUnfrozen();

    const updated = getState().slots[0];
    assert.equal(updated.currentResult?.revealed, false);
    assert.equal(updated.currentResult?.label, 'Secret deck');
  });

  it('buildSpinPlan lists skipped frozen and empty slots', () => {
    const active = createSlot('Active');
    const frozen = createSlot('Frozen');
    const empty = createSlot('Empty');
    addOption(active.id, 'Go');
    setSlotFrozen(frozen.id, true);
    addOption(frozen.id, 'Skip');

    const plan = buildSpinPlan(getState().slots, { includeFrozen: false });

    assert.equal(plan.draws.length, 1);
    assert.ok(plan.skippedFrozenSlotIds.includes(frozen.id));
    assert.ok(plan.skippedEmptySlotIds.includes(empty.id));
    assert.ok(plan.skippedEmptySlotIds.includes(getState().slots[0].id));
  });

  it('commitSpinDraws rolls back when a planned option was removed', () => {
    const slot = getState().slots[0];
    addOption(slot.id, 'Alpha');
    addOption(slot.id, 'Beta');
    const plan = planSpin(false);
    const draw = plan.draws[0];
    const roundBefore = getCurrentRound();

    deleteOption(slot.id, draw.optionId);

    assert.throws(() => commitSpinDraws(plan.draws), /Draw option not found/);
    assert.equal(getCurrentRound(), roundBefore);
    assert.equal(getState().slots[0].options.length, 1);
    assert.equal(getState().slots[0].currentResult, undefined);
    assert.equal(getRoundHistory().length, 0);
  });

  it('commitSpinDraws records carried frozen results in round history', () => {
    const carried = getState().slots[0];
    const spinner = createSlot('Spinner');
    addOption(carried.id, 'Carried pick');
    addOption(spinner.id, 'Fresh pick');

    spinUnfrozen();
    setSlotFrozen(carried.id, true);
    addOption(spinner.id, 'Next pick');
    spinUnfrozen();

    const round = getRoundHistory()[1];
    assert.ok(round.results.some((result) => result.slotId === carried.id));
    assert.ok(round.results.some((result) => result.slotId === spinner.id));
  });

  it('commitSpinDraws snapshots slot titles in round history', () => {
    const slot = getState().slots[0];
    updateSlotTitle(slot.id, 'Presenter A');
    addOption(slot.id, 'Pick one');
    spinUnfrozen();

    const result = getRoundHistory()[0].results[0];
    assert.equal(result.slotTitle, 'Presenter A');
  });
});
