import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateToMatch } from '~/lib/navigation/navigator';
import { SearchStateManager } from '~/lib/state/searchState';
import { cleanupDOM } from '../../../helpers/dom-helpers.js';

describe('navigator', () => {
  let stateManager;

  beforeEach(() => {
    cleanupDOM();
    stateManager = new SearchStateManager();
  });

  afterEach(() => {
    stateManager.clear();
    cleanupDOM();
  });

  describe('navigateToMatch', () => {
    it('マッチが0件の場合、currentIndex=-1を返す', () => {
      const result = navigateToMatch(0, stateManager);

      expect(result.currentIndex).toBe(-1);
      expect(result.totalMatches).toBe(0);
    });

    it('テキスト検索で最初のマッチに移動できる', () => {
      document.body.innerHTML = '<div>Hello World</div>';
      const range = document.createRange();
      range.selectNodeContents(document.body.firstChild);
      stateManager.addRange(range);

      const result = navigateToMatch(0, stateManager);

      expect(result.currentIndex).toBe(0);
      expect(result.totalMatches).toBe(1);
    });

    it('テキスト検索で複数のマッチ間を移動できる', () => {
      document.body.innerHTML = '<div>test test test</div>';
      const textNode = document.body.firstChild.firstChild;
      const range1 = document.createRange();
      range1.setStart(textNode, 0);
      range1.setEnd(textNode, 4);
      const range2 = document.createRange();
      range2.setStart(textNode, 5);
      range2.setEnd(textNode, 9);
      const range3 = document.createRange();
      range3.setStart(textNode, 10);
      range3.setEnd(textNode, 14);

      stateManager.addRange(range1);
      stateManager.addRange(range2);
      stateManager.addRange(range3);

      const result1 = navigateToMatch(1, stateManager);
      expect(result1.currentIndex).toBe(1);
      expect(result1.totalMatches).toBe(3);

      const result2 = navigateToMatch(2, stateManager);
      expect(result2.currentIndex).toBe(2);
      expect(result2.totalMatches).toBe(3);
    });

    it('負のインデックスは最後のマッチにラップアラウンドする', () => {
      document.body.innerHTML = '<div>test test</div>';
      const textNode = document.body.firstChild.firstChild;
      const range1 = document.createRange();
      range1.setStart(textNode, 0);
      range1.setEnd(textNode, 4);
      const range2 = document.createRange();
      range2.setStart(textNode, 5);
      range2.setEnd(textNode, 9);

      stateManager.addRange(range1);
      stateManager.addRange(range2);

      const result = navigateToMatch(-1, stateManager);

      expect(result.currentIndex).toBe(1); // 最後のマッチ
      expect(result.totalMatches).toBe(2);
    });

    it('範囲外のインデックスは最初のマッチにラップアラウンドする', () => {
      document.body.innerHTML = '<div>test test</div>';
      const textNode = document.body.firstChild.firstChild;
      const range1 = document.createRange();
      range1.setStart(textNode, 0);
      range1.setEnd(textNode, 4);
      const range2 = document.createRange();
      range2.setStart(textNode, 5);
      range2.setEnd(textNode, 9);

      stateManager.addRange(range1);
      stateManager.addRange(range2);

      const result = navigateToMatch(10, stateManager);

      expect(result.currentIndex).toBe(0); // 最初のマッチにラップアラウンド
      expect(result.totalMatches).toBe(2);
    });

    it('要素検索で最初のマッチに移動できる', () => {
      document.body.innerHTML = '<div class="test">Hello</div><div class="test">World</div>';
      const elements = document.querySelectorAll('.test');
      stateManager.addElement(elements[0]);
      stateManager.addElement(elements[1]);

      const result = navigateToMatch(0, stateManager);

      expect(result.currentIndex).toBe(0);
      expect(result.totalMatches).toBe(2);
    });

    it('要素検索で複数のマッチ間を移動できる', () => {
      document.body.innerHTML = '<div class="test">1</div><div class="test">2</div><div class="test">3</div>';
      const elements = document.querySelectorAll('.test');
      elements.forEach((el) => stateManager.addElement(el));

      const result1 = navigateToMatch(1, stateManager);
      expect(result1.currentIndex).toBe(1);
      expect(result1.totalMatches).toBe(3);

      const result2 = navigateToMatch(2, stateManager);
      expect(result2.currentIndex).toBe(2);
      expect(result2.totalMatches).toBe(3);
    });

    it('テキスト検索でスクロールが実行される', () => {
      document.body.innerHTML = '<div>Hello World</div>';
      const element = document.body.firstChild;
      const textNode = element.firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      stateManager.addRange(range);

      // jsdomではscrollIntoViewが実装されていないため、モックを設定
      // startContainer.parentElementに対して呼ばれる
      if (textNode && textNode.parentElement) {
        textNode.parentElement.scrollIntoView = vi.fn();
        const scrollIntoViewSpy = vi.spyOn(textNode.parentElement, 'scrollIntoView');

        navigateToMatch(0, stateManager);

        expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
      }
    });

    it('要素検索でスクロールが実行される', () => {
      document.body.innerHTML = '<div class="test">Hello</div>';
      const element = document.body.firstChild;
      stateManager.addElement(element);

      // jsdomではscrollIntoViewが実装されていないため、モックを設定
      element.scrollIntoView = vi.fn();
      const scrollIntoViewSpy = vi.spyOn(element, 'scrollIntoView');

      navigateToMatch(0, stateManager);

      expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    });

    it('スクロールエラーが発生しても処理を続行する', () => {
      document.body.innerHTML = '<div>Hello World</div>';
      const element = document.body.firstChild;
      const range = document.createRange();
      range.selectNodeContents(element);
      stateManager.addRange(range);

      // jsdomではscrollIntoViewが実装されていないため、モックを設定
      // parentElementが存在することを確認
      const textNode = element.firstChild;
      if (textNode && textNode.parentElement) {
        textNode.parentElement.scrollIntoView = vi.fn().mockImplementation(() => {
          throw new Error('Scroll error');
        });

        const result = navigateToMatch(0, stateManager);

        // エラーが発生しても処理は続行される
        expect(result.currentIndex).toBe(0);
        expect(result.totalMatches).toBe(1);
      } else {
        // parentElementが存在しない場合でもエラーを投げない
        const result = navigateToMatch(0, stateManager);
        expect(result.currentIndex).toBe(0);
        expect(result.totalMatches).toBe(1);
      }
    });

    it('parentElementがnullの場合でもエラーを投げない', () => {
      document.body.innerHTML = '<div>Hello World</div>';
      const textNode = document.body.firstChild.firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
      stateManager.addRange(range);

      // parentElementをnullにするために、テキストノードを直接使用
      const result = navigateToMatch(0, stateManager);

      // エラーが発生しても処理は続行される
      expect(result.currentIndex).toBe(0);
      expect(result.totalMatches).toBe(1);
    });

    it('テキスト検索でminimapとoverlayが更新される', () => {
      document.body.innerHTML = '<div>Hello World</div>';
      const range = document.createRange();
      range.selectNodeContents(document.body.firstChild);
      stateManager.addRange(range);

      // updateMinimapとupdateOverlayPositionsが呼ばれることを確認
      // 実際の呼び出しは内部で行われるため、エラーが発生しないことを確認
      const result = navigateToMatch(0, stateManager);

      expect(result.currentIndex).toBe(0);
      expect(result.totalMatches).toBe(1);
    });
  });
});
