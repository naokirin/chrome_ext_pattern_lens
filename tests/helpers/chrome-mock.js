import { vi } from 'vitest';

/**
 * デフォルトの Chrome API モック設定
 */
const defaultSettings = {
  defaultRegex: false,
  defaultCaseSensitive: false,
  defaultElementSearch: false,
};

/**
 * デフォルトのタブ情報
 */
const defaultTab = { id: 1, url: 'https://example.com' };

/**
 * Chrome API モックを作成
 * @param {Object} options - カスタマイズオプション
 * @param {Object} options.settings - storage.sync.get で返す設定
 * @param {Object} options.tab - tabs.query で返すタブ情報
 * @param {Function} options.onSendMessage - tabs.sendMessage のカスタムハンドラ
 * @param {Function} options.onMessageHandler - runtime.onMessage.addListener に渡されるハンドラを受け取るコールバック
 * @returns {Object} Chrome API モックオブジェクト
 */
export function createChromeMock(options = {}) {
  const settings = { ...defaultSettings, ...options.settings };
  const tab = { ...defaultTab, ...options.tab };
  let messageHandler = null;

  const mock = {
    storage: {
      sync: {
        get: vi.fn((_keys, callback) => {
          callback(settings);
        }),
        set: vi.fn((_items, callback) => {
          if (callback) callback();
        }),
      },
      onChanged: {
        addListener: vi.fn(),
      },
    },
    tabs: {
      query: vi.fn((_queryInfo, callback) => {
        callback([tab]);
      }),
      sendMessage: vi.fn((_tabId, message, callback) => {
        if (options.onSendMessage) {
          const response = options.onSendMessage(_tabId, message);
          if (callback) callback(response);
        } else if (messageHandler) {
          const response = messageHandler(message);
          if (callback) callback(response);
        } else if (callback) {
          callback({ success: true, count: 0 });
        }
      }),
    },
    runtime: {
      onMessage: {
        addListener: vi.fn((handler) => {
          messageHandler = handler;
          if (options.onMessageHandler) {
            options.onMessageHandler(handler);
          }
        }),
      },
      sendMessage: vi.fn(),
      lastError: null,
    },
    scripting: {
      executeScript: vi.fn(() => Promise.resolve()),
    },
  };

  return mock;
}

/**
 * グローバルに Chrome モックを設定
 * @param {Object} options - createChromeMock に渡すオプション
 * @returns {Object} 作成されたモック
 */
export function setupChromeMock(options = {}) {
  const mock = createChromeMock(options);
  global.chrome = mock;
  return mock;
}

/**
 * Chrome モックをリセット
 */
export function resetChromeMock() {
  if (global.chrome) {
    vi.clearAllMocks();
  }
}
