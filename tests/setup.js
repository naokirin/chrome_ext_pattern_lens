import { vi } from 'vitest';

// Mock Chrome Extension APIs
global.chrome = {
  storage: {
    sync: {
      get: vi.fn((keys, callback) => {
        callback({ defaultRegex: false, defaultCaseSensitive: false, defaultElementSearch: false });
      }),
      set: vi.fn((items, callback) => {
        if (callback) callback();
      }),
    },
  },
  tabs: {
    query: vi.fn((queryInfo, callback) => {
      callback([{ id: 1, url: 'https://example.com' }]);
    }),
    sendMessage: vi.fn((tabId, message, callback) => {
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
