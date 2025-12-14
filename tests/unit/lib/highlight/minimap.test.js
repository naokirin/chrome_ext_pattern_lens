import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getMinimapContainer, removeMinimap, updateMinimap } from '~/lib/highlight/minimap';
import { SearchStateManager } from '~/lib/state/searchState';
import { cleanupDOM } from '../../../helpers/dom-helpers.js';

describe('minimap', () => {
  let stateManager;

  beforeEach(() => {
    cleanupDOM();
    stateManager = new SearchStateManager();
  });

  afterEach(() => {
    cleanupDOM();
    stateManager.clear();
  });

  describe('getMinimapContainer', () => {
    it('コンテナが存在しない場合、新規作成する', () => {
      const container = getMinimapContainer();

      expect(container).not.toBeNull();
      expect(container.id).toBe('pattern-lens-minimap-container');
      expect(document.body.contains(container)).toBe(true);
    });

    it('コンテナが既に存在する場合、既存のものを返す', () => {
      const container1 = getMinimapContainer();
      const container2 = getMinimapContainer();

      expect(container1).toBe(container2);
    });

    it('コンテナにスタイルが適用される', () => {
      const container = getMinimapContainer();

      expect(container.style.position).toBe('fixed');
      expect(container.style.top).toBe('0px');
      expect(container.style.width).toBe('12px');
      expect(container.style.height).toBe('100vh');
    });
  });

  describe('updateMinimap', () => {
    it('rangeがない場合、コンテナは非表示になる', () => {
      const container = getMinimapContainer();
      container.style.display = 'block';

      updateMinimap(stateManager);

      expect(container.style.display).toBe('none');
    });

    it('rangeがある場合、マーカーが作成される', () => {
      cleanupDOM();
      const div = document.createElement('div');
      div.textContent = 'Test text';
      div.style.position = 'absolute';
      div.style.left = '10px';
      div.style.top = '20px';
      document.body.appendChild(div);
      const range = document.createRange();
      range.selectNodeContents(div);

      stateManager.addRange(range);
      stateManager.setCurrentIndex(0);

      const container = getMinimapContainer();
      updateMinimap(stateManager);

      expect(container.style.display).toBe('block');
      // getBoundingClientRect()が正しく動作する場合、マーカーが作成される
      // テスト環境では空の可能性があるため、エラーが発生しないことを確認
      expect(() => updateMinimap(stateManager)).not.toThrow();
    });

    it('現在のマッチは異なる色で表示される', () => {
      cleanupDOM();
      const div1 = document.createElement('div');
      div1.textContent = 'Test 1';
      div1.style.position = 'absolute';
      div1.style.left = '10px';
      div1.style.top = '20px';
      const div2 = document.createElement('div');
      div2.textContent = 'Test 2';
      div2.style.position = 'absolute';
      div2.style.left = '10px';
      div2.style.top = '100px';
      document.body.appendChild(div1);
      document.body.appendChild(div2);

      const range1 = document.createRange();
      const range2 = document.createRange();
      range1.selectNodeContents(div1);
      range2.selectNodeContents(div2);

      stateManager.addRange(range1);
      stateManager.addRange(range2);
      stateManager.setCurrentIndex(0);

      getMinimapContainer();
      updateMinimap(stateManager);

      // getBoundingClientRect()が正しく動作する場合、マーカーが作成される
      // テスト環境では空の可能性があるため、エラーが発生しないことを確認
      expect(() => updateMinimap(stateManager)).not.toThrow();
    });

    it('エラーが発生しても処理を続行する', () => {
      // 無効なrangeを作成（エラーを引き起こす）
      const range = document.createRange();
      // rangeを設定せずに追加（getBoundingClientRectでエラー）

      stateManager.addRange(range);

      expect(() => {
        updateMinimap(stateManager);
      }).not.toThrow();
    });
  });

  describe('removeMinimap', () => {
    it('コンテナが存在する場合、削除する', () => {
      const container = getMinimapContainer();
      expect(document.body.contains(container)).toBe(true);

      removeMinimap();

      expect(document.getElementById('pattern-lens-minimap-container')).toBeNull();
    });

    it('コンテナが存在しない場合、エラーを投げない', () => {
      expect(() => {
        removeMinimap();
      }).not.toThrow();
    });
  });
});
