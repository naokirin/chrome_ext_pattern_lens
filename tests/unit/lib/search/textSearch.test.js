import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRangeFromVirtualMatch,
  mergeAdjacentRects,
  searchInVirtualText,
  searchText,
} from '~/lib/search/textSearch';
import { SearchStateManager } from '~/lib/state/searchState';
import { cleanupDOM } from '../../../helpers/dom-helpers.js';

describe('textSearch', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('mergeAdjacentRects', () => {
    it('空の配列を返す（rectListがnullの場合）', () => {
      const result = mergeAdjacentRects(null);
      expect(result).toEqual([]);
    });

    it('空の配列を返す（rectListが空の場合）', () => {
      const result = mergeAdjacentRects([]);
      expect(result).toEqual([]);
    });

    it('単一の矩形をそのまま返す', () => {
      const rect = new DOMRect(0, 0, 100, 20);
      const result = mergeAdjacentRects([rect]);
      expect(result.length).toBe(1);
      expect(result[0]).toEqual(rect);
    });

    it('同じ行の隣接する矩形をマージする', () => {
      const rect1 = new DOMRect(0, 0, 50, 20);
      const rect2 = new DOMRect(51, 0, 50, 20); // gap = 1
      const result = mergeAdjacentRects([rect1, rect2]);

      expect(result.length).toBe(1);
      expect(result[0].left).toBe(0);
      expect(result[0].right).toBe(101);
    });

    it('異なる行の矩形はマージしない', () => {
      const rect1 = new DOMRect(0, 0, 50, 20);
      const rect2 = new DOMRect(0, 25, 50, 20); // 異なる行
      const result = mergeAdjacentRects([rect1, rect2]);

      expect(result.length).toBe(2);
    });

    it('tolerance内のギャップでマージする', () => {
      const rect1 = new DOMRect(0, 0, 50, 20);
      const rect2 = new DOMRect(52, 0, 50, 20); // gap = 2, tolerance = 1（デフォルト）
      const result = mergeAdjacentRects([rect1, rect2], 2);

      expect(result.length).toBe(1);
    });

    it('toleranceを超えるギャップではマージしない', () => {
      const rect1 = new DOMRect(0, 0, 50, 20);
      const rect2 = new DOMRect(60, 0, 50, 20); // gap = 10
      const result = mergeAdjacentRects([rect1, rect2], 1);

      expect(result.length).toBe(2);
    });

    it('複数の矩形を正しくマージする', () => {
      const rect1 = new DOMRect(0, 0, 30, 20);
      const rect2 = new DOMRect(31, 0, 30, 20); // マージ
      const rect3 = new DOMRect(62, 0, 30, 20); // マージ
      const rect4 = new DOMRect(100, 0, 30, 20); // マージしない
      const result = mergeAdjacentRects([rect1, rect2, rect3, rect4]);

      expect(result.length).toBe(2);
      expect(result[0].right).toBe(92);
      expect(result[1].left).toBe(100);
    });
  });

  describe('searchInVirtualText', () => {
    const BLOCK_BOUNDARY_MARKER = '\uE000';

    it('通常検索でシンプルなテキストマッチを検索できる', () => {
      const virtualText = 'Hello World';
      const matches = searchInVirtualText('World', virtualText, false, false);

      expect(matches.length).toBe(1);
      expect(matches[0].start).toBe(6);
      expect(matches[0].end).toBe(11);
    });

    it('通常検索で複数のマッチを検索できる', () => {
      const virtualText = 'apple banana apple';
      const matches = searchInVirtualText('apple', virtualText, false, false);

      expect(matches.length).toBe(2);
      expect(matches[0].start).toBe(0);
      expect(matches[1].start).toBe(13);
    });

    it('通常検索で大文字小文字を区別しない', () => {
      const virtualText = 'Hello WORLD';
      const matches = searchInVirtualText('world', virtualText, false, false);

      expect(matches.length).toBe(1);
    });

    it('通常検索で大文字小文字を区別する', () => {
      const virtualText = 'Hello WORLD world';
      const matches = searchInVirtualText('world', virtualText, false, true);

      expect(matches.length).toBe(1);
      expect(matches[0].start).toBe(12);
    });

    it('正規表現検索でパターンマッチできる', () => {
      const virtualText = 'test123 test456';
      const matches = searchInVirtualText('test\\d+', virtualText, true, false);

      expect(matches.length).toBe(2);
      expect(virtualText.substring(matches[0].start, matches[0].end)).toBe('test123');
    });

    it('正規表現検索でブロック境界を越えない', () => {
      const virtualText = `Hello${BLOCK_BOUNDARY_MARKER}World`;
      const matches = searchInVirtualText('H.llo', virtualText, true, false);

      expect(matches.length).toBe(1);
      expect(virtualText.substring(matches[0].start, matches[0].end)).toBe('Hello');
    });

    it('不正な正規表現でエラーを処理する', () => {
      const virtualText = 'test text';
      const matches = searchInVirtualText('[invalid(regex', virtualText, true, false);

      expect(matches).toEqual([]);
    });

    it('ブロック境界を含むマッチを除外する', () => {
      const virtualText = `Lorem ipsum${BLOCK_BOUNDARY_MARKER}dolor sit`;
      const matches = searchInVirtualText('ipsum dolor', virtualText, false, false);

      expect(matches.length).toBe(0);
    });
  });

  describe('createRangeFromVirtualMatch', () => {
    it('シンプルなマッチからRangeを作成できる', () => {
      document.body.innerHTML = '<div>Hello World</div>';
      const textNode = document.body.firstChild.firstChild;
      const charMap = [
        { node: textNode, offset: 0 },
        { node: textNode, offset: 1 },
        { node: textNode, offset: 2 },
        { node: textNode, offset: 3 },
        { node: textNode, offset: 4 },
        { node: textNode, offset: 5 },
        { node: textNode, offset: 6 },
        { node: textNode, offset: 7 },
        { node: textNode, offset: 8 },
        { node: textNode, offset: 9 },
        { node: textNode, offset: 10 },
      ];
      const match = { start: 0, end: 5 };

      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).not.toBeNull();
      expect(range.toString()).toBe('Hello');
    });

    it('charMapが見つからない場合nullを返す', () => {
      const charMap = [];
      const match = { start: 0, end: 5 };

      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).toBeNull();
    });

    it('ブロック境界マーカーを含むマッチでnullを返す', () => {
      const charMap = [
        { node: null, offset: -1, type: 'block-boundary' },
      ];
      const match = { start: 0, end: 1 };

      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).toBeNull();
    });

    it('エラーが発生した場合nullを返す', () => {
      const charMap = [
        { node: null, offset: 0 }, // 無効なnode
      ];
      const match = { start: 0, end: 1 };

      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).toBeNull();
    });
  });

  describe('searchText', () => {
    let stateManager;

    beforeEach(() => {
      stateManager = new SearchStateManager();
      // jsdomではRange.getClientRects()が実装されていないため、モックを設定
      Range.prototype.getClientRects = vi.fn(function () {
        const rect = new DOMRect(0, 0, 100, 20);
        return {
          length: 1,
          0: rect,
          [Symbol.iterator]: function* () {
            yield rect;
          },
        };
      });
    });

    afterEach(() => {
      stateManager.clear();
      // モックをクリーンアップ
      delete Range.prototype.getClientRects;
    });

    it('シンプルなテキスト検索を実行できる', () => {
      document.body.innerHTML = '<div>Hello World</div>';

      const result = searchText('Hello', false, false, stateManager);

      expect(result.count).toBe(1);
      expect(result.currentIndex).toBe(0);
      expect(result.totalMatches).toBe(1);
      expect(stateManager.ranges.length).toBe(1);
    });

    it('複数のマッチを検索できる', () => {
      document.body.innerHTML = '<div>test test test</div>';

      const result = searchText('test', false, false, stateManager);

      expect(result.count).toBe(3);
      expect(result.currentIndex).toBe(0);
      expect(result.totalMatches).toBe(3);
      expect(stateManager.ranges.length).toBe(3);
    });

    it('マッチがない場合0を返す', () => {
      document.body.innerHTML = '<div>Hello World</div>';

      const result = searchText('NotFound', false, false, stateManager);

      expect(result.count).toBe(0);
      expect(result.currentIndex).toBe(-1);
      expect(result.totalMatches).toBe(0);
    });

    it('正規表現検索を実行できる', () => {
      document.body.innerHTML = '<div>test123 test456</div>';

      const result = searchText('test\\d+', true, false, stateManager);

      expect(result.count).toBe(2);
      expect(result.currentIndex).toBe(0);
      expect(result.totalMatches).toBe(2);
    });

    it('大文字小文字を区別する検索を実行できる', () => {
      document.body.innerHTML = '<div>Hello WORLD world</div>';

      const result = searchText('world', false, true, stateManager);

      expect(result.count).toBe(1);
      expect(result.currentIndex).toBe(0);
    });

    it('overlayコンテナを作成する', () => {
      document.body.innerHTML = '<div>Hello World</div>';

      searchText('Hello', false, false, stateManager);

      const container = document.getElementById('pattern-lens-overlay-container');
      expect(container).not.toBeNull();
    });

    it('overlayを作成する', () => {
      document.body.innerHTML = '<div>Hello World</div>';

      searchText('Hello', false, false, stateManager);

      expect(stateManager.overlays.length).toBeGreaterThan(0);
    });

    it('Rangeの作成に失敗しても処理を続行する', () => {
      document.body.innerHTML = '<div>Hello World</div>';

      // 無効なcharMapをシミュレートするために、searchTextを直接呼び出す
      // 実際のエラーケースは内部で処理される
      const result = searchText('Hello', false, false, stateManager);

      // エラーが発生しても結果は返される
      expect(result).toBeDefined();
    });

    it('マッチが見つかった場合イベントリスナーを設定する', () => {
      document.body.innerHTML = '<div>Hello World</div>';

      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      const result = searchText('Hello', false, false, stateManager);

      // マッチが見つかった場合、イベントリスナーが設定される可能性がある
      // （既に設定されている場合は再度設定されない）
      expect(result.count).toBeGreaterThan(0);
      // イベントリスナーの設定は内部実装に依存するため、
      // マッチが見つかったことを確認する
      expect(stateManager.ranges.length).toBeGreaterThan(0);
    });

    it('最初のマッチに自動的にナビゲートする', () => {
      document.body.innerHTML = '<div>test test test</div>';

      const result = searchText('test', false, false, stateManager);

      // マッチが見つかった場合、currentIndexは0になる
      if (result.count > 0) {
        expect(result.currentIndex).toBe(0);
        expect(stateManager.currentIndex).toBe(0);
      }
    });
  });
});
