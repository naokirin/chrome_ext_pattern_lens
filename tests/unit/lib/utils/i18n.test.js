import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMessage, initializeI18n } from '~/lib/utils/i18n';

describe('i18n', () => {
  let originalChromeI18n;

  beforeEach(() => {
    // chrome.i18n.getMessage をモック
    originalChromeI18n = global.chrome?.i18n;
    global.chrome = {
      i18n: {
        getMessage: vi.fn((key, substitutions) => {
          // テスト用のメッセージを返す
          if (key === 'test.key') {
            return 'Test Message';
          }
          if (key === 'test.with.placeholder') {
            if (substitutions && Array.isArray(substitutions) && substitutions.length > 0) {
              return `Test with ${substitutions[0]}`;
            }
            if (typeof substitutions === 'string') {
              return `Test with ${substitutions}`;
            }
            return 'Test with placeholder';
          }
          return '';
        }),
      },
    };
  });

  afterEach(() => {
    // モックを復元
    if (originalChromeI18n) {
      global.chrome.i18n = originalChromeI18n;
    } else {
      global.chrome = undefined;
    }
    document.body.innerHTML = '';
  });

  describe('getMessage', () => {
    it('メッセージキーからローカライズされたメッセージを取得できる', () => {
      const message = getMessage('test.key');

      expect(message).toBe('Test Message');
      expect(global.chrome.i18n.getMessage).toHaveBeenCalledWith('test.key', undefined);
    });

    it('プレースホルダー付きメッセージを取得できる（文字列）', () => {
      const message = getMessage('test.with.placeholder', 'value');

      expect(message).toBe('Test with value');
      expect(global.chrome.i18n.getMessage).toHaveBeenCalledWith('test.with.placeholder', 'value');
    });

    it('プレースホルダー付きメッセージを取得できる（配列）', () => {
      const message = getMessage('test.with.placeholder', ['value1', 'value2']);

      expect(message).toBe('Test with value1');
      expect(global.chrome.i18n.getMessage).toHaveBeenCalledWith('test.with.placeholder', [
        'value1',
        'value2',
      ]);
    });

    it('存在しないキーの場合、空文字列を返す', () => {
      const message = getMessage('nonexistent.key');

      expect(message).toBe('');
      expect(global.chrome.i18n.getMessage).toHaveBeenCalledWith('nonexistent.key', undefined);
    });
  });

  describe('initializeI18n', () => {
    it('data-i18n属性を持つ要素のテキストを置換する', () => {
      document.body.innerHTML = '<div data-i18n="test.key">Original Text</div>';

      initializeI18n();

      expect(document.body.firstChild.textContent).toBe('Test Message');
      expect(global.chrome.i18n.getMessage).toHaveBeenCalledWith('test.key');
    });

    it('data-i18n-placeholder属性を持つ要素のplaceholderを置換する', () => {
      document.body.innerHTML = '<input data-i18n-placeholder="test.key" placeholder="Original">';

      initializeI18n();

      const input = document.body.firstChild;
      expect(input.getAttribute('placeholder')).toBe('Test Message');
      expect(global.chrome.i18n.getMessage).toHaveBeenCalledWith('test.key');
    });

    it('data-i18n-title属性を持つ要素のtitleを置換する', () => {
      document.body.innerHTML = '<div data-i18n-title="test.key" title="Original">Text</div>';

      initializeI18n();

      const div = document.body.firstChild;
      expect(div.getAttribute('title')).toBe('Test Message');
      expect(global.chrome.i18n.getMessage).toHaveBeenCalledWith('test.key');
    });

    it('複数のdata-i18n属性を持つ要素を処理する', () => {
      document.body.innerHTML = `
        <div data-i18n="test.key">Text1</div>
        <div data-i18n="test.key">Text2</div>
        <span data-i18n="test.key">Text3</span>
      `;

      initializeI18n();

      const elements = document.querySelectorAll('[data-i18n]');
      elements.forEach((element) => {
        expect(element.textContent).toBe('Test Message');
      });
      expect(global.chrome.i18n.getMessage).toHaveBeenCalledTimes(3);
    });

    it('data-i18n属性がない要素は変更しない', () => {
      document.body.innerHTML = '<div>Original Text</div>';

      initializeI18n();

      expect(document.body.firstChild.textContent).toBe('Original Text');
    });

    it('data-i18n属性が空の場合は処理しない', () => {
      document.body.innerHTML = '<div data-i18n="">Original Text</div>';

      initializeI18n();

      expect(document.body.firstChild.textContent).toBe('Original Text');
    });

    it('メッセージが取得できない場合、テキストを変更しない', () => {
      document.body.innerHTML = '<div data-i18n="nonexistent.key">Original Text</div>';

      initializeI18n();

      expect(document.body.firstChild.textContent).toBe('Original Text');
    });

    it('data-i18n、data-i18n-placeholder、data-i18n-titleを同時に処理する', () => {
      document.body.innerHTML = `
        <div data-i18n="test.key">Text</div>
        <input data-i18n-placeholder="test.key">
        <div data-i18n-title="test.key">Text</div>
      `;

      initializeI18n();

      expect(document.querySelector('[data-i18n]').textContent).toBe('Test Message');
      expect(document.querySelector('[data-i18n-placeholder]').getAttribute('placeholder')).toBe(
        'Test Message'
      );
      expect(document.querySelector('[data-i18n-title]').getAttribute('title')).toBe(
        'Test Message'
      );
    });
  });
});
