/**
 * 統合テスト: ミニマップとの連携
 * 
 * テストシナリオ:
 * 1. 検索実行後、ミニマップにハイライト位置が正しく表示されるか
 * 2. ナビゲーション時に、ミニマップ上のアクティブなマーカーが更新されるか
 * 3. 検索結果が0件の場合、ミニマップが非表示になるか
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanupDOM } from '../helpers/dom-helpers.js';

describe('統合テスト: ミニマップとの連携', () => {
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

    // スクロール可能な長いコンテンツを作成
    document.body.innerHTML = `
      <div style="height: 2000px;">
        <p style="margin-top: 100px;">test content one</p>
        <p style="margin-top: 500px;">test content two</p>
        <p style="margin-top: 500px;">test content three</p>
        <p style="margin-top: 500px;">another test content</p>
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

  // ミニマップを更新する関数（content.tsのupdateMinimapを模倣）
  function updateMinimap() {
    const MINIMAP_CONTAINER_ID = 'pattern-lens-minimap-container';
    let container = document.getElementById(MINIMAP_CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = MINIMAP_CONTAINER_ID;
      document.body.appendChild(container);
    }

    container.innerHTML = '';

    if (highlightData.ranges.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'block';

    const pageHeight = document.documentElement.scrollHeight;

    highlightData.ranges.forEach((range, index) => {
      const marker = document.createElement('div');

      try {
        const rect = range.getBoundingClientRect();
        const absoluteTop = rect.top + window.scrollY;
        const relativeTop = (absoluteTop / pageHeight) * 100;

        const isActive = index === currentMatchIndex;

        marker.style.cssText = `
          position: absolute;
          top: ${relativeTop}%;
          left: 0;
          width: 100%;
          height: 4px;
          background-color: ${isActive ? 'rgba(255, 87, 34, 0.9)' : 'rgba(255, 193, 7, 0.8)'};
          border-radius: 1px;
        `;

        container.appendChild(marker);
      } catch (_error) {
        // Failed to create minimap marker, silently ignore
      }
    });
  }

  it('検索実行後、ミニマップにハイライト位置が表示される', async () => {
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

        // Rangeを作成（簡易版）
        highlightData.ranges = [];
        const paragraphs = document.querySelectorAll('p');
        paragraphs.forEach((p) => {
          if (p.textContent?.toLowerCase().includes(searchQuery)) {
            const range = document.createRange();
            range.selectNodeContents(p);
            highlightData.ranges.push(range);
          }
        });

        currentMatchIndex = highlightData.ranges.length > 0 ? 0 : -1;

        // ミニマップを更新
        updateMinimap();

        return {
          success: true,
          count: highlightData.ranges.length,
          currentIndex: currentMatchIndex,
          totalMatches: highlightData.ranges.length,
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

    // ミニマップコンテナが作成されていることを確認
    const minimapContainer = document.getElementById('pattern-lens-minimap-container');
    expect(minimapContainer).toBeTruthy();
    expect(minimapContainer?.style.display).not.toBe('none');

    // ミニマップにマーカーが表示されていることを確認
    const markers = minimapContainer?.querySelectorAll('div');
    expect(markers?.length).toBeGreaterThan(0);
  });

  it('ナビゲーション時に、ミニマップ上のアクティブなマーカーが更新される', async () => {
    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const query = request.query;
        const paragraphs = document.querySelectorAll('p');
        highlightData.ranges = [];
        paragraphs.forEach((p) => {
          if (p.textContent?.toLowerCase().includes(query.toLowerCase())) {
            const range = document.createRange();
            range.selectNodeContents(p);
            highlightData.ranges.push(range);
          }
        });

        currentMatchIndex = highlightData.ranges.length > 0 ? 0 : -1;
        updateMinimap();

        return {
          success: true,
          count: highlightData.ranges.length,
          currentIndex: currentMatchIndex,
          totalMatches: highlightData.ranges.length,
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
        updateMinimap();

        return {
          success: true,
          currentIndex: currentMatchIndex,
          totalMatches: totalMatches,
        };
      }
      return { success: false };
    };

    // 検索を実行
    await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, {
        action: 'search',
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
      }, () => {
        resolve(null);
      });
    });

    // 最初のマーカーがアクティブであることを確認
    const minimapContainer1 = document.getElementById('pattern-lens-minimap-container');
    const firstMarker = minimapContainer1?.children[0];
    expect(firstMarker?.style.backgroundColor).toBe('rgba(255, 87, 34, 0.9)'); // アクティブな色

    // 「次へ」を実行
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, { action: 'navigate-next' }, (resp) => {
        resolve(resp);
      });
    });

    expect(response.success).toBe(true);
    expect(response.currentIndex).toBe(1);

    // 2番目のマーカーがアクティブになっていることを確認
    const minimapContainer2 = document.getElementById('pattern-lens-minimap-container');
    const secondMarker = minimapContainer2?.children[1];
    expect(secondMarker?.style.backgroundColor).toBe('rgba(255, 87, 34, 0.9)'); // アクティブな色

    // 最初のマーカーが非アクティブになっていることを確認
    const firstMarkerAfter = minimapContainer2?.children[0];
    expect(firstMarkerAfter?.style.backgroundColor).toBe('rgba(255, 193, 7, 0.8)'); // 非アクティブな色
  });

  it('検索結果が0件の場合、ミニマップが非表示になる', async () => {
    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const query = request.query;
        const bodyText = document.body.textContent || '';
        const searchText = bodyText.toLowerCase();
        const searchQuery = query.toLowerCase();

        const matches = searchText.includes(searchQuery) ? 1 : 0;

        highlightData.ranges = [];
        if (matches === 0) {
          // ミニマップを非表示にする
          const minimapContainer = document.getElementById('pattern-lens-minimap-container');
          if (minimapContainer) {
            minimapContainer.style.display = 'none';
          }
        } else {
          // Rangeを作成してミニマップを更新
          const paragraphs = document.querySelectorAll('p');
          paragraphs.forEach((p) => {
            if (p.textContent?.toLowerCase().includes(searchQuery)) {
              const range = document.createRange();
              range.selectNodeContents(p);
              highlightData.ranges.push(range);
            }
          });
          currentMatchIndex = 0;
          updateMinimap();
        }

        return {
          success: true,
          count: highlightData.ranges.length,
          currentIndex: highlightData.ranges.length > 0 ? 0 : -1,
          totalMatches: highlightData.ranges.length,
        };
      }
      return { success: false };
    };

    // 存在しないキーワードで検索
    const message = {
      action: 'search',
      query: 'nonexistentkeyword12345',
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
    expect(response.count).toBe(0);

    // ミニマップが非表示になっていることを確認
    const minimapContainer = document.getElementById('pattern-lens-minimap-container');
    if (minimapContainer) {
      expect(minimapContainer.style.display).toBe('none');
    } else {
      // ミニマップが作成されていない場合もOK
      expect(true).toBe(true);
    }
  });

  it('ハイライトをクリアすると、ミニマップも削除される', async () => {
    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const query = request.query;
        const paragraphs = document.querySelectorAll('p');
        highlightData.ranges = [];
        paragraphs.forEach((p) => {
          if (p.textContent?.toLowerCase().includes(query.toLowerCase())) {
            const range = document.createRange();
            range.selectNodeContents(p);
            highlightData.ranges.push(range);
          }
        });

        currentMatchIndex = highlightData.ranges.length > 0 ? 0 : -1;
        updateMinimap();

        return {
          success: true,
          count: highlightData.ranges.length,
          currentIndex: currentMatchIndex,
          totalMatches: highlightData.ranges.length,
        };
      } else if (request.action === 'clear') {
        highlightData.ranges = [];
        highlightData.elements = [];
        highlightData.overlays = [];
        currentMatchIndex = -1;

        // ミニマップを削除
        const minimapContainer = document.getElementById('pattern-lens-minimap-container');
        if (minimapContainer) {
          minimapContainer.remove();
        }

        return { success: true };
      }
      return { success: false };
    };

    // 検索を実行
    await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, {
        action: 'search',
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
      }, () => {
        resolve(null);
      });
    });

    // ミニマップが存在することを確認
    let minimapContainer = document.getElementById('pattern-lens-minimap-container');
    expect(minimapContainer).toBeTruthy();

    // ハイライトをクリア
    await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, { action: 'clear' }, () => {
        resolve(null);
      });
    });

    // ミニマップが削除されていることを確認
    minimapContainer = document.getElementById('pattern-lens-minimap-container');
    expect(minimapContainer).toBeFalsy();
  });
});
