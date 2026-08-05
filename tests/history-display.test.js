// Unit tests for history display helpers — checklist §7.2 review fixes.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getForcedSlotTitles,
  resolveHistorySlotTitle,
} from '../src/ui/history-display.js';

describe('History display helpers (§7.2)', () => {
  it('resolveHistorySlotTitle prefers slotTitle snapshots over live slot titles', () => {
    const slotById = new Map([
      ['slot-1', { id: 'slot-1', title: 'Renamed Presenter' }],
    ]);

    assert.equal(
      resolveHistorySlotTitle({ slotId: 'slot-1', slotTitle: 'Presenter A' }, slotById),
      'Presenter A',
    );
  });

  it('getForcedSlotTitles uses result snapshots for forced slot badges', () => {
    const slotById = new Map([
      ['slot-1', { id: 'slot-1', title: 'Renamed Deck' }],
    ]);

    const round = {
      roundNumber: 2,
      forcedSlotIds: ['slot-1'],
      results: [{ slotId: 'slot-1', optionId: 'opt-1', label: 'Deck A', slotTitle: 'Deck A' }],
      timestamp: Date.now(),
    };

    assert.deepEqual(getForcedSlotTitles(round, slotById), ['Deck A']);
  });
});
