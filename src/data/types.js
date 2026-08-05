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
 * @typedef {Object} Slot
 * @property {string} id
 * @property {string} title
 * @property {Option[]} options
 * @property {boolean} frozen
 * @property {RevealMode} revealMode
 * @property {number} order
 */

/**
 * @typedef {Object} RoundResult
 * @property {string} slotId
 * @property {string} optionId
 */

/**
 * @typedef {Object} Round
 * @property {number} roundNumber
 * @property {RoundResult[]} results
 * @property {string[]} forcedSlotIds
 * @property {number} timestamp
 */

/**
 * @typedef {Object} SessionState
 * @property {Slot[]} slots
 * @property {number} totalRounds
 * @property {number} currentRound
 * @property {Round[]} roundHistory
 */

/**
 * @typedef {Object} CsvImportSummary
 * @property {number} added
 * @property {number} duplicatesSkipped
 * @property {number} malformedCount
 * @property {string[]} malformedRows
 */

export {};
