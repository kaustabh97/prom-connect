/**
 * Polyfill for localStorage in Node.js (required by ampx sandbox)
 */
const store = {};
const storage = {
  getItem(key) {
    return store[key] ?? null;
  },
  setItem(key, value) {
    store[key] = String(value);
  },
  removeItem(key) {
    delete store[key];
  },
  clear() {
    Object.keys(store).forEach((k) => delete store[k]);
  },
  get length() {
    return Object.keys(store).length;
  },
  key(i) {
    return Object.keys(store)[i] ?? null;
  },
};

globalThis.localStorage = storage;
if (typeof global !== "undefined") global.localStorage = storage;
if (typeof window !== "undefined") window.localStorage = storage;
