// Mock global state for testing
globalThis.state = {
  currency: "PYG",
  exchangeRate: 7500,
};

// Mock localStorage
var store = {};
globalThis.localStorage = {
  getItem: function (key) { return store[key] || null; },
  setItem: function (key, value) { store[key] = String(value); },
  removeItem: function (key) { delete store[key]; },
  clear: function () { store = {}; },
};
