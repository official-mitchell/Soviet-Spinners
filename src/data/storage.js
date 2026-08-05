// localStorage adapter with injectable backend for tests.
// Created: 2026-08-05 — Persistence adapter for Hot Takes Night session state.

import { STORAGE_KEY } from './constants.js';

/** @type {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void, removeItem: (key: string) => void } | null} */
let backend = null;

/**
 * @param {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void, removeItem: (key: string) => void }} adapter
 */
export function setStorageBackend(adapter) {
  backend = adapter;
}

function getBackend() {
  if (backend) {
    return backend;
  }

  if (typeof globalThis.localStorage !== 'undefined') {
    return globalThis.localStorage;
  }

  throw new Error('No storage backend available');
}

/** @returns {string | null} */
export function readRaw() {
  return getBackend().getItem(STORAGE_KEY);
}

/** @param {string} value */
export function writeRaw(value) {
  getBackend().setItem(STORAGE_KEY, value);
}

export function clearRaw() {
  getBackend().removeItem(STORAGE_KEY);
}

/** @returns {{ store: Record<string, string>, getItem: (key: string) => string | null, setItem: (key: string, value: string) => void, removeItem: (key: string) => void }} */
export function createMemoryStorage() {
  return {
    /** @type {Record<string, string>} */
    store: {},
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(this.store, key)
        ? this.store[key]
        : null;
    },
    setItem(key, value) {
      this.store[key] = String(value);
    },
    removeItem(key) {
      delete this.store[key];
    },
  };
}
