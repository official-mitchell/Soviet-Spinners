// Unit tests for mechanical handle geometry helpers.
// Created: 2026-08-05.
// Updated: 2026-08-05 — mock document/getComputedStyle for computeSpinMotion in Node.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HANDLE_MAX_ANGLE,
  HANDLE_REST_ANGLE,
  applyHandleDragResistance,
  clampHandleAngle,
  isHandlePastThreshold,
  pointerToHandleAngle,
} from '../src/ui/machine-handle.js';
import { computeSpinMotion } from '../src/ui/reel-drum.js';
import { SPIN_SEQUENCE_MS } from '../src/ui/sound.js';

describe('Machine handle geometry', () => {
  it('pointerToHandleAngle returns 0 when pointer is directly above pivot', () => {
    const angle = pointerToHandleAngle({ x: 100, y: 200 }, { x: 100, y: 100 });
    assert.ok(Math.abs(angle) < 0.01);
  });

  it('clampHandleAngle keeps angle within resting and maximum pull', () => {
    assert.equal(clampHandleAngle(-40), HANDLE_REST_ANGLE);
    assert.equal(clampHandleAngle(80), HANDLE_MAX_ANGLE);
    assert.equal(clampHandleAngle(10), 10);
  });

  it('isHandlePastThreshold is false at rest and true near max pull', () => {
    assert.equal(isHandlePastThreshold(HANDLE_REST_ANGLE), false);
    assert.equal(isHandlePastThreshold(HANDLE_MAX_ANGLE), true);
  });

  it('applyHandleDragResistance eases the final 20% of travel', () => {
    const rawNearMax = HANDLE_MAX_ANGLE;
    const resisted = applyHandleDragResistance(rawNearMax);
    assert.ok(resisted < rawNearMax);
    assert.ok(resisted > HANDLE_REST_ANGLE + (HANDLE_MAX_ANGLE - HANDLE_REST_ANGLE) * 0.8);
  });
});

describe('Spin motion timing', () => {
  it('computeSpinMotion finishes the last reel at the 2.6s sequence length', () => {
    const hadDocument = Object.hasOwn(globalThis, 'document');
    const hadGetComputedStyle = Object.hasOwn(globalThis, 'getComputedStyle');
    const previousDocument = globalThis.document;
    const previousGetComputedStyle = globalThis.getComputedStyle;

    globalThis.document = { documentElement: {} };
    globalThis.getComputedStyle = () => ({
      getPropertyValue: () => '',
    });

    try {
      const drawCount = 3;
      const motion = computeSpinMotion(drawCount);
      const total =
        (drawCount - 1) * motion.staggerMs + motion.travelMs + 40;

      assert.equal(total, SPIN_SEQUENCE_MS);
    } finally {
      if (hadDocument) {
        globalThis.document = previousDocument;
      } else {
        delete globalThis.document;
      }
      if (hadGetComputedStyle) {
        globalThis.getComputedStyle = previousGetComputedStyle;
      } else {
        delete globalThis.getComputedStyle;
      }
    }
  });
});
