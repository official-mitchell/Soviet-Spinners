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
  importLinkCsvOptions,
  loadSession,
  processCsvForImport,
  processLinkCsvForImport,
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

  it('processLinkCsvForImport parses name and link columns', () => {
    const csv = 'Name,Link\nDeck A,https://example.com/a\nDeck B,www.example.com/b\n';
    const result = processLinkCsvForImport(csv, []);

    assert.equal(result.summary.added, 2);
    assert.equal(result.added[0].label, 'Deck A');
    assert.equal(result.added[0].url, 'https://example.com/a');
    assert.equal(result.added[1].url, 'https://www.example.com/b');
  });

  it('importLinkCsvOptions stores urls on imported options', () => {
    const slot = createSlot('Links');
    const summary = importLinkCsvOptions(
      slot.id,
      'title,url\nOne,https://example.com/one\nTwo,https://example.com/two\n',
    );
    const options = getState().slots.find((entry) => entry.id === slot.id)?.options ?? [];

    assert.equal(summary.added, 2);
    assert.equal(options[0].label, 'One');
    assert.equal(options[0].url, 'https://example.com/one');
    assert.equal(options[1].url, 'https://example.com/two');
  });
});
