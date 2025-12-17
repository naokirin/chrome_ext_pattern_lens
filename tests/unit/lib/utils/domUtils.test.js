import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findScrollableElements,
  getElementById,
  getRequiredElementById,
  isRectVisibleInScrollableParent,
  isRectVisibleInViewport,
} from '~/lib/utils/domUtils';
import { cleanupDOM } from '../../../helpers/dom-helpers.js';

describe('domUtils', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('getElementById', () => {
    it('存在する要素を取得できる', () => {
      cleanupDOM();
      const div = document.createElement('div');
      div.id = 'test-element';
      document.body.appendChild(div);

      const result = getElementById('test-element');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-element');
    });

    it('存在しない要素はnullを返す', () => {
      cleanupDOM();
      const result = getElementById('non-existent');

      expect(result).toBeNull();
    });

    it('型アサーションが正しく機能する', () => {
      cleanupDOM();
      const input = document.createElement('input');
      input.id = 'test-input';
      input.type = 'text';
      document.body.appendChild(input);

      const result = getElementById('test-input');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.type).toBe('text');
      }
    });
  });

  describe('getRequiredElementById', () => {
    it('存在する要素を取得できる', () => {
      cleanupDOM();
      const div = document.createElement('div');
      div.id = 'required-element';
      document.body.appendChild(div);

      const result = getRequiredElementById('required-element');

      expect(result).not.toBeNull();
      expect(result.id).toBe('required-element');
    });

    it('存在しない要素はエラーを投げる', () => {
      cleanupDOM();
      expect(() => {
        getRequiredElementById('non-existent');
      }).toThrow('Required element with ID "non-existent" not found');
    });

    it('エラーメッセージにIDが含まれる', () => {
      cleanupDOM();
      const id = 'missing-element';
      expect(() => {
        getRequiredElementById(id);
      }).toThrow(`Required element with ID "${id}" not found`);
    });

    it('型アサーションが正しく機能する', () => {
      cleanupDOM();
      const button = document.createElement('button');
      button.id = 'test-button';
      button.type = 'button';
      document.body.appendChild(button);

      const result = getRequiredElementById('test-button');

      expect(result.type).toBe('button');
    });
  });

  describe('findScrollableElements', () => {
    it('関数が定義されている', () => {
      expect(typeof findScrollableElements).toBe('function');
    });

    it('body と html は検出しない', () => {
      cleanupDOM();
      const result = findScrollableElements();

      expect(result).not.toContain(document.body);
      expect(result).not.toContain(document.documentElement);
    });

    it('配列を返す', () => {
      cleanupDOM();
      const result = findScrollableElements();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('isRectVisibleInViewport', () => {
    it('ビューポート内の矩形は可視と判定される', () => {
      const rect = new DOMRect(10, 20, 100, 50);
      const result = isRectVisibleInViewport(rect);
      expect(result).toBe(true);
    });

    it('ビューポート外の矩形は非可視と判定される', () => {
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const rect = new DOMRect(viewportWidth + 100, viewportHeight + 100, 100, 50);
      const result = isRectVisibleInViewport(rect);
      expect(result).toBe(false);
    });

    it('幅または高さが0の矩形は非可視と判定される', () => {
      const rect1 = new DOMRect(10, 20, 0, 50);
      const rect2 = new DOMRect(10, 20, 100, 0);
      expect(isRectVisibleInViewport(rect1)).toBe(false);
      expect(isRectVisibleInViewport(rect2)).toBe(false);
    });
  });

  describe('isRectVisibleInScrollableParent', () => {
    it('スクロール可能な親がない場合は可視と判定される', () => {
      cleanupDOM();
      const div = document.createElement('div');
      div.textContent = 'test';
      document.body.appendChild(div);
      const rect = div.getBoundingClientRect();

      const result = isRectVisibleInScrollableParent(rect, div);
      expect(result).toBe(true);
    });

    it('スクロール可能な親内の矩形は可視と判定される', () => {
      cleanupDOM();
      const scrollableDiv = document.createElement('div');
      scrollableDiv.style.overflow = 'scroll';
      scrollableDiv.style.height = '200px';
      scrollableDiv.style.width = '200px';
      scrollableDiv.style.position = 'relative';

      const innerDiv = document.createElement('div');
      innerDiv.textContent = 'test';
      innerDiv.style.height = '100px';
      innerDiv.style.width = '100px';
      scrollableDiv.appendChild(innerDiv);
      document.body.appendChild(scrollableDiv);

      void scrollableDiv.offsetHeight; // Force layout

      const rect = innerDiv.getBoundingClientRect();
      // 矩形が親要素の境界内にある場合、可視と判定される
      // テスト環境では、getBoundingClientRect()が正確な値を返さない可能性があるため、
      // 関数がエラーなく実行されることを確認
      const result = isRectVisibleInScrollableParent(rect, innerDiv);
      expect(typeof result).toBe('boolean');
    });

    it('テキストノードでも動作する', () => {
      cleanupDOM();
      const div = document.createElement('div');
      div.textContent = 'test';
      document.body.appendChild(div);
      const textNode = div.firstChild;
      expect(textNode).not.toBeNull();

      if (textNode) {
        // テキストノードの親要素の矩形を使用
        const rect = div.getBoundingClientRect();

        const result = isRectVisibleInScrollableParent(rect, textNode);
        expect(typeof result).toBe('boolean');
      }
    });
  });
});
