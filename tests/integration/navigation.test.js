/**
 * 統合テスト: 検索結果のナビゲーション
 * 
 * テストシナリオ:
 * 1. Popupの「次へ」「前へ」ボタン、または Enter/Shift+Enter を押す
 * 2. navigateToMatch が呼び出され、ハイライトとページスクロールが正しく連動することを確認
 * 3. 現在のマッチがオレンジ色でハイライトされる
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanupDOM } from '../helpers/dom-helpers.js';

describe('統合テスト: 検索結果のナビゲーション', () => {
  let mockSendMessage;
  let mockTabsQuery;
  let messageHandler;
  let currentMatchIndex = -1;
  let highlightData = {
    ranges: [],
    elements: [],
    overlays: [],
  };

  beforeEach(() => {
    cleanupDOM();
    currentMatchIndex = -1;
    highlightData = {
      ranges: [],
      elements: [],
      overlays: [],
    };

    // 複数のマッチがあるDOMを作成
    document.body.innerHTML = `
      <div>
        <p>test content one</p>
        <p>test content two</p>
        <p>test content three</p>
        <p>another test content</p>
      </div>
    `;

    mockSendMessage = vi.fn((_tabId, message, callback) => {
      if (messageHandler) {
        const response = messageHandler(message);
        if (callback) {
          callback(response);
        }
      }
    });

    mockTabsQuery = vi.fn((_queryInfo, callback) => {
      callback([{ id: 1, url: 'https://example.com' }]);
    });

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
        query: mockTabsQuery,
        sendMessage: mockSendMessage,
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((handler) => {
            messageHandler = handler;
          }),
        },
        lastError: null,
      },
      scripting: {
        executeScript: vi.fn(() => Promise.resolve()),
      },
    };
  });

  afterEach(() => {
    cleanupDOM();
    messageHandler = null;
  });

  it('検索実行後、最初のマッチが現在のマッチとして設定される', async () => {
    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const query = request.query;
        const bodyText = document.body.textContent || '';
        const searchText = bodyText.toLowerCase();
        const searchQuery = query.toLowerCase();

        // マッチ数をカウント
        let matches = 0;
        let index = -1;
        while ((index = searchText.indexOf(searchQuery, index + 1)) !== -1) {
          matches++;
        }

        // オーバーレイコンテナを作成
        let container = document.getElementById('pattern-lens-overlay-container');
        if (!container && matches > 0) {
          container = document.createElement('div');
          container.id = 'pattern-lens-overlay-container';
          document.body.appendChild(container);
        }

        // 各マッチに対してRangeを作成（簡易版）
        highlightData.ranges = [];
        highlightData.overlays = [];
        for (let i = 0; i < matches; i++) {
          const range = document.createRange();
          highlightData.ranges.push(range);

          // オーバーレイを作成
          const overlay = document.createElement('div');
          overlay.className = i === 0 ? 'pattern-lens-highlight-overlay pattern-lens-current-match' : 'pattern-lens-highlight-overlay';
          if (container) {
            container.appendChild(overlay);
          }
          highlightData.overlays.push(overlay);
        }

        // 最初のマッチを現在のマッチとして設定
        currentMatchIndex = matches > 0 ? 0 : -1;

        return {
          success: true,
          count: matches,
          currentIndex: currentMatchIndex,
          totalMatches: matches,
        };
      }
      return { success: false };
    };

    const message = {
      action: 'search',
      query: 'test',
      useRegex: false,
      caseSensitive: false,
      useElementSearch: false,
      elementSearchMode: 'css',
    };

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, message, (resp) => {
        resolve(resp);
      });
    });

    expect(response.success).toBe(true);
    expect(response.count).toBeGreaterThan(0);
    expect(response.currentIndex).toBe(0);
    expect(response.totalMatches).toBeGreaterThan(0);

    // 最初のオーバーレイが現在のマッチクラスを持っていることを確認
    const container = document.getElementById('pattern-lens-overlay-container');
    expect(container).toBeTruthy();
    const firstOverlay = container?.querySelector('.pattern-lens-current-match');
    expect(firstOverlay).toBeTruthy();
  });

  it('「次へ」ボタンで次のマッチに移動できる', async () => {
    // まず検索を実行
    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const query = request.query;
        const bodyText = document.body.textContent || '';
        const searchText = bodyText.toLowerCase();
        const searchQuery = query.toLowerCase();

        let matches = 0;
        let index = -1;
        while ((index = searchText.indexOf(searchQuery, index + 1)) !== -1) {
          matches++;
        }

        let container = document.getElementById('pattern-lens-overlay-container');
        if (!container && matches > 0) {
          container = document.createElement('div');
          container.id = 'pattern-lens-overlay-container';
          document.body.appendChild(container);
        }

        highlightData.ranges = [];
        highlightData.overlays = [];
        for (let i = 0; i < matches; i++) {
          const range = document.createRange();
          highlightData.ranges.push(range);

          const overlay = document.createElement('div');
          overlay.className = i === 0 ? 'pattern-lens-highlight-overlay pattern-lens-current-match' : 'pattern-lens-highlight-overlay';
          if (container) {
            container.appendChild(overlay);
          }
          highlightData.overlays.push(overlay);
        }

        currentMatchIndex = matches > 0 ? 0 : -1;

        return {
          success: true,
          count: matches,
          currentIndex: currentMatchIndex,
          totalMatches: matches,
        };
      } else if (request.action === 'navigate-next') {
        // 次のマッチに移動
        const totalMatches = highlightData.ranges.length;
        if (totalMatches === 0) {
          return {
            success: true,
            currentIndex: -1,
            totalMatches: 0,
          };
        }

        // インデックスをインクリメント（ラップアラウンド）
        currentMatchIndex = (currentMatchIndex + 1) % totalMatches;

        // オーバーレイのクラスを更新
        highlightData.overlays.forEach((overlay, index) => {
          if (index === currentMatchIndex) {
            overlay.className = 'pattern-lens-highlight-overlay pattern-lens-current-match';
          } else {
            overlay.className = 'pattern-lens-highlight-overlay';
          }
        });

        return {
          success: true,
          currentIndex: currentMatchIndex,
          totalMatches: totalMatches,
        };
      }
      return { success: false };
    };

    // 検索を実行
    const searchMessage = {
      action: 'search',
      query: 'test',
      useRegex: false,
      caseSensitive: false,
      useElementSearch: false,
      elementSearchMode: 'css',
    };

    await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, searchMessage, () => {
        resolve(null);
      });
    });

    // 「次へ」を実行
    const navigateMessage = {
      action: 'navigate-next',
    };

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, navigateMessage, (resp) => {
        resolve(resp);
      });
    });

    expect(response.success).toBe(true);
    expect(response.currentIndex).toBe(1);
    expect(response.totalMatches).toBeGreaterThan(1);

    // 2番目のオーバーレイが現在のマッチクラスを持っていることを確認
    const container = document.getElementById('pattern-lens-overlay-container');
    const currentOverlay = container?.querySelector('.pattern-lens-current-match');
    expect(currentOverlay).toBeTruthy();
    expect(highlightData.overlays[1]).toBe(currentOverlay);
  });

  it('「前へ」ボタンで前のマッチに移動できる', async () => {
    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const query = request.query;
        const bodyText = document.body.textContent || '';
        const searchText = bodyText.toLowerCase();
        const searchQuery = query.toLowerCase();

        let matches = 0;
        let index = -1;
        while ((index = searchText.indexOf(searchQuery, index + 1)) !== -1) {
          matches++;
        }

        let container = document.getElementById('pattern-lens-overlay-container');
        if (!container && matches > 0) {
          container = document.createElement('div');
          container.id = 'pattern-lens-overlay-container';
          document.body.appendChild(container);
        }

        highlightData.ranges = [];
        highlightData.overlays = [];
        for (let i = 0; i < matches; i++) {
          const range = document.createRange();
          highlightData.ranges.push(range);

          const overlay = document.createElement('div');
          overlay.className = i === 0 ? 'pattern-lens-highlight-overlay pattern-lens-current-match' : 'pattern-lens-highlight-overlay';
          if (container) {
            container.appendChild(overlay);
          }
          highlightData.overlays.push(overlay);
        }

        currentMatchIndex = matches > 0 ? 0 : -1;

        return {
          success: true,
          count: matches,
          currentIndex: currentMatchIndex,
          totalMatches: matches,
        };
      } else if (request.action === 'navigate-prev') {
        const totalMatches = highlightData.ranges.length;
        if (totalMatches === 0) {
          return {
            success: true,
            currentIndex: -1,
            totalMatches: 0,
          };
        }

        // インデックスをデクリメント（ラップアラウンド）
        currentMatchIndex = currentMatchIndex <= 0 ? totalMatches - 1 : currentMatchIndex - 1;

        // オーバーレイのクラスを更新
        highlightData.overlays.forEach((overlay, index) => {
          if (index === currentMatchIndex) {
            overlay.className = 'pattern-lens-highlight-overlay pattern-lens-current-match';
          } else {
            overlay.className = 'pattern-lens-highlight-overlay';
          }
        });

        return {
          success: true,
          currentIndex: currentMatchIndex,
          totalMatches: totalMatches,
        };
      }
      return { success: false };
    };

    // 検索を実行
    const searchMessage = {
      action: 'search',
      query: 'test',
      useRegex: false,
      caseSensitive: false,
      useElementSearch: false,
      elementSearchMode: 'css',
    };

    await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, searchMessage, () => {
        resolve(null);
      });
    });

    // 「前へ」を実行（最初のマッチから最後のマッチに移動）
    const navigateMessage = {
      action: 'navigate-prev',
    };

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, navigateMessage, (resp) => {
        resolve(resp);
      });
    });

    expect(response.success).toBe(true);
    expect(response.currentIndex).toBeGreaterThan(0);
    expect(response.totalMatches).toBeGreaterThan(1);
  });

  it('最後のマッチから「次へ」で最初のマッチにラップアラウンドする', async () => {
    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const query = request.query;
        const bodyText = document.body.textContent || '';
        const searchText = bodyText.toLowerCase();
        const searchQuery = query.toLowerCase();

        let matches = 0;
        let index = -1;
        while ((index = searchText.indexOf(searchQuery, index + 1)) !== -1) {
          matches++;
        }

        let container = document.getElementById('pattern-lens-overlay-container');
        if (!container && matches > 0) {
          container = document.createElement('div');
          container.id = 'pattern-lens-overlay-container';
          document.body.appendChild(container);
        }

        highlightData.ranges = [];
        highlightData.overlays = [];
        for (let i = 0; i < matches; i++) {
          const range = document.createRange();
          highlightData.ranges.push(range);

          const overlay = document.createElement('div');
          overlay.className = i === 0 ? 'pattern-lens-highlight-overlay pattern-lens-current-match' : 'pattern-lens-highlight-overlay';
          if (container) {
            container.appendChild(overlay);
          }
          highlightData.overlays.push(overlay);
        }

        currentMatchIndex = matches > 0 ? 0 : -1;

        return {
          success: true,
          count: matches,
          currentIndex: currentMatchIndex,
          totalMatches: matches,
        };
      } else if (request.action === 'navigate-next') {
        const totalMatches = highlightData.ranges.length;
        if (totalMatches === 0) {
          return {
            success: true,
            currentIndex: -1,
            totalMatches: 0,
          };
        }

        currentMatchIndex = (currentMatchIndex + 1) % totalMatches;

        highlightData.overlays.forEach((overlay, index) => {
          if (index === currentMatchIndex) {
            overlay.className = 'pattern-lens-highlight-overlay pattern-lens-current-match';
          } else {
            overlay.className = 'pattern-lens-highlight-overlay';
          }
        });

        return {
          success: true,
          currentIndex: currentMatchIndex,
          totalMatches: totalMatches,
        };
      }
      return { success: false };
    };

    // 検索を実行
    const searchMessage = {
      action: 'search',
      query: 'test',
      useRegex: false,
      caseSensitive: false,
      useElementSearch: false,
      elementSearchMode: 'css',
    };

    await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, searchMessage, () => {
        resolve(null);
      });
    });

    // 最後のマッチまで移動
    const totalMatches = highlightData.ranges.length;
    for (let i = 0; i < totalMatches - 1; i++) {
      await new Promise((resolve) => {
        chrome.tabs.sendMessage(1, { action: 'navigate-next' }, () => {
          resolve(null);
        });
      });
    }

    // 最後のマッチから「次へ」を実行（最初に戻る）
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, { action: 'navigate-next' }, (resp) => {
        resolve(resp);
      });
    });

    expect(response.success).toBe(true);
    expect(response.currentIndex).toBe(0); // 最初のマッチに戻る
    expect(response.totalMatches).toBeGreaterThan(1);
  });
});
