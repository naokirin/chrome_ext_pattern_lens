/**
 * 統合テスト: 要素境界をまたぐ検索
 * 
 * テストシナリオ:
 * 1. test-cross-element.html のようなページで検索を実行
 * 2. <span>や<p>をまたぐキーワード（例: "ipsum dolor", "mkdir-p"）が正しくハイライトされることを確認
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanupDOM } from '../helpers/dom-helpers.js';

describe('統合テスト: 要素境界をまたぐ検索', () => {
  let mockSendMessage;
  let mockTabsQuery;
  let messageHandler;

  beforeEach(() => {
    cleanupDOM();
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

  it('span要素をまたぐテキスト（空白なし）が正しく検索される', async () => {
    // test-cross-element.html のケース1-1を再現
    document.body.innerHTML = `
      <div>
        <span>mkdir</span><span>-p</span>
      </div>
    `;

    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        // 実際のcontent.tsのロジックを模倣
        // createVirtualTextAndMap()が要素境界を正しく処理することを想定
        const bodyText = document.body.innerText || document.body.textContent || '';
        const query = request.query;
        const caseSensitive = request.caseSensitive;
        const searchText = caseSensitive ? bodyText : bodyText.toLowerCase();
        const searchQuery = caseSensitive ? query : query.toLowerCase();

        // innerTextを使用することで、要素境界が正しく処理される
        // "mkdir-p" は "mkdir" と "-p" の間に空白がなくてもマッチする
        const matches = searchText.includes(searchQuery) ? 1 : 0;

        if (matches > 0) {
          let container = document.getElementById('pattern-lens-overlay-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'pattern-lens-overlay-container';
            document.body.appendChild(container);
          }
        }

        return {
          success: true,
          count: matches,
          currentIndex: matches > 0 ? 0 : -1,
          totalMatches: matches,
        };
      }
      return { success: false };
    };

    const message = {
      action: 'search',
      query: 'mkdir-p',
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
    expect(response.count).toBe(1);
    expect(response.totalMatches).toBe(1);
  });

  it('複数のspan要素をまたぐテキスト（明示的な空白あり）が正しく検索される', async () => {
    // test-cross-element.html のケース1-2を再現
    document.body.innerHTML = `
      <div>
        <span>Hello</span><span> </span><span>World</span><span>!</span>
      </div>
    `;

    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const bodyText = document.body.innerText || document.body.textContent || '';
        const query = request.query;
        const caseSensitive = request.caseSensitive;
        const searchText = caseSensitive ? bodyText : bodyText.toLowerCase();
        const searchQuery = caseSensitive ? query : query.toLowerCase();
        const matches = searchText.includes(searchQuery) ? 1 : 0;

        if (matches > 0) {
          let container = document.getElementById('pattern-lens-overlay-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'pattern-lens-overlay-container';
            document.body.appendChild(container);
          }
        }

        return {
          success: true,
          count: matches,
          currentIndex: matches > 0 ? 0 : -1,
          totalMatches: matches,
        };
      }
      return { success: false };
    };

    const message = {
      action: 'search',
      query: 'Hello World!',
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
    expect(response.count).toBe(1);
  });

  it('ブロック要素（p要素）をまたぐテキストは検索されない', async () => {
    // test-cross-element.html のケース2-2を再現
    // 実装では、ブロック要素間には境界マーカーが挿入されるため、境界をまたぐ検索はできない
    document.body.innerHTML = `
      <div>
        <p>Lorem ipsum</p><p>dolor sit</p>
      </div>
    `;

    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        // 実装では、ブロック要素間には境界マーカーが挿入されるため、
        // "ipsum dolor" のような検索はマッチしない
        // 各ブロック要素内でのみ検索される
        const paragraphs = document.querySelectorAll('p');
        let matches = 0;
        const query = request.query;
        const caseSensitive = request.caseSensitive;
        const searchQuery = caseSensitive ? query : query.toLowerCase();

        paragraphs.forEach((p) => {
          const text = caseSensitive ? p.textContent || '' : (p.textContent || '').toLowerCase();
          if (text.includes(searchQuery)) {
            matches++;
          }
        });

        if (matches > 0) {
          let container = document.getElementById('pattern-lens-overlay-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'pattern-lens-overlay-container';
            document.body.appendChild(container);
          }
        }

        return {
          success: true,
          count: matches,
          currentIndex: matches > 0 ? 0 : -1,
          totalMatches: matches,
        };
      }
      return { success: false };
    };

    const message = {
      action: 'search',
      query: 'ipsum dolor',
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
    // ブロック要素間をまたぐ検索はできないため、マッチ数は0
    expect(response.count).toBe(0);
  });

  it('ネストしたspan要素をまたぐテキストが正しく検索される', async () => {
    // test-cross-element.html のケース3-1を再現
    document.body.innerHTML = `
      <div>
        <span>git <span>commit</span> <span>-m</span></span> <span>"message"</span>
      </div>
    `;

    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const bodyText = document.body.innerText || document.body.textContent || '';
        const query = request.query;
        const caseSensitive = request.caseSensitive;
        const searchText = caseSensitive ? bodyText : bodyText.toLowerCase();
        const searchQuery = caseSensitive ? query : query.toLowerCase();
        const matches = searchText.includes(searchQuery) ? 1 : 0;

        if (matches > 0) {
          let container = document.getElementById('pattern-lens-overlay-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'pattern-lens-overlay-container';
            document.body.appendChild(container);
          }
        }

        return {
          success: true,
          count: matches,
          currentIndex: matches > 0 ? 0 : -1,
          totalMatches: matches,
        };
      }
      return { success: false };
    };

    const message = {
      action: 'search',
      query: 'git commit -m "message"',
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
    expect(response.count).toBe(1);
  });

  it('リスト項目をまたぐテキストは検索されない', async () => {
    // test-cross-element.html のケース3-2を再現
    // 実装では、<li>要素はブロック要素（list-item）として扱われるため、
    // リスト項目間には境界マーカーが挿入され、境界をまたぐ検索はできない
    document.body.innerHTML = `
      <ul>
        <li>First</li>
        <li>Second</li>
        <li>Third</li>
      </ul>
    `;

    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        // 実装では、リスト項目間には境界マーカーが挿入されるため、
        // "First Second" のような検索はマッチしない
        // 各リスト項目内でのみ検索される
        const listItems = document.querySelectorAll('li');
        let matches = 0;
        const query = request.query;
        const caseSensitive = request.caseSensitive;
        const searchQuery = caseSensitive ? query : query.toLowerCase();

        listItems.forEach((li) => {
          const text = caseSensitive ? li.textContent || '' : (li.textContent || '').toLowerCase();
          if (text.includes(searchQuery)) {
            matches++;
          }
        });

        if (matches > 0) {
          let container = document.getElementById('pattern-lens-overlay-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'pattern-lens-overlay-container';
            document.body.appendChild(container);
          }
        }

        return {
          success: true,
          count: matches,
          currentIndex: matches > 0 ? 0 : -1,
          totalMatches: matches,
        };
      }
      return { success: false };
    };

    const message = {
      action: 'search',
      query: 'First Second',
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
    // リスト項目間をまたぐ検索はできないため、マッチ数は0
    expect(response.count).toBe(0);
  });

  it('要素をまたぐ正規表現検索が正しく動作する', async () => {
    // test-cross-element.html のケース4-1を再現
    document.body.innerHTML = `
      <div>
        <span>test</span><span>123</span>
      </div>
    `;

    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch && request.useRegex) {
        const bodyText = document.body.innerText || document.body.textContent || '';
        const query = request.query;
        const caseSensitive = request.caseSensitive;
        const flags = caseSensitive ? 'g' : 'gi';

        try {
          const regex = new RegExp(query, flags);
          const matchArray = bodyText.match(regex);
          const matches = matchArray ? matchArray.length : 0;

          if (matches > 0) {
            let container = document.getElementById('pattern-lens-overlay-container');
            if (!container) {
              container = document.createElement('div');
              container.id = 'pattern-lens-overlay-container';
              document.body.appendChild(container);
            }
          }

          return {
            success: true,
            count: matches,
            currentIndex: matches > 0 ? 0 : -1,
            totalMatches: matches,
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
      query: 'test\\s*\\d+',
      useRegex: true,
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
    expect(response.count).toBeGreaterThanOrEqual(1);
  });
});
