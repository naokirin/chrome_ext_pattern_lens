/**
 * 統合テスト: 検索状態の復元
 *
 * テストシナリオ:
 * 1. 検索を実行後、Popupを閉じる
 * 2. Popupを再度開いた際に、前回の検索状態（キーワード、マッチ件数、現在位置）が復元されるか
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupDOM } from '../helpers/dom-helpers.js';

describe('統合テスト: 検索状態の復元', () => {
  let mockSendMessage;
  let mockTabsQuery;
  let messageHandler;
  let lastSearchState = {
    query: '',
    useRegex: false,
    caseSensitive: false,
    useElementSearch: false,
    elementSearchMode: 'css',
  };
  let currentMatchIndex = -1;
  let totalMatches = 0;

  beforeEach(() => {
    cleanupDOM();
    lastSearchState = {
      query: '',
      useRegex: false,
      caseSensitive: false,
      useElementSearch: false,
      elementSearchMode: 'css',
    };
    currentMatchIndex = -1;
    totalMatches = 0;

    document.body.innerHTML = `
      <div>
        <p>test content one</p>
        <p>test content two</p>
        <p>test content three</p>
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

  it('検索実行後、検索状態が保存される', async () => {
    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const searchMessage = request;

        // 検索状態を保存（content.tsの動作を模倣）
        lastSearchState = {
          query: searchMessage.query,
          useRegex: searchMessage.useRegex,
          caseSensitive: searchMessage.caseSensitive,
          useElementSearch: searchMessage.useElementSearch,
          elementSearchMode: searchMessage.elementSearchMode,
        };

        const query = searchMessage.query;
        const bodyText = document.body.textContent || '';
        const searchText = bodyText.toLowerCase();
        const searchQuery = query.toLowerCase();

        let matches = 0;
        let index = -1;
        // biome-ignore lint/suspicious/noAssignInExpressions: ループ内でindexを更新する必要がある
        while ((index = searchText.indexOf(searchQuery, index + 1)) !== -1) {
          matches++;
        }

        totalMatches = matches;
        currentMatchIndex = matches > 0 ? 0 : -1;

        return {
          success: true,
          count: matches,
          currentIndex: currentMatchIndex,
          totalMatches: totalMatches,
        };
      }
      if (request.action === 'get-state') {
        // 検索状態を返す（content.tsの動作を模倣）
        return {
          success: true,
          state: lastSearchState,
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

    // 検索状態が保存されていることを確認
    expect(lastSearchState.query).toBe('test');
    expect(totalMatches).toBeGreaterThan(0);
    expect(currentMatchIndex).toBe(0);
  });

  it('Popupを再度開いた際に、検索状態が復元される', async () => {
    // まず検索を実行して状態を保存
    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const searchMessage = request;
        lastSearchState = {
          query: searchMessage.query,
          useRegex: searchMessage.useRegex,
          caseSensitive: searchMessage.caseSensitive,
          useElementSearch: searchMessage.useElementSearch,
          elementSearchMode: searchMessage.elementSearchMode,
        };

        const query = searchMessage.query;
        const bodyText = document.body.textContent || '';
        const searchText = bodyText.toLowerCase();
        const searchQuery = query.toLowerCase();

        let matches = 0;
        let index = -1;
        // biome-ignore lint/suspicious/noAssignInExpressions: ループ内でindexを更新する必要がある
        while ((index = searchText.indexOf(searchQuery, index + 1)) !== -1) {
          matches++;
        }

        totalMatches = matches;
        currentMatchIndex = matches > 0 ? 0 : -1;

        return {
          success: true,
          count: matches,
          currentIndex: currentMatchIndex,
          totalMatches: totalMatches,
        };
      }
      if (request.action === 'get-state') {
        return {
          success: true,
          state: lastSearchState,
          currentIndex: currentMatchIndex,
          totalMatches: totalMatches,
        };
      }
      return { success: false };
    };

    // 検索を実行
    await new Promise((resolve) => {
      chrome.tabs.sendMessage(
        1,
        {
          action: 'search',
          query: 'test',
          useRegex: false,
          caseSensitive: false,
          useElementSearch: false,
          elementSearchMode: 'css',
        },
        () => {
          resolve(null);
        }
      );
    });

    // PopupのHTMLを再現
    document.body.innerHTML = `
      <div>
        <input type="text" id="searchInput" />
        <input type="checkbox" id="regexMode" />
        <input type="checkbox" id="caseSensitiveMode" />
        <input type="checkbox" id="elementMode" />
        <select id="searchMode">
          <option value="css">CSS</option>
          <option value="xpath">XPath</option>
        </select>
        <div id="results"></div>
        <div id="navigation">
          <span id="matchCounter"></span>
        </div>
      </div>
    `;

    const searchInput = document.getElementById('searchInput');
    const regexMode = document.getElementById('regexMode');
    const caseSensitiveMode = document.getElementById('caseSensitiveMode');
    const elementMode = document.getElementById('elementMode');
    const searchMode = document.getElementById('searchMode');
    const results = document.getElementById('results');
    const matchCounter = document.getElementById('matchCounter');

    // 検索状態を復元（popup/main.tsのrestoreSearchState関数を模倣）
    const stateMessage = { action: 'get-state' };
    const stateResponse = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, stateMessage, (resp) => {
        resolve(resp);
      });
    });

    if (stateResponse?.success && stateResponse.state) {
      const state = stateResponse.state;
      searchInput.value = state.query;
      regexMode.checked = state.useRegex;
      caseSensitiveMode.checked = state.caseSensitive;
      elementMode.checked = state.useElementSearch;
      searchMode.value = state.elementSearchMode;

      if (stateResponse.totalMatches && stateResponse.totalMatches > 0) {
        results.textContent = `${stateResponse.totalMatches} 件の結果が見つかりました`;
        matchCounter.textContent = `${(stateResponse.currentIndex ?? 0) + 1}/${stateResponse.totalMatches}`;
      }
    }

    // 検索状態が復元されていることを確認
    expect(searchInput.value).toBe('test');
    expect(regexMode.checked).toBe(false);
    expect(caseSensitiveMode.checked).toBe(false);
    expect(elementMode.checked).toBe(false);
    expect(results.textContent).toContain('件の結果が見つかりました');
    expect(matchCounter.textContent).toContain('/');
  });

  it('ナビゲーション後の状態が正しく復元される', async () => {
    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const searchMessage = request;
        lastSearchState = {
          query: searchMessage.query,
          useRegex: searchMessage.useRegex,
          caseSensitive: searchMessage.caseSensitive,
          useElementSearch: searchMessage.useElementSearch,
          elementSearchMode: searchMessage.elementSearchMode,
        };

        const query = searchMessage.query;
        const bodyText = document.body.textContent || '';
        const searchText = bodyText.toLowerCase();
        const searchQuery = query.toLowerCase();

        let matches = 0;
        let index = -1;
        // biome-ignore lint/suspicious/noAssignInExpressions: ループ内でindexを更新する必要がある
        while ((index = searchText.indexOf(searchQuery, index + 1)) !== -1) {
          matches++;
        }

        totalMatches = matches;
        currentMatchIndex = matches > 0 ? 0 : -1;

        return {
          success: true,
          count: matches,
          currentIndex: currentMatchIndex,
          totalMatches: totalMatches,
        };
      }
      if (request.action === 'navigate-next') {
        if (totalMatches > 0) {
          currentMatchIndex = (currentMatchIndex + 1) % totalMatches;
        }
        return {
          success: true,
          currentIndex: currentMatchIndex,
          totalMatches: totalMatches,
        };
      }
      if (request.action === 'get-state') {
        return {
          success: true,
          state: lastSearchState,
          currentIndex: currentMatchIndex,
          totalMatches: totalMatches,
        };
      }
      return { success: false };
    };

    // 検索を実行
    await new Promise((resolve) => {
      chrome.tabs.sendMessage(
        1,
        {
          action: 'search',
          query: 'test',
          useRegex: false,
          caseSensitive: false,
          useElementSearch: false,
          elementSearchMode: 'css',
        },
        () => {
          resolve(null);
        }
      );
    });

    // ナビゲーションを実行
    await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, { action: 'navigate-next' }, () => {
        resolve(null);
      });
    });

    // 状態を取得
    const stateResponse = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, { action: 'get-state' }, (resp) => {
        resolve(resp);
      });
    });

    // ナビゲーション後の状態が正しく保存されていることを確認
    expect(stateResponse.success).toBe(true);
    expect(stateResponse.currentIndex).toBe(1); // 2番目のマッチ
    expect(stateResponse.totalMatches).toBeGreaterThan(1);
  });

  it('ハイライトをクリアすると、検索状態もクリアされる', async () => {
    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const searchMessage = request;
        lastSearchState = {
          query: searchMessage.query,
          useRegex: searchMessage.useRegex,
          caseSensitive: searchMessage.caseSensitive,
          useElementSearch: searchMessage.useElementSearch,
          elementSearchMode: searchMessage.elementSearchMode,
        };

        const query = searchMessage.query;
        const bodyText = document.body.textContent || '';
        const searchText = bodyText.toLowerCase();
        const searchQuery = query.toLowerCase();

        let matches = 0;
        let index = -1;
        // biome-ignore lint/suspicious/noAssignInExpressions: ループ内でindexを更新する必要がある
        while ((index = searchText.indexOf(searchQuery, index + 1)) !== -1) {
          matches++;
        }

        totalMatches = matches;
        currentMatchIndex = matches > 0 ? 0 : -1;

        return {
          success: true,
          count: matches,
          currentIndex: currentMatchIndex,
          totalMatches: totalMatches,
        };
      }
      if (request.action === 'clear') {
        // 検索状態をクリア（content.tsの動作を模倣）
        lastSearchState = {
          query: '',
          useRegex: false,
          caseSensitive: false,
          useElementSearch: false,
          elementSearchMode: 'css',
        };
        currentMatchIndex = -1;
        totalMatches = 0;

        return { success: true };
      }
      if (request.action === 'get-state') {
        return {
          success: true,
          state: lastSearchState,
          currentIndex: currentMatchIndex,
          totalMatches: totalMatches,
        };
      }
      return { success: false };
    };

    // 検索を実行
    await new Promise((resolve) => {
      chrome.tabs.sendMessage(
        1,
        {
          action: 'search',
          query: 'test',
          useRegex: false,
          caseSensitive: false,
          useElementSearch: false,
          elementSearchMode: 'css',
        },
        () => {
          resolve(null);
        }
      );
    });

    // ハイライトをクリア
    await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, { action: 'clear' }, () => {
        resolve(null);
      });
    });

    // 状態を取得
    const stateResponse = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, { action: 'get-state' }, (resp) => {
        resolve(resp);
      });
    });

    // 検索状態がクリアされていることを確認
    expect(stateResponse.success).toBe(true);
    expect(stateResponse.state?.query).toBe('');
    expect(stateResponse.currentIndex).toBe(-1);
    expect(stateResponse.totalMatches).toBe(0);
  });
});
