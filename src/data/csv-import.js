// Single-column CSV parsing and import processing — checklist §3.
// Created: 2026-08-05.

/** @typedef {Object} CsvImportSummary
 * @property {number} added
 * @property {number} duplicatesSkipped
 * @property {number} malformedCount
 * @property {string[]} malformedRows
 */

const HEADER_TOKENS = new Set([
  'name',
  'option',
  'options',
  'label',
  'labels',
  'value',
  'values',
  'title',
  'item',
  'items',
  'presenter',
  'deck',
  'wildcard',
  'entry',
  'entries',
]);

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isPlainLabel(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (!/[\p{L}\p{N}]/u.test(trimmed)) {
    return false;
  }

  if (HEADER_TOKENS.has(trimmed.toLowerCase())) {
    return false;
  }

  return true;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isMalformedRow(value) {
  return !isPlainLabel(value);
}

/**
 * @param {string} line
 * @returns {string}
 */
export function extractFirstCsvField(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('"')) {
    let value = '';
    for (let index = 1; index < trimmed.length; index += 1) {
      const char = trimmed[index];
      if (char === '"') {
        if (trimmed[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          break;
        }
      } else {
        value += char;
      }
    }
    return value;
  }

  const commaIndex = trimmed.indexOf(',');
  if (commaIndex === -1) {
    return trimmed;
  }

  return trimmed.slice(0, commaIndex).trim();
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function parseSingleColumnCsv(text) {
  if (!text) {
    return [];
  }

  const rows = text.split(/\r?\n/).map((line) => extractFirstCsvField(line));

  while (rows.length > 0 && !rows[rows.length - 1].trim()) {
    rows.pop();
  }

  return rows;
}

/**
 * @param {string[]} rows
 * @returns {string[]}
 */
export function skipDetectedHeaderRow(rows) {
  if (rows.length === 0) {
    return rows;
  }

  const firstRow = rows[0];
  if (firstRow.trim() && !isPlainLabel(firstRow)) {
    return rows.slice(1);
  }

  return rows;
}

/**
 * @param {string} csvText
 * @param {string[]} existingLabels
 * @returns {{ added: string[], summary: CsvImportSummary }}
 */
export function processCsvForImport(csvText, existingLabels) {
  const parsedRows = skipDetectedHeaderRow(parseSingleColumnCsv(csvText));
  const existingLower = new Set(existingLabels.map((label) => label.trim().toLowerCase()));
  const batchLower = new Set();

  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const malformedRows = [];
  let duplicatesSkipped = 0;

  for (const row of parsedRows) {
    if (isMalformedRow(row)) {
      malformedRows.push(formatMalformedRow(row));
      continue;
    }

    const label = row.trim();
    const lower = label.toLowerCase();

    if (existingLower.has(lower) || batchLower.has(lower)) {
      duplicatesSkipped += 1;
      continue;
    }

    added.push(label);
    batchLower.add(lower);
  }

  return {
    added,
    summary: {
      added: added.length,
      duplicatesSkipped,
      malformedCount: malformedRows.length,
      malformedRows,
    },
  };
}

/**
 * @param {import('./types.js').CsvImportSummary} summary
 * @returns {string}
 */
export function formatImportSummaryMessage(summary) {
  const parts = [
    `${summary.added} added`,
    `${summary.duplicatesSkipped} duplicates skipped`,
    `${summary.malformedCount} malformed rows`,
  ];
  return parts.join(', ');
}

/**
 * @param {string} row
 * @returns {string}
 */
function formatMalformedRow(row) {
  if (!row.trim()) {
    return '(empty row)';
  }
  return row.trim();
}
