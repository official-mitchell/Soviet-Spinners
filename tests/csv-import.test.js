// Unit tests for CSV import — checklist §3.1.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  addOption,
  clearSession,
  createMemoryStorage,
  createSlot,
  getState,
  importCsvOptions,
  loadSession,
  processCsvForImport,
  setStorageBackend,
} from '../src/data/index.js';

describe('CSV import (§3.1)', () => {
  beforeEach(() => {
    setStorageBackend(createMemoryStorage());
    clearSession();
    loadSession();
  });

  it('skips a detected header row', () => {
    const csv = 'Name\nJordan\nTaylor\n';
    const result = processCsvForImport(csv, []);

    assert.deepEqual(result.added, ['Jordan', 'Taylor']);
    assert.equal(result.summary.added, 2);
  });

  it('keeps the first row when it matches a plain label pattern', () => {
    const csv = 'Jordan\nTaylor\n';
    const result = processCsvForImport(csv, []);

    assert.deepEqual(result.added, ['Jordan', 'Taylor']);
  });

  it('skips duplicates case-insensitively and reports counts', () => {
    const csv = 'Jordan\nJORDAN\nTaylor\n';
    const result = processCsvForImport(csv, ['jordan']);

    assert.deepEqual(result.added, ['Taylor']);
    assert.equal(result.summary.added, 1);
    assert.equal(result.summary.duplicatesSkipped, 2);
  });

  it('surfaces empty and malformed rows in the summary', () => {
    const csv = 'Jordan\n   \n!!!\nTaylor\n';
    const result = processCsvForImport(csv, []);

    assert.deepEqual(result.added, ['Jordan', 'Taylor']);
    assert.equal(result.summary.malformedCount, 2);
    assert.deepEqual(result.summary.malformedRows, ['(empty row)', '!!!']);
  });

  it('importCsvOptions merges into one slot without affecting others', () => {
    const slotA = createSlot('Presenter');
    const slotB = createSlot('Deck');
    addOption(slotB.id, 'Design System');

    const summary = importCsvOptions(slotA.id, 'Name\nJordan\nTaylor\n');
    const state = getState();

    assert.equal(summary.added, 2);
    assert.deepEqual(
      state.slots.find((slot) => slot.id === slotA.id)?.options.map((option) => option.label),
      ['Jordan', 'Taylor'],
    );
    assert.deepEqual(
      state.slots.find((slot) => slot.id === slotB.id)?.options.map((option) => option.label),
      ['Design System'],
    );
  });
});
