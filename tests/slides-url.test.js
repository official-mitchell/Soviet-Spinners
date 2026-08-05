// Unit tests for Google Slides URL normalization — checklist §6.1.
// Created: 2026-08-05.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  extractPresentationId,
  isGoogleSlidesUrl,
  textLeaksUrlFragment,
  toPresentationModeUrl,
} from '../src/ui/slides-url.js';

const SAMPLE_ID = '1abcDEFghIJklmnOPQ';
const EDIT_URL = `https://docs.google.com/presentation/d/${SAMPLE_ID}/edit#slide=id.p1`;
const PRESENT_URL = `https://docs.google.com/presentation/d/${SAMPLE_ID}/present`;

describe('Slides URL helpers (§6.1)', () => {
  it('extracts presentation id from edit and present links', () => {
    assert.equal(extractPresentationId(EDIT_URL), SAMPLE_ID);
    assert.equal(extractPresentationId(PRESENT_URL), SAMPLE_ID);
  });

  it('normalizes edit links to presentation mode', () => {
    assert.equal(toPresentationModeUrl(EDIT_URL), PRESENT_URL);
    assert.equal(toPresentationModeUrl(PRESENT_URL), PRESENT_URL);
  });

  it('rejects non-Slides labels', () => {
    assert.equal(isGoogleSlidesUrl('Design System'), false);
    assert.throws(() => toPresentationModeUrl('Design System'), /Google Slides/);
  });

  it('launch.html never embeds a sample Slides URL in markup', () => {
    const html = readFileSync(new URL('../launch.html', import.meta.url), 'utf8');
    assert.ok(!html.includes('docs.google.com'));
    assert.ok(!html.includes('/presentation/d/'));
  });
});

describe('URL leak detection helpers', () => {
  it('flags obvious URL fragments in display text', () => {
    assert.equal(textLeaksUrlFragment('https://slides.example.com/deck'), true);
    assert.equal(textLeaksUrlFragment('Reveal & Launch'), false);
  });
});
