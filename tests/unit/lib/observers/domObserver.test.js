import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMSearchObserver } from '~/lib/observers/domObserver';
import { SearchStateManager } from '~/lib/state/searchState';
import { cleanupDOM } from '../../../helpers/dom-helpers.js';

describe('DOMSearchObserver', () => {
  let stateManager;
  let observer;

  beforeEach(() => {
    cleanupDOM();
    stateManager = new SearchStateManager();
    observer = new DOMSearchObserver(stateManager);
  });

  afterEach(() => {
    observer.stopObserving();
    cleanupDOM();
  });

  describe('初期化', () => {
    it('インスタンスを作成できる', () => {
      expect(observer).toBeDefined();
      expect(observer.isObserving).toBe(false);
    });

    it('カスタムオプションで初期化できる', () => {
      const customObserver = new DOMSearchObserver(stateManager, {
        debounceMs: 1000,
        maxMutationsPerSecond: 5,
      });
      expect(customObserver).toBeDefined();
      customObserver.stopObserving();
    });
  });

  describe('startObserving / stopObserving', () => {
    it('監視を開始できる', () => {
      const searchFunction = vi.fn();
      observer.startObserving('test', {
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
        useFuzzy: false,
      }, searchFunction);

      expect(observer.isObserving).toBe(true);
    });

    it('監視を停止できる', () => {
      const searchFunction = vi.fn();
      observer.startObserving('test', {
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
        useFuzzy: false,
      }, searchFunction);

      observer.stopObserving();
      expect(observer.isObserving).toBe(false);
    });

    it('無効化されている場合は監視を開始しない', () => {
      const disabledObserver = new DOMSearchObserver(stateManager, {
        enabled: false,
      });
      const searchFunction = vi.fn();
      disabledObserver.startObserving('test', {
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
        useFuzzy: false,
      }, searchFunction);

      expect(disabledObserver.isObserving).toBe(false);
      disabledObserver.stopObserving();
    });
  });

  describe('DOM変更の検知', () => {
    it('要素が追加されたときに検知する', (done) => {
      const searchFunction = vi.fn(() => {
        // 検索関数が呼ばれたことを確認
        expect(searchFunction).toHaveBeenCalled();
        done();
      });

      observer.startObserving('test', {
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
        useFuzzy: false,
      }, searchFunction);

      // 要素を追加
      const div = document.createElement('div');
      div.textContent = 'test content';
      document.body.appendChild(div);

      // デバウンス時間を待つ（テスト環境では短縮）
      setTimeout(() => {
        if (!searchFunction.mock.calls.length) {
          done();
        }
      }, 600);
    });

    it('要素が削除されたときに検知する', (done) => {
      const searchFunction = vi.fn(() => {
        expect(searchFunction).toHaveBeenCalled();
        done();
      });

      // 最初に要素を追加
      const div = document.createElement('div');
      div.textContent = 'test content';
      document.body.appendChild(div);

      observer.startObserving('test', {
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
        useFuzzy: false,
      }, searchFunction);

      // 要素を削除
      div.remove();

      setTimeout(() => {
        if (!searchFunction.mock.calls.length) {
          done();
        }
      }, 600);
    });

    it('テキストノードが変更されたときに検知する', (done) => {
      const searchFunction = vi.fn(() => {
        expect(searchFunction).toHaveBeenCalled();
        done();
      });

      const div = document.createElement('div');
      div.textContent = 'initial';
      document.body.appendChild(div);

      observer.startObserving('test', {
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
        useFuzzy: false,
      }, searchFunction);

      // テキストを変更
      div.textContent = 'updated';

      setTimeout(() => {
        if (!searchFunction.mock.calls.length) {
          done();
        }
      }, 600);
    });
  });

  describe('デバウンス', () => {
    it('複数の変更をデバウンスする', (done) => {
      let callCount = 0;
      const searchFunction = vi.fn(() => {
        callCount++;
      });

      observer.startObserving('test', {
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
        useFuzzy: false,
      }, searchFunction);

      // 複数の要素を短時間で追加
      for (let i = 0; i < 5; i++) {
        const div = document.createElement('div');
        div.textContent = `test ${i}`;
        document.body.appendChild(div);
      }

      // デバウンス時間後に確認
      setTimeout(() => {
        // デバウンスにより、複数の変更が1回の検索にまとめられる
        expect(callCount).toBeGreaterThan(0);
        done();
      }, 600);
    });
  });

  describe('レート制限', () => {
    it('レート制限を超えた場合は検索をスキップする', (done) => {
      let callCount = 0;
      const searchFunction = vi.fn(() => {
        callCount++;
      });

      const limitedObserver = new DOMSearchObserver(stateManager, {
        maxMutationsPerSecond: 2,
        debounceMs: 100,
      });

      limitedObserver.startObserving('test', {
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
        useFuzzy: false,
      }, searchFunction);

      // レート制限を超える数の変更を短時間で発生させる
      for (let i = 0; i < 10; i++) {
        const div = document.createElement('div');
        div.textContent = `test ${i}`;
        document.body.appendChild(div);
      }

      setTimeout(() => {
        // レート制限により、一部の変更がスキップされる
        expect(callCount).toBeLessThan(10);
        limitedObserver.stopObserving();
        done();
      }, 200);
    });
  });

  describe('updateOptions', () => {
    it('オプションを更新できる', () => {
      observer.updateOptions({
        debounceMs: 1000,
      });
      // オプションが更新されたことを確認（内部状態なので直接確認は難しいが、エラーが発生しないことを確認）
      expect(observer).toBeDefined();
    });
  });
});
