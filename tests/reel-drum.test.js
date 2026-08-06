// Unit tests for reel drum display helpers — checklist §5.2.
// Updated: 2026-08-06 — previewOffset neighbor rotation coverage.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildSpinStripLabels, getReelDrumCells } from '../src/ui/reel-drum.js';
import { getReelDisplayState } from '../src/ui/reveal.js';

/** @param {Partial<import('../src/data/types.js').Slot>} overrides */
function makeSlot(overrides = {}) {
  return {
    id: 'slot-1',
    title: 'Presenter',
    options: [
      { id: 'a', label: 'Alpha', highlighted: false },
      { id: 'b', label: 'Beta', highlighted: false },
      { id: 'c', label: 'Gamma', highlighted: false },
    ],
    frozen: false,
    revealMode: 'immediate',
    order: 0,
    currentResult: null,
    ...overrides,
  };
}

describe('Reel drum (§5.2)', () => {
  it('idle drum centers current result with preview neighbors', () => {
    const slot = makeSlot({
      currentResult: {
        optionId: 'b',
        label: 'Beta',
        forced: false,
        revealed: true,
      },
    });
    const display = getReelDisplayState(slot);
    const cells = getReelDrumCells(slot, display);

    assert.equal(cells.center, 'Beta');
    assert.notEqual(cells.prev, cells.center);
    assert.notEqual(cells.next, cells.center);
  });

  it('previewOffset rotates neighbor labels while keeping the center fixed', () => {
    const slot = makeSlot({
      previewOffset: 0,
      currentResult: {
        optionId: 'b',
        label: 'Beta',
        forced: false,
        revealed: true,
      },
    });
    const display = getReelDisplayState(slot);
    const initial = getReelDrumCells(slot, display);
    const rotated = getReelDrumCells({ ...slot, previewOffset: 1 }, display);

    assert.equal(initial.center, 'Beta');
    assert.equal(rotated.center, 'Beta');
    assert.notEqual(initial.prev, rotated.prev);
    assert.notEqual(initial.next, rotated.next);
  });

  it('gated prompt drum hides option labels in center copy', () => {
    const slot = makeSlot({
      revealMode: 'gated',
      currentResult: {
        optionId: 'a',
        label: 'Secret URL',
        forced: false,
        revealed: false,
      },
    });
    const display = getReelDisplayState(slot);
    const cells = getReelDrumCells(slot, display);

    assert.equal(cells.center, 'Reveal & Launch');
    assert.equal(cells.prev, '—');
  });

  it('gated spin strip masks every cell including the draw target', () => {
    const slot = makeSlot({ revealMode: 'gated' });
    const strip = buildSpinStripLabels(slot, 'Secret URL');

    assert.equal(strip.length, 11);
    assert.ok(strip.every((label) => label === '••••••'));
    assert.ok(!strip.includes('Secret URL'));
  });
});
