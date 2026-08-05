// Unit tests for gated vs immediate reel display — checklist §4.3.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getReelDisplayState, reelLeaksGatedContent } from '../src/ui/reveal.js';

/** @param {Partial<import('../src/data/types.js').Slot>} overrides */
function makeSlot(overrides = {}) {
  return {
    id: 'slot-1',
    title: 'Deck',
    options: [{ id: 'opt-1', label: 'https://slides.example.com/deck', highlighted: false }],
    frozen: false,
    revealMode: 'immediate',
    order: 0,
    currentResult: null,
    ...overrides,
  };
}

describe('Reveal behavior (§4.3)', () => {
  it('gated unrevealed slot shows prompt instead of option label', () => {
    const slot = makeSlot({
      revealMode: 'gated',
      currentResult: {
        optionId: 'opt-1',
        label: 'https://slides.example.com/deck',
        forced: false,
        revealed: false,
      },
    });

    const display = getReelDisplayState(slot);

    assert.equal(display.kind, 'gated-prompt');
    assert.equal(display.text, 'Reveal & Launch');
    assert.equal(display.showsOptionLabel, false);
    assert.equal(reelLeaksGatedContent(slot), false);
  });

  it('immediate slot shows result label after draw', () => {
    const slot = makeSlot({
      currentResult: {
        optionId: 'opt-1',
        label: 'Presenter A',
        forced: false,
        revealed: true,
      },
    });

    const display = getReelDisplayState(slot);

    assert.equal(display.kind, 'result');
    assert.equal(display.text, 'Presenter A');
    assert.equal(display.showsOptionLabel, true);
  });

  it('gated slot after reveal shows label and stops leaking checks', () => {
    const slot = makeSlot({
      revealMode: 'gated',
      currentResult: {
        optionId: 'opt-1',
        label: 'https://slides.example.com/deck',
        forced: false,
        revealed: true,
      },
    });

    const display = getReelDisplayState(slot);

    assert.equal(display.kind, 'result');
    assert.equal(display.text, 'https://slides.example.com/deck');
    assert.equal(reelLeaksGatedContent(slot), false);
  });

  it('gated idle slot hides pool preview labels', () => {
    const slot = makeSlot({ revealMode: 'gated' });

    const display = getReelDisplayState(slot);

    assert.equal(display.kind, 'empty');
    assert.equal(display.text, 'No result yet');
    assert.equal(display.showsOptionLabel, false);
    assert.equal(reelLeaksGatedContent(slot), false);
  });

  it('preview mode shows first option only when no current result exists', () => {
    const slot = makeSlot();

    const display = getReelDisplayState(slot);

    assert.equal(display.kind, 'preview');
    assert.equal(display.text, 'https://slides.example.com/deck');
    assert.equal(reelLeaksGatedContent(slot), false);
  });
});
