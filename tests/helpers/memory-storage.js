// In-memory Storage stub for unit tests.
// Created: 2026-08-05.

/** @implements {Storage} */
export class MemoryStorage {
  constructor() {
    /** @type {Map<string, string>} */
    this.map = new Map();
  }

  get length() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }

  getItem(key) {
    return this.map.get(key) ?? null;
  }

  key(index) {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key) {
    this.map.delete(key);
  }

  setItem(key, value) {
    this.map.set(key, value);
  }
}
