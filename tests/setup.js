import { vi } from 'vitest';

// Mock Chrome Extension APIs
global.chrome = {
  storage: {
    sync: {
      get: vi.fn((_keys, callback) => {
        callback({ defaultRegex: false, defaultCaseSensitive: false, defaultElementSearch: false });
      }),
      set: vi.fn((_items, callback) => {
        if (callback) callback();
      }),
    },
  },
  tabs: {
    query: vi.fn((_queryInfo, callback) => {
      callback([{ id: 1, url: 'https://example.com' }]);
    }),
    sendMessage: vi.fn((_tabId, _message, callback) => {
      if (callback) callback({ success: true, count: 0 });
    }),
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    lastError: null,
  },
  scripting: {
    executeScript: vi.fn(() => Promise.resolve()),
  },
};
