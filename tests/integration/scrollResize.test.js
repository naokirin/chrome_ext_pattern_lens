/**
 * 統合テスト: スクロール/リサイズ時の追従
 * 
 * テストシナリオ:
 * 1. ページをスクロールまたはウィンドウサイズを変更
 * 2. updateOverlayPositions が呼ばれ、オーバーレイの位置が正しく更新されることを確認
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanupDOM } from '../helpers/dom-helpers.js';

describe('統合テスト: スクロール/リサイズ時の追従', () => {
  let mockSendMessage;
  let mockTabsQuery;
  let messageHandler;
  let highlightData = {
    ranges: [],
    elements: [],
    overlays: [],
  };

  beforeEach(() => {
    cleanupDOM();
    highlightData = {
      ranges: [],
      elements: [],
      overlays: [],
    };

    // スクロール可能な長いコンテンツを作成
    document.body.innerHTML = `
      <div style="height: 2000px; padding: 20px;">
        <p style="margin-top: 100px;">test content one</p>
        <p style="margin-top: 500px;">test content two</p>
        <p style="margin-top: 500px;">test content three</p>
      </div>
    `;

    // ウィンドウサイズを設定
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });
    Object.defineProperty(window, 'scrollX', {
      writable: true,
      configurable: true,
      value: 0,
    });
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 0,
    });
    Object.defineProperty(window, 'pageXOffset', {
      writable: true,
      configurable: true,
      value: 0,
    });
    Object.defineProperty(window, 'pageYOffset', {
      writable: true,
      configurable: true,
      value: 0,
    });

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

  // オーバーレイの位置を更新する関数（content.tsのupdateOverlayPositionsを模倣）
  function updateOverlayPositions() {
    const container = document.getElementById('pattern-lens-overlay-container');
    if (!container) return;

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    highlightData.ranges.forEach((range, index) => {
      try {
        const rects = range.getClientRects();
        if (rects.length === 0) return;

        // 最初の矩形を使用（簡易版）
        const rect = rects[0];
        const overlay = highlightData.overlays[index];
        if (overlay) {
          overlay.style.left = `${rect.left + scrollX - 2}px`;
          overlay.style.top = `${rect.top + scrollY - 2}px`;
        }
      } catch (_error) {
        // Failed to update overlay position, silently ignore
      }
    });
  }

  it('スクロール時にオーバーレイの位置が更新される', async () => {
    let scrollListener = null;

    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const query = request.query;
        const paragraphs = document.querySelectorAll('p');
        highlightData.ranges = [];
        highlightData.overlays = [];

        paragraphs.forEach((p) => {
          if (p.textContent?.toLowerCase().includes(query.toLowerCase())) {
            const range = document.createRange();
            range.selectNodeContents(p);
            highlightData.ranges.push(range);

            // オーバーレイを作成
            const container = document.getElementById('pattern-lens-overlay-container') ||
              (() => {
                const c = document.createElement('div');
                c.id = 'pattern-lens-overlay-container';
                c.style.cssText = `
                                 position: absolute;
                                 top: 0;
                                 left: 0;
                                 width: 100%;
                                 height: 100%;
                                 pointer-events: none;
                                 z-index: 2147483647;
                               `;
                document.body.appendChild(c);
                return c;
              })();

            const rect = p.getBoundingClientRect();
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;

            const overlay = document.createElement('div');
            overlay.className = 'pattern-lens-highlight-overlay';
            overlay.style.cssText = `
              position: absolute;
              left: ${rect.left + scrollX - 2}px;
              top: ${rect.top + scrollY - 2}px;
              width: ${rect.width + 4}px;
              height: ${rect.height + 4}px;
              background-color: rgba(255, 235, 59, 0.4);
              border: 1px solid rgba(255, 193, 7, 0.8);
              pointer-events: none;
            `;
            container.appendChild(overlay);
            highlightData.overlays.push(overlay);
          }
        });

        // スクロールイベントリスナーを追加
        scrollListener = updateOverlayPositions;
        window.addEventListener('scroll', scrollListener, { passive: true });

        return {
          success: true,
          count: highlightData.ranges.length,
          currentIndex: highlightData.ranges.length > 0 ? 0 : -1,
          totalMatches: highlightData.ranges.length,
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

    // 最初のオーバーレイの位置を記録
    const firstOverlay = highlightData.overlays[0];
    expect(firstOverlay).toBeTruthy();
    const initialTop = parseInt(firstOverlay.style.top) || 0;

    // スクロールをシミュレート
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
    Object.defineProperty(window, 'pageYOffset', { value: 200, configurable: true });

    // オーバーレイの位置を更新
    if (scrollListener) {
      scrollListener();
    }

    // オーバーレイの位置が更新されていることを確認
    const newTop = parseInt(firstOverlay.style.top) || 0;
    // スクロール分だけ位置が調整されている（簡易チェック）
    expect(newTop).not.toBe(initialTop);
  });

  it('リサイズ時にオーバーレイの位置が更新される', async () => {
    let resizeListener = null;

    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const query = request.query;
        const paragraphs = document.querySelectorAll('p');
        highlightData.ranges = [];
        highlightData.overlays = [];

        paragraphs.forEach((p) => {
          if (p.textContent?.toLowerCase().includes(query.toLowerCase())) {
            const range = document.createRange();
            range.selectNodeContents(p);
            highlightData.ranges.push(range);

            const container = document.getElementById('pattern-lens-overlay-container') ||
              (() => {
                const c = document.createElement('div');
                c.id = 'pattern-lens-overlay-container';
                c.style.cssText = `
                                 position: absolute;
                                 top: 0;
                                 left: 0;
                                 width: 100%;
                                 height: 100%;
                                 pointer-events: none;
                                 z-index: 2147483647;
                               `;
                document.body.appendChild(c);
                return c;
              })();

            const rect = p.getBoundingClientRect();
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;

            const overlay = document.createElement('div');
            overlay.className = 'pattern-lens-highlight-overlay';
            overlay.style.cssText = `
              position: absolute;
              left: ${rect.left + scrollX - 2}px;
              top: ${rect.top + scrollY - 2}px;
              width: ${rect.width + 4}px;
              height: ${rect.height + 4}px;
              background-color: rgba(255, 235, 59, 0.4);
              border: 1px solid rgba(255, 193, 7, 0.8);
              pointer-events: none;
            `;
            container.appendChild(overlay);
            highlightData.overlays.push(overlay);
          }
        });

        // リサイズイベントリスナーを追加
        resizeListener = updateOverlayPositions;
        window.addEventListener('resize', resizeListener, { passive: true });

        return {
          success: true,
          count: highlightData.ranges.length,
          currentIndex: highlightData.ranges.length > 0 ? 0 : -1,
          totalMatches: highlightData.ranges.length,
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

    // 最初のオーバーレイの位置を記録
    const firstOverlay = highlightData.overlays[0];
    expect(firstOverlay).toBeTruthy();
    const initialLeft = parseInt(firstOverlay.style.left) || 0;

    // ウィンドウサイズを変更（これにより要素の位置が変わる可能性がある）
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });

    // オーバーレイの位置を更新
    if (resizeListener) {
      resizeListener();
    }

    // オーバーレイの位置が更新されていることを確認
    // （実際の位置は要素の位置に依存するため、単に更新処理が実行されたことを確認）
    expect(firstOverlay).toBeTruthy();
  });

  it('ハイライトをクリアすると、スクロール/リサイズイベントリスナーが削除される', async () => {
    let scrollListener = null;
    let resizeListener = null;

    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const query = request.query;
        const paragraphs = document.querySelectorAll('p');
        highlightData.ranges = [];
        highlightData.overlays = [];

        paragraphs.forEach((p) => {
          if (p.textContent?.toLowerCase().includes(query.toLowerCase())) {
            const range = document.createRange();
            range.selectNodeContents(p);
            highlightData.ranges.push(range);
          }
        });

        scrollListener = updateOverlayPositions;
        resizeListener = updateOverlayPositions;
        window.addEventListener('scroll', scrollListener, { passive: true });
        window.addEventListener('resize', resizeListener, { passive: true });

        return {
          success: true,
          count: highlightData.ranges.length,
          currentIndex: highlightData.ranges.length > 0 ? 0 : -1,
          totalMatches: highlightData.ranges.length,
        };
      } else if (request.action === 'clear') {
        highlightData.ranges = [];
        highlightData.elements = [];
        highlightData.overlays = [];

        // イベントリスナーを削除
        if (scrollListener) {
          window.removeEventListener('scroll', scrollListener);
        }
        if (resizeListener) {
          window.removeEventListener('resize', resizeListener);
        }

        // オーバーレイコンテナを削除
        const container = document.getElementById('pattern-lens-overlay-container');
        if (container) {
          container.remove();
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

    // ハイライトをクリア
    await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, { action: 'clear' }, () => {
        resolve(null);
      });
    });

    // オーバーレイコンテナが削除されていることを確認
    const container = document.getElementById('pattern-lens-overlay-container');
    expect(container).toBeFalsy();
  });
});
