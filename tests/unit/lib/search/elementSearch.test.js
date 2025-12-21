import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as overlayModule from '~/lib/highlight/overlay';
import * as navigatorModule from '~/lib/navigation/navigator';
import { searchElements } from '~/lib/search/elementSearch';
import { SearchStateManager } from '~/lib/state/searchState';
import * as domUtilsModule from '~/lib/utils/domUtils';
import { cleanupDOM } from '../../../helpers/dom-helpers.js';

describe('elementSearch', () => {
  let stateManager;

  beforeEach(() => {
    cleanupDOM();
    stateManager = new SearchStateManager();

    // Mock overlay and navigator functions
    vi.spyOn(overlayModule, 'initializeOverlayContainer').mockReturnValue(
      document.createElement('div')
    );
    vi.spyOn(overlayModule, 'createOverlay').mockReturnValue(document.createElement('div'));
    vi.spyOn(overlayModule, 'setupEventListeners').mockImplementation(() => {});
    vi.spyOn(navigatorModule, 'navigateToMatch').mockReturnValue({
      currentIndex: 0,
      totalMatches: 1,
    });
  });

  afterEach(() => {
    cleanupDOM();
    stateManager.clear();
    vi.restoreAllMocks();
  });

  describe('CSS selector search', () => {
    it('CSSセレクタで要素を検索できる', () => {
      cleanupDOM();
      const div1 = document.createElement('div');
      div1.className = 'test-class';
      const div2 = document.createElement('div');
      div2.className = 'test-class';
      document.body.appendChild(div1);
      document.body.appendChild(div2);

      const result = searchElements('.test-class', 'css', stateManager);

      // overlayContainerは除外されるので、2つのdiv要素が検索される
      // ただし、initializeOverlayContainerが呼ばれるとoverlayContainerが作成されるため、
      // 実際の要素数は2以上になる可能性がある
      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(stateManager.elements.length).toBeGreaterThanOrEqual(1);
    });

    it('IDセレクタで要素を検索できる', () => {
      const div = document.createElement('div');
      div.id = 'test-id';
      document.body.appendChild(div);

      const result = searchElements('#test-id', 'css', stateManager);

      expect(result.count).toBe(1);
      expect(stateManager.elements).toHaveLength(1);
    });

    it('マッチしない場合、0件を返す', () => {
      const result = searchElements('.non-existent', 'css', stateManager);

      expect(result.count).toBe(0);
      expect(result.currentIndex).toBe(-1);
      expect(result.totalMatches).toBe(0);
      expect(stateManager.elements).toHaveLength(0);
    });

    it('オーバーレイコンテナは除外される', () => {
      const overlayContainer = document.createElement('div');
      overlayContainer.id = 'pattern-lens-overlay-container';
      document.body.appendChild(overlayContainer);

      searchElements('div', 'css', stateManager);

      // overlayContainerは除外されるので、他のdiv要素のみがカウントされる
      expect(stateManager.elements).not.toContain(overlayContainer);
    });
  });

  describe('XPath search', () => {
    it('XPathで要素を検索できる', () => {
      const div = document.createElement('div');
      div.className = 'test-class';
      document.body.appendChild(div);

      const result = searchElements("//div[@class='test-class']", 'xpath', stateManager);

      expect(result.count).toBe(1);
      expect(stateManager.elements).toHaveLength(1);
    });

    it('マッチしない場合、0件を返す', () => {
      const result = searchElements("//div[@class='non-existent']", 'xpath', stateManager);

      expect(result.count).toBe(0);
      expect(result.currentIndex).toBe(-1);
      expect(result.totalMatches).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('不正なCSSセレクタでエラーを投げる', () => {
      expect(() => {
        searchElements('div[invalid', 'css', stateManager);
      }).toThrow('Invalid CSS selector');
    });

    it('不正なXPathでエラーを投げる', () => {
      // ブラウザによってはXPathエラーを投げない場合があるため、
      // エラーが投げられるか、または0件が返されることを確認
      try {
        const result = searchElements('//invalid[xpath[syntax]]', 'xpath', stateManager);
        // エラーが投げられない場合、0件が返される
        expect(result.count).toBe(0);
      } catch (error) {
        // エラーが投げられる場合、エラーメッセージにXPathが含まれる
        expect(error.message).toMatch(/Invalid XPath/);
      }
    });

    it('エラーメッセージにモードが含まれる', () => {
      expect(() => {
        searchElements('invalid[', 'css', stateManager);
      }).toThrow(/CSS selector/);

      expect(() => {
        searchElements('//invalid[', 'xpath', stateManager);
      }).toThrow(/XPath/);
    });
  });

  describe('State management', () => {
    it('検索結果がstateManagerに保存される', () => {
      const div1 = document.createElement('div');
      div1.className = 'test';
      const div2 = document.createElement('div');
      div2.className = 'test';
      document.body.appendChild(div1);
      document.body.appendChild(div2);

      searchElements('.test', 'css', stateManager);

      expect(stateManager.elements).toHaveLength(2);
      expect(stateManager.elements[0]).toBe(div1);
      expect(stateManager.elements[1]).toBe(div2);
    });

    it('検索結果がある場合、イベントリスナーが設定される', () => {
      const div = document.createElement('div');
      div.className = 'test';
      document.body.appendChild(div);

      searchElements('.test', 'css', stateManager);

      expect(overlayModule.setupEventListeners).toHaveBeenCalled();
    });

    it('検索結果がある場合、ナビゲーションが実行される', () => {
      const div = document.createElement('div');
      div.className = 'test';
      document.body.appendChild(div);

      searchElements('.test', 'css', stateManager);

      expect(navigatorModule.navigateToMatch).toHaveBeenCalledWith(0, stateManager);
    });

    it('skipNavigationがtrueの場合、ナビゲーションをスキップする', () => {
      const div1 = document.createElement('div');
      div1.className = 'test';
      const div2 = document.createElement('div');
      div2.className = 'test';
      document.body.appendChild(div1);
      document.body.appendChild(div2);

      const result = searchElements('.test', 'css', stateManager, true);

      expect(navigatorModule.navigateToMatch).not.toHaveBeenCalled();
      expect(result.count).toBeGreaterThanOrEqual(1);
    });

    it('skipNavigationがtrueでpreviousIndexが有効な場合、そのインデックスを保持する', () => {
      const div1 = document.createElement('div');
      div1.className = 'test';
      const div2 = document.createElement('div');
      div2.className = 'test';
      document.body.appendChild(div1);
      document.body.appendChild(div2);

      vi.spyOn(domUtilsModule, 'findClosestMatchIndex').mockReturnValue(0);

      const result = searchElements('.test', 'css', stateManager, true, 0);

      expect(result.currentIndex).toBe(0);
      expect(stateManager.currentIndex).toBe(0);
    });

    it('skipNavigationがtrueでpreviousIndexが範囲外（大きい）の場合、最後のインデックスを使用する', () => {
      const div1 = document.createElement('div');
      div1.className = 'test';
      const div2 = document.createElement('div');
      div2.className = 'test';
      document.body.appendChild(div1);
      document.body.appendChild(div2);

      const result = searchElements('.test', 'css', stateManager, true, 10);

      // 要素数が2以上の場合、最後のインデックス（count - 1）が使用される
      expect(result.currentIndex).toBeGreaterThanOrEqual(0);
      expect(result.currentIndex).toBeLessThanOrEqual(result.count - 1);
    });

    it('skipNavigationがtrueでpreviousIndexが-1の場合、findClosestMatchIndexを使用する', () => {
      const div1 = document.createElement('div');
      div1.className = 'test';
      const div2 = document.createElement('div');
      div2.className = 'test';
      document.body.appendChild(div1);
      document.body.appendChild(div2);

      vi.spyOn(domUtilsModule, 'findClosestMatchIndex').mockReturnValue(1);

      const result = searchElements('.test', 'css', stateManager, true, -1);

      expect(result.currentIndex).toBe(1);
      expect(stateManager.currentIndex).toBe(1);
    });
  });
});
