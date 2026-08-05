// Single-column and link-pair CSV parsing and import processing — checklist §3.
// Updated: 2026-08-05 — two-column name/link CSV import helpers.

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

const LINK_HEADER_TOKENS = new Set([
  'link',
  'links',
  'url',
  'urls',
  'href',
  'address',
  'website',
]);

/**
 * @param {string | undefined} raw
 * @returns {string | undefined}
 */
export function normalizeOptionUrl(raw) {
  if (!raw || typeof raw !== 'string') {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^www\./i.test(trimmed) || /^[^\s]+\.[^\s]+/.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return undefined;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isValidLinkUrl(value) {
  return Boolean(normalizeOptionUrl(value));
}

/**
 * @param {string} line
 * @returns {string[]}
 */
export function parseCsvRow(line) {
  /** @type {string[]} */
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields.map((field) => field.trim());
}

/**
 * @param {string} line
 * @returns {string}
 */
export function extractFirstCsvField(line) {
  return parseCsvRow(line)[0] ?? '';
}

/**
 * @typedef {{ name: string, url: string }} LinkCsvRow
 */

/**
 * @param {string} text
 * @returns {LinkCsvRow[]}
 */
export function parseTwoColumnCsv(text) {
  if (!text) {
    return [];
  }

  const rows = text
    .split(/\r?\n/)
    .map((line) => {
      const fields = parseCsvRow(line);
      return {
        name: fields[0] ?? '',
        url: fields[1] ?? '',
      };
    })
    .filter((row) => row.name.trim() || row.url.trim());

  while (rows.length > 0 && !rows[rows.length - 1].name.trim() && !rows[rows.length - 1].url.trim()) {
    rows.pop();
  }

  return rows;
}

/**
 * @param {LinkCsvRow[]} rows
 * @returns {LinkCsvRow[]}
 */
export function skipDetectedLinkHeaderRow(rows) {
  if (rows.length === 0) {
    return rows;
  }

  const first = rows[0];
  const nameHeader = first.name.trim().toLowerCase();
  const urlHeader = first.url.trim().toLowerCase();

  if (
    (HEADER_TOKENS.has(nameHeader) || nameHeader === 'name') &&
    LINK_HEADER_TOKENS.has(urlHeader)
  ) {
    return rows.slice(1);
  }

  if (!isPlainLabel(first.name) && LINK_HEADER_TOKENS.has(urlHeader)) {
    return rows.slice(1);
  }

  return rows;
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
 * @param {string} csvText
 * @param {string[]} existingLabels
 * @returns {{ added: Array<{ label: string, url: string }>, summary: CsvImportSummary }}
 */
export function processLinkCsvForImport(csvText, existingLabels) {
  const parsedRows = skipDetectedLinkHeaderRow(parseTwoColumnCsv(csvText));
  const existingLower = new Set(existingLabels.map((label) => label.trim().toLowerCase()));
  const batchLower = new Set();

  /** @type {Array<{ label: string, url: string }>} */
  const added = [];
  /** @type {string[]} */
  const malformedRows = [];
  let duplicatesSkipped = 0;

  for (const row of parsedRows) {
    const label = row.name.trim();
    const url = normalizeOptionUrl(row.url);

    if (isMalformedRow(label) || !url) {
      malformedRows.push(formatLinkMalformedRow(row));
      continue;
    }

    const lower = label.toLowerCase();
    if (existingLower.has(lower) || batchLower.has(lower)) {
      duplicatesSkipped += 1;
      continue;
    }

    added.push({ label, url });
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

/**
 * @param {{ name: string, url: string }} row
 * @returns {string}
 */
function formatLinkMalformedRow(row) {
  const name = row.name.trim() || '(empty name)';
  const url = row.url.trim() || '(empty link)';
  return `${name} | ${url}`;
}
