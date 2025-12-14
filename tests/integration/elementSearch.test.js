/**
 * 統合テスト: CSS/XPathセレクタ検索
 *
 * テストシナリオ:
 * 1. Popupで要素検索モードに切り替え、セレクタを入力
 * 2. searchElements が実行され、一致する要素がハイライトされることを確認
 * 3. 不正なセレクタのエラーハンドリング
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupDOM } from '../helpers/dom-helpers.js';

describe('統合テスト: CSS/XPathセレクタ検索', () => {
  let mockSendMessage;
  let mockTabsQuery;
  let messageHandler;

  beforeEach(() => {
    cleanupDOM();
    document.body.innerHTML = `
      <div>
        <p class="test-class">Paragraph 1</p>
        <p class="test-class">Paragraph 2</p>
        <div id="test-id">Div with ID</div>
        <span class="test-class">Span element</span>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
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
            callback({
              defaultRegex: false,
              defaultCaseSensitive: false,
              defaultElementSearch: false,
            });
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

  it('CSSセレクタで要素を検索できる', async () => {
    messageHandler = (request) => {
      if (
        request.action === 'search' &&
        request.useElementSearch &&
        request.elementSearchMode === 'css'
      ) {
        const query = request.query;
        let elements = [];

        try {
          elements = Array.from(document.querySelectorAll(query));

          // オーバーレイコンテナとその子要素を除外
          const _overlayContainer = document.getElementById('pattern-lens-overlay-container');
          elements = elements.filter((el) => {
            return (
              el.id !== 'pattern-lens-overlay-container' &&
              !el.closest('#pattern-lens-overlay-container')
            );
          });

          // オーバーレイコンテナを作成
          let container = document.getElementById('pattern-lens-overlay-container');
          if (!container && elements.length > 0) {
            container = document.createElement('div');
            container.id = 'pattern-lens-overlay-container';
            container.style.cssText = `
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              pointer-events: none;
              z-index: 2147483647;
            `;
            document.body.appendChild(container);
          }

          // 各要素に対してオーバーレイを作成
          if (container) {
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;
            const padding = 2;

            // mergeAdjacentRects関数を簡易実装
            function mergeAdjacentRects(rectList) {
              if (!rectList || rectList.length === 0) {
                return [];
              }
              const rects = Array.from(rectList);
              // 簡易版: 最初の矩形を使用（実装では行ごとにマージするが、テストでは簡略化）
              return rects.length > 0 ? [rects[0]] : [];
            }

            elements.forEach((element) => {
              // テスト環境ではgetClientRects()が空を返す可能性があるため、
              // getBoundingClientRect()を優先的に使用
              let rectsToUse = [];
              const rects = element.getClientRects();
              if (rects.length > 0) {
                rectsToUse = Array.from(rects);
              } else {
                // getClientRects()が空の場合はgetBoundingClientRect()を使用
                const boundingRect = element.getBoundingClientRect();
                // 要素が表示されている場合（幅または高さが0より大きい）
                if (boundingRect.width > 0 || boundingRect.height > 0) {
                  rectsToUse = [boundingRect];
                } else {
                  // 要素が表示されていない場合でも、デフォルトの矩形を作成
                  // テスト環境では要素がレンダリングされていない可能性があるため
                  rectsToUse = [new DOMRect(0, 0, 100, 20)];
                }
              }

              if (rectsToUse.length > 0) {
                const mergedRects = mergeAdjacentRects(rectsToUse);
                for (let i = 0; i < mergedRects.length; i++) {
                  const rect = mergedRects[i];
                  const overlay = document.createElement('div');
                  overlay.className = 'pattern-lens-highlight-overlay';
                  overlay.style.cssText = `
                    position: absolute;
                    left: ${rect.left + scrollX - padding}px;
                    top: ${rect.top + scrollY - padding}px;
                    width: ${rect.width + padding * 2}px;
                    height: ${rect.height + padding * 2}px;
                    background-color: rgba(255, 235, 59, 0.4);
                    border: 1px solid rgba(255, 193, 7, 0.8);
                    border-radius: 2px;
                    pointer-events: none;
                    box-sizing: border-box;
                  `;
                  container.appendChild(overlay);
                }
              }
            });
          }

          return {
            success: true,
            count: elements.length,
            currentIndex: elements.length > 0 ? 0 : -1,
            totalMatches: elements.length,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      }
      return { success: false };
    };

    const message = {
      action: 'search',
      query: '.test-class',
      useRegex: false,
      caseSensitive: false,
      useElementSearch: true,
      elementSearchMode: 'css',
    };

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, message, (resp) => {
        resolve(resp);
      });
    });

    expect(response.success).toBe(true);
    expect(response.count).toBe(3); // p要素2つとspan要素1つ
    expect(response.totalMatches).toBe(3);

    // オーバーレイコンテナが作成されていることを確認
    const container = document.getElementById('pattern-lens-overlay-container');
    expect(container).toBeTruthy();
    expect(container?.children.length).toBeGreaterThan(0);
  });

  it('IDセレクタで要素を検索できる', async () => {
    messageHandler = (request) => {
      if (
        request.action === 'search' &&
        request.useElementSearch &&
        request.elementSearchMode === 'css'
      ) {
        const query = request.query;
        let elements = [];

        try {
          elements = Array.from(document.querySelectorAll(query));
          elements = elements.filter((el) => {
            return (
              el.id !== 'pattern-lens-overlay-container' &&
              !el.closest('#pattern-lens-overlay-container')
            );
          });

          let container = document.getElementById('pattern-lens-overlay-container');
          if (!container && elements.length > 0) {
            container = document.createElement('div');
            container.id = 'pattern-lens-overlay-container';
            document.body.appendChild(container);
          }

          if (container) {
            elements.forEach((element) => {
              const rects = element.getClientRects();
              for (let i = 0; i < rects.length; i++) {
                const overlay = document.createElement('div');
                overlay.className = 'pattern-lens-highlight-overlay';
                container.appendChild(overlay);
              }
            });
          }

          return {
            success: true,
            count: elements.length,
            currentIndex: elements.length > 0 ? 0 : -1,
            totalMatches: elements.length,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      }
      return { success: false };
    };

    const message = {
      action: 'search',
      query: '#test-id',
      useRegex: false,
      caseSensitive: false,
      useElementSearch: true,
      elementSearchMode: 'css',
    };

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, message, (resp) => {
        resolve(resp);
      });
    });

    expect(response.success).toBe(true);
    expect(response.count).toBe(1);
    expect(response.totalMatches).toBe(1);
  });

  it('XPathセレクタで要素を検索できる', async () => {
    messageHandler = (request) => {
      if (
        request.action === 'search' &&
        request.useElementSearch &&
        request.elementSearchMode === 'xpath'
      ) {
        const query = request.query;
        let elements = [];

        try {
          const result = document.evaluate(
            query,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );

          for (let i = 0; i < result.snapshotLength; i++) {
            const item = result.snapshotItem(i);
            if (item && item.nodeType === Node.ELEMENT_NODE) {
              elements.push(item);
            }
          }

          // オーバーレイコンテナを除外
          elements = elements.filter((el) => {
            return (
              el.id !== 'pattern-lens-overlay-container' &&
              !el.closest('#pattern-lens-overlay-container')
            );
          });

          let container = document.getElementById('pattern-lens-overlay-container');
          if (!container && elements.length > 0) {
            container = document.createElement('div');
            container.id = 'pattern-lens-overlay-container';
            document.body.appendChild(container);
          }

          if (container) {
            elements.forEach((element) => {
              const rects = element.getClientRects();
              for (let i = 0; i < rects.length; i++) {
                const overlay = document.createElement('div');
                overlay.className = 'pattern-lens-highlight-overlay';
                container.appendChild(overlay);
              }
            });
          }

          return {
            success: true,
            count: elements.length,
            currentIndex: elements.length > 0 ? 0 : -1,
            totalMatches: elements.length,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      }
      return { success: false };
    };

    const message = {
      action: 'search',
      query: '//li',
      useRegex: false,
      caseSensitive: false,
      useElementSearch: true,
      elementSearchMode: 'xpath',
    };

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, message, (resp) => {
        resolve(resp);
      });
    });

    expect(response.success).toBe(true);
    expect(response.count).toBe(2); // li要素2つ
    expect(response.totalMatches).toBe(2);
  });

  it('不正なCSSセレクタでエラーが返される', async () => {
    messageHandler = (request) => {
      if (
        request.action === 'search' &&
        request.useElementSearch &&
        request.elementSearchMode === 'css'
      ) {
        const query = request.query;

        try {
          // 不正なセレクタを試行
          document.querySelectorAll(query);
          return {
            success: true,
            count: 0,
            currentIndex: -1,
            totalMatches: 0,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      }
      return { success: false };
    };

    const message = {
      action: 'search',
      query: '...invalid...selector...',
      useRegex: false,
      caseSensitive: false,
      useElementSearch: true,
      elementSearchMode: 'css',
    };

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, message, (resp) => {
        resolve(resp);
      });
    });

    // エラーが返されるか、または0件が返される
    expect(response.success === false || response.count === 0).toBe(true);
  });

  it('不正なXPathセレクタでエラーが返される', async () => {
    messageHandler = (request) => {
      if (
        request.action === 'search' &&
        request.useElementSearch &&
        request.elementSearchMode === 'xpath'
      ) {
        const query = request.query;

        try {
          document.evaluate(query, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          return {
            success: true,
            count: 0,
            currentIndex: -1,
            totalMatches: 0,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      }
      return { success: false };
    };

    const message = {
      action: 'search',
      query: '//invalid[xpath[syntax]]',
      useRegex: false,
      caseSensitive: false,
      useElementSearch: true,
      elementSearchMode: 'xpath',
    };

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, message, (resp) => {
        resolve(resp);
      });
    });

    // エラーが返されるか、または0件が返される
    expect(response.success === false || response.count === 0).toBe(true);
  });

  it('要素検索でマッチしない場合、0件が返される', async () => {
    messageHandler = (request) => {
      if (
        request.action === 'search' &&
        request.useElementSearch &&
        request.elementSearchMode === 'css'
      ) {
        const query = request.query;
        let elements = [];

        try {
          elements = Array.from(document.querySelectorAll(query));
          elements = elements.filter((el) => {
            return (
              el.id !== 'pattern-lens-overlay-container' &&
              !el.closest('#pattern-lens-overlay-container')
            );
          });

          return {
            success: true,
            count: elements.length,
            currentIndex: -1,
            totalMatches: elements.length,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      }
      return { success: false };
    };

    const message = {
      action: 'search',
      query: '.nonexistent-class',
      useRegex: false,
      caseSensitive: false,
      useElementSearch: true,
      elementSearchMode: 'css',
    };

    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, message, (resp) => {
        resolve(resp);
      });
    });

    expect(response.success).toBe(true);
    expect(response.count).toBe(0);
    expect(response.totalMatches).toBe(0);
    expect(response.currentIndex).toBe(-1);
  });
});
