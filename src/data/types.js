// JSDoc type definitions for the data layer.
// Created: 2026-08-05 — Shared types for Hot Takes Night session state.

/**
 * @typedef {'immediate' | 'gated'} RevealMode
 */

/**
 * @typedef {Object} Option
 * @property {string} id
 * @property {string} label
 * @property {boolean} [highlighted]
 */

/**
 * @typedef {Object} SlotResult
 * @property {string} optionId
 * @property {string} label
 * @property {boolean} forced
 * @property {boolean} revealed
 */

/**
 * @typedef {Object} Slot
 * @property {string} id
 * @property {string} title
 * @property {Option[]} options
 * @property {Option[]} [eliminatedOptions]
 * @property {boolean} frozen
 * @property {boolean} eliminateOnSpin
 * @property {RevealMode} revealMode
 * @property {number} order
 * @property {SlotResult | null} [currentResult]
 */

/**
 * @typedef {Object} RoundResult
 * @property {string} slotId
 * @property {string} optionId
 * @property {string} [label]
 * @property {string} [slotTitle]
 */

/**
 * @typedef {Object} Round
 * @property {number} roundNumber
 * @property {RoundResult[]} results
 * @property {string[]} forcedSlotIds
 * @property {number} timestamp
 */

/**
 * @typedef {Object} CsvImportSummary
 * @property {number} added
 * @property {number} duplicatesSkipped
 * @property {number} malformedCount
 * @property {string[]} malformedRows
 */

export {};
