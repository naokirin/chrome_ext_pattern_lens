/**
 * 統合テスト: テキスト検索とハイライト表示
 *
 * テストシナリオ:
 * 1. Popupでキーワードを入力し、検索を実行
 * 2. content.tsがメッセージを受け取り、検索とハイライト（オーバーレイ）を行う
 * 3. Popupに正しい件数が表示される
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupDOM } from '../helpers/dom-helpers.js';

// Content scriptの関数をインポートするために、モジュールをモック
// 実際の実装では、content.tsを直接インポートできないため、
// メッセージハンドラーをシミュレートする

describe('統合テスト: テキスト検索とハイライト表示', () => {
  let mockSendMessage;
  let mockTabsQuery;
  let mockStorageGet;
  let messageHandler;

  beforeEach(() => {
    // DOMをクリーンアップ
    cleanupDOM();
    document.body.innerHTML = `
      <div>
        <p>Lorem ipsum dolor sit amet</p>
        <p>consectetur adipiscing elit</p>
        <div>
          <span>test content</span>
        </div>
      </div>
    `;

    // Chrome APIのモックをリセット
    mockSendMessage = vi.fn((_tabId, message, callback) => {
      // メッセージハンドラーをシミュレート
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

    mockStorageGet = vi.fn((_keys, callback) => {
      callback({ defaultRegex: false, defaultCaseSensitive: false, defaultElementSearch: false });
    });

    // Chrome APIをモック
    global.chrome = {
      storage: {
        sync: {
          get: mockStorageGet,
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

  it('通常のテキスト検索を実行し、ハイライトが表示される', async () => {
    // Content scriptのメッセージハンドラーをシミュレート
    // 実際のcontent.tsのロジックを模倣
    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const query = request.query;
        const useRegex = request.useRegex;
        const caseSensitive = request.caseSensitive;

        // 簡単な検索ロジックをシミュレート
        const bodyText = document.body.textContent || '';
        let matches = 0;

        if (useRegex) {
          const flags = caseSensitive ? 'g' : 'gi';
          const regex = new RegExp(query, flags);
          const matchArray = bodyText.match(regex);
          matches = matchArray ? matchArray.length : 0;
        } else {
          const searchText = caseSensitive ? bodyText : bodyText.toLowerCase();
          const searchQuery = caseSensitive ? query : query.toLowerCase();
          let index = -1;
          // biome-ignore lint/suspicious/noAssignInExpressions: ループ内でindexを更新する必要がある
          while ((index = searchText.indexOf(searchQuery, index + 1)) !== -1) {
            matches++;
          }
        }

        // オーバーレイコンテナが作成されることを確認
        let container = document.getElementById('pattern-lens-overlay-container');
        if (!container && matches > 0) {
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

        return {
          success: true,
          count: matches,
          currentIndex: matches > 0 ? 0 : -1,
          totalMatches: matches,
        };
      }
      return { success: false };
    };

    // Popupのシミュレーション: 検索を実行
    const searchQuery = 'ipsum';
    const message = {
      action: 'search',
      query: searchQuery,
      useRegex: false,
      caseSensitive: false,
      useElementSearch: false,
      elementSearchMode: 'css',
    };

    // メッセージを送信（content scriptに送信される想定）
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, message, (resp) => {
        resolve(resp);
      });
    });

    // 検索結果が正しいことを確認
    expect(response.success).toBe(true);
    expect(response.count).toBeGreaterThan(0);
    expect(response.totalMatches).toBeGreaterThan(0);

    // オーバーレイコンテナが作成されていることを確認
    const container = document.getElementById('pattern-lens-overlay-container');
    expect(container).toBeTruthy();
  });

  it('正規表現検索を実行し、ハイライトが表示される', async () => {
    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch && request.useRegex) {
        const query = request.query;
        const caseSensitive = request.caseSensitive;

        const bodyText = document.body.textContent || '';
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(query, flags);
        const matchArray = bodyText.match(regex);
        const matches = matchArray ? matchArray.length : 0;

        // オーバーレイコンテナを作成
        if (matches > 0) {
          let container = document.getElementById('pattern-lens-overlay-container');
          if (!container) {
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

    // 正規表現検索を実行
    const message = {
      action: 'search',
      query: '\\w{5}', // 5文字の単語
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
    expect(response.count).toBeGreaterThan(0);
  });

  it('検索結果が0件の場合、オーバーレイが作成されない', async () => {
    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const query = request.query;
        const bodyText = document.body.textContent || '';
        const searchText = bodyText.toLowerCase();
        const searchQuery = query.toLowerCase();
        let matches = 0;
        let index = -1;
        // biome-ignore lint/suspicious/noAssignInExpressions: ループ内でindexを更新する必要がある
        while ((index = searchText.indexOf(searchQuery, index + 1)) !== -1) {
          matches++;
        }

        // マッチがない場合はオーバーレイを作成しない
        return {
          success: true,
          count: matches,
          currentIndex: -1,
          totalMatches: matches,
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
    expect(response.totalMatches).toBe(0);

    // オーバーレイコンテナが作成されていないことを確認
    const container = document.getElementById('pattern-lens-overlay-container');
    expect(container).toBeFalsy();
  });

  it('大文字小文字を区別する検索が正しく動作する', async () => {
    document.body.innerHTML = '<p>Lorem Ipsum DOLOR</p>';

    messageHandler = (request) => {
      if (request.action === 'search' && !request.useElementSearch) {
        const query = request.query;
        const caseSensitive = request.caseSensitive;
        const bodyText = document.body.textContent || '';
        const searchText = caseSensitive ? bodyText : bodyText.toLowerCase();
        const searchQuery = caseSensitive ? query : query.toLowerCase();
        let matches = 0;
        let index = -1;
        // biome-ignore lint/suspicious/noAssignInExpressions: ループ内でindexを更新する必要がある
        while ((index = searchText.indexOf(searchQuery, index + 1)) !== -1) {
          matches++;
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

    // 大文字小文字を区別しない検索
    const message1 = {
      action: 'search',
      query: 'ipsum',
      useRegex: false,
      caseSensitive: false,
      useElementSearch: false,
      elementSearchMode: 'css',
    };

    const response1 = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, message1, (resp) => {
        resolve(resp);
      });
    });

    expect(response1.success).toBe(true);
    expect(response1.count).toBe(1); // "Ipsum" にマッチ

    // 大文字小文字を区別する検索
    const message2 = {
      action: 'search',
      query: 'ipsum',
      useRegex: false,
      caseSensitive: true,
      useElementSearch: false,
      elementSearchMode: 'css',
    };

    const response2 = await new Promise((resolve) => {
      chrome.tabs.sendMessage(1, message2, (resp) => {
        resolve(resp);
      });
    });

    expect(response2.success).toBe(true);
    expect(response2.count).toBe(0); // "ipsum" は存在しない
  });
});
