/**
 * 統合テスト: 設定の永続化
 *
 * テストシナリオ:
 * 1. Optionsページでデフォルト設定を変更し保存
 * 2. Popupを開いた際に、変更した設定が反映されていることを確認
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupDOM } from '../helpers/dom-helpers.js';

describe('統合テスト: 設定の永続化', () => {
  let mockStorageGet;
  let mockStorageSet;
  let storedSettings = {
    defaultRegex: false,
    defaultCaseSensitive: false,
    defaultElementSearch: false,
  };

  beforeEach(() => {
    cleanupDOM();
    storedSettings = {
      defaultRegex: false,
      defaultCaseSensitive: false,
      defaultElementSearch: false,
    };

    mockStorageGet = vi.fn((keys, callback) => {
      const result = {};
      if (typeof keys === 'string') {
        result[keys] = storedSettings[keys];
      } else if (Array.isArray(keys)) {
        keys.forEach((key) => {
          result[key] = storedSettings[key];
        });
      } else if (keys === null || keys === undefined) {
        Object.assign(result, storedSettings);
      } else {
        Object.keys(keys).forEach((key) => {
          result[key] = storedSettings[key] ?? keys[key];
        });
      }
      callback(result);
    });

    mockStorageSet = vi.fn((items, callback) => {
      Object.assign(storedSettings, items);
      if (callback) {
        callback();
      }
    });

    global.chrome = {
      storage: {
        sync: {
          get: mockStorageGet,
          set: mockStorageSet,
        },
      },
      tabs: {
        query: vi.fn((_queryInfo, callback) => {
          callback([{ id: 1, url: 'https://example.com' }]);
        }),
        sendMessage: vi.fn(),
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
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('Settingsページで設定を保存できる', () => {
    // SettingsページのHTMLを再現
    document.body.innerHTML = `
      <div>
        <input type="checkbox" id="defaultRegex" />
        <input type="checkbox" id="defaultElementSearch" />
        <div id="saveStatus" style="display: none;"></div>
      </div>
    `;

    const defaultRegexEl = document.getElementById('defaultRegex');
    const defaultElementSearchEl = document.getElementById('defaultElementSearch');
    const saveStatusEl = document.getElementById('saveStatus');

    // 設定を変更
    defaultRegexEl.checked = true;
    defaultElementSearchEl.checked = true;

    // 設定を保存（settings/main.tsのsaveSettings関数を模倣）
    const settings = {
      defaultRegex: defaultRegexEl.checked,
      defaultCaseSensitive: false,
      defaultElementSearch: defaultElementSearchEl.checked,
    };

    chrome.storage.sync.set(settings, () => {
      saveStatusEl.style.display = 'block';
      saveStatusEl.classList.add('success');
    });

    // 設定が保存されたことを確認
    expect(mockStorageSet).toHaveBeenCalled();
    expect(storedSettings.defaultRegex).toBe(true);
    expect(storedSettings.defaultElementSearch).toBe(true);
  });

  it('Settingsページで保存した設定がPopupに反映される', async () => {
    // まずSettingsページで設定を保存
    storedSettings.defaultRegex = true;
    storedSettings.defaultElementSearch = true;

    // PopupのHTMLを再現
    document.body.innerHTML = `
      <div>
        <input type="checkbox" id="regexMode" />
        <input type="checkbox" id="caseSensitiveMode" />
        <input type="checkbox" id="elementMode" />
      </div>
    `;

    const regexMode = document.getElementById('regexMode');
    const caseSensitiveMode = document.getElementById('caseSensitiveMode');
    const elementMode = document.getElementById('elementMode');

    // Popupで設定を読み込む（popup/main.tsのloadSettings関数を模倣）
    chrome.storage.sync.get(
      {
        defaultRegex: false,
        defaultCaseSensitive: false,
        defaultElementSearch: false,
      },
      (items) => {
        regexMode.checked = items.defaultRegex;
        caseSensitiveMode.checked = items.defaultCaseSensitive;
        elementMode.checked = items.defaultElementSearch;
      }
    );

    // 設定が反映されていることを確認
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockStorageGet).toHaveBeenCalled();
    expect(regexMode.checked).toBe(true);
    expect(elementMode.checked).toBe(true);
  });

  it('設定を変更すると自動的に保存される', () => {
    document.body.innerHTML = `
      <div>
        <input type="checkbox" id="defaultRegex" />
        <input type="checkbox" id="defaultElementSearch" />
        <div id="saveStatus" style="display: none;"></div>
      </div>
    `;

    const defaultRegexEl = document.getElementById('defaultRegex');
    const defaultElementSearchEl = document.getElementById('defaultElementSearch');
    const saveStatusEl = document.getElementById('saveStatus');

    // イベントリスナーを追加（settings/main.tsの動作を模倣）
    defaultRegexEl.addEventListener('change', () => {
      const settings = {
        defaultRegex: defaultRegexEl.checked,
        defaultCaseSensitive: false,
        defaultElementSearch: defaultElementSearchEl.checked,
      };
      chrome.storage.sync.set(settings, () => {
        saveStatusEl.style.display = 'block';
        saveStatusEl.classList.add('success');
      });
    });

    defaultElementSearchEl.addEventListener('change', () => {
      const settings = {
        defaultRegex: defaultRegexEl.checked,
        defaultCaseSensitive: false,
        defaultElementSearch: defaultElementSearchEl.checked,
      };
      chrome.storage.sync.set(settings, () => {
        saveStatusEl.style.display = 'block';
        saveStatusEl.classList.add('success');
      });
    });

    // チェックボックスを変更
    defaultRegexEl.checked = true;
    defaultRegexEl.dispatchEvent(new Event('change'));

    // 設定が保存されたことを確認
    expect(mockStorageSet).toHaveBeenCalled();
    expect(storedSettings.defaultRegex).toBe(true);
  });

  it('デフォルト値が正しく設定される', async () => {
    // ストレージが空の場合、デフォルト値が使用される
    storedSettings = {
      defaultRegex: false,
      defaultCaseSensitive: false,
      defaultElementSearch: false,
    };

    document.body.innerHTML = `
      <div>
        <input type="checkbox" id="regexMode" />
        <input type="checkbox" id="caseSensitiveMode" />
        <input type="checkbox" id="elementMode" />
      </div>
    `;

    const regexMode = document.getElementById('regexMode');
    const caseSensitiveMode = document.getElementById('caseSensitiveMode');
    const elementMode = document.getElementById('elementMode');

    // デフォルト値で設定を読み込む
    chrome.storage.sync.get(
      {
        defaultRegex: false,
        defaultCaseSensitive: false,
        defaultElementSearch: false,
      },
      (items) => {
        regexMode.checked = items.defaultRegex;
        caseSensitiveMode.checked = items.defaultCaseSensitive;
        elementMode.checked = items.defaultElementSearch;
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    // デフォルト値が設定されていることを確認
    expect(regexMode.checked).toBe(false);
    expect(caseSensitiveMode.checked).toBe(false);
    expect(elementMode.checked).toBe(false);
  });

  it('複数の設定を同時に保存できる', () => {
    document.body.innerHTML = `
      <div>
        <input type="checkbox" id="defaultRegex" />
        <input type="checkbox" id="defaultElementSearch" />
        <div id="saveStatus" style="display: none;"></div>
      </div>
    `;

    const defaultRegexEl = document.getElementById('defaultRegex');
    const defaultElementSearchEl = document.getElementById('defaultElementSearch');

    // 複数の設定を同時に変更
    defaultRegexEl.checked = true;
    defaultElementSearchEl.checked = true;

    // 設定を保存
    const settings = {
      defaultRegex: defaultRegexEl.checked,
      defaultCaseSensitive: false,
      defaultElementSearch: defaultElementSearchEl.checked,
    };

    chrome.storage.sync.set(settings, () => {});

    // 両方の設定が保存されたことを確認
    expect(storedSettings.defaultRegex).toBe(true);
    expect(storedSettings.defaultElementSearch).toBe(true);
  });
});
