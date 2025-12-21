import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SearchStateManager } from '~/lib/state/searchState';

describe('SearchStateManager', () => {
  let stateManager;

  beforeEach(() => {
    stateManager = new SearchStateManager();
  });

  afterEach(() => {
    stateManager.clear();
  });

  describe('getCurrentRange', () => {
    it('rangesが空の場合、nullを返す', () => {
      const result = stateManager.getCurrentRange();
      expect(result).toBeNull();
    });

    it('currentIndexが範囲内の場合、対応するrangeを返す', () => {
      document.body.innerHTML = '<div>Test</div>';
      const range = document.createRange();
      range.selectNodeContents(document.body.firstChild);
      stateManager.addRange(range);
      stateManager.setCurrentIndex(0);

      const result = stateManager.getCurrentRange();
      expect(result).toBe(range);
    });

    it('currentIndexが範囲外の場合、nullを返す', () => {
      document.body.innerHTML = '<div>Test</div>';
      const range = document.createRange();
      range.selectNodeContents(document.body.firstChild);
      stateManager.addRange(range);
      stateManager.setCurrentIndex(10); // 範囲外

      const result = stateManager.getCurrentRange();
      expect(result).toBeNull();
    });

    it('currentIndexが負の場合、nullを返す', () => {
      document.body.innerHTML = '<div>Test</div>';
      const range = document.createRange();
      range.selectNodeContents(document.body.firstChild);
      stateManager.addRange(range);
      stateManager.setCurrentIndex(-1);

      const result = stateManager.getCurrentRange();
      expect(result).toBeNull();
    });
  });

  describe('getCurrentElement', () => {
    it('elementsが空の場合、nullを返す', () => {
      const result = stateManager.getCurrentElement();
      expect(result).toBeNull();
    });

    it('currentIndexが範囲内の場合、対応するelementを返す', () => {
      document.body.innerHTML = '<div class="test">Test</div>';
      const element = document.body.firstChild;
      stateManager.addElement(element);
      stateManager.setCurrentIndex(0);

      const result = stateManager.getCurrentElement();
      expect(result).toBe(element);
    });

    it('currentIndexが範囲外の場合、nullを返す', () => {
      document.body.innerHTML = '<div class="test">Test</div>';
      const element = document.body.firstChild;
      stateManager.addElement(element);
      stateManager.setCurrentIndex(10); // 範囲外

      const result = stateManager.getCurrentElement();
      expect(result).toBeNull();
    });

    it('currentIndexが負の場合、nullを返す', () => {
      document.body.innerHTML = '<div class="test">Test</div>';
      const element = document.body.firstChild;
      stateManager.addElement(element);
      stateManager.setCurrentIndex(-1);

      const result = stateManager.getCurrentElement();
      expect(result).toBeNull();
    });
  });

  describe('初期状態', () => {
    it('初期状態でrangesは空配列', () => {
      expect(stateManager.ranges).toEqual([]);
    });

    it('初期状態でelementsは空配列', () => {
      expect(stateManager.elements).toEqual([]);
    });

    it('初期状態でoverlaysは空配列', () => {
      expect(stateManager.overlays).toEqual([]);
    });

    it('初期状態でcurrentIndexは-1', () => {
      expect(stateManager.currentIndex).toBe(-1);
    });

    it('初期状態でtotalMatchesは0', () => {
      expect(stateManager.totalMatches).toBe(0);
    });

    it('初期状態でhasMatchesはfalse', () => {
      expect(stateManager.hasMatches()).toBe(false);
    });

    it('初期状態でhasTextMatchesはfalse', () => {
      expect(stateManager.hasTextMatches()).toBe(false);
    });

    it('初期状態でhasElementMatchesはfalse', () => {
      expect(stateManager.hasElementMatches()).toBe(false);
    });
  });

  describe('Range管理', () => {
    it('addRangeでrangeを追加できる', () => {
      const range = document.createRange();
      range.selectNodeContents(document.body);

      stateManager.addRange(range);

      expect(stateManager.ranges).toHaveLength(1);
      expect(stateManager.ranges[0]).toBe(range);
    });

    it('複数のrangeを追加できる', () => {
      const range1 = document.createRange();
      const range2 = document.createRange();
      range1.selectNodeContents(document.body);
      range2.selectNodeContents(document.body);

      stateManager.addRange(range1);
      stateManager.addRange(range2);

      expect(stateManager.ranges).toHaveLength(2);
    });

    it('range追加後、hasTextMatchesはtrue', () => {
      const range = document.createRange();
      range.selectNodeContents(document.body);

      stateManager.addRange(range);

      expect(stateManager.hasTextMatches()).toBe(true);
      expect(stateManager.hasMatches()).toBe(true);
    });
  });

  describe('Element管理', () => {
    it('addElementでelementを追加できる', () => {
      const element = document.createElement('div');

      stateManager.addElement(element);

      expect(stateManager.elements).toHaveLength(1);
      expect(stateManager.elements[0]).toBe(element);
    });

    it('複数のelementを追加できる', () => {
      const element1 = document.createElement('div');
      const element2 = document.createElement('span');

      stateManager.addElement(element1);
      stateManager.addElement(element2);

      expect(stateManager.elements).toHaveLength(2);
    });

    it('element追加後、hasElementMatchesはtrue', () => {
      const element = document.createElement('div');

      stateManager.addElement(element);

      expect(stateManager.hasElementMatches()).toBe(true);
      expect(stateManager.hasMatches()).toBe(true);
    });
  });

  describe('Overlay管理', () => {
    it('addOverlayでoverlayを追加できる', () => {
      const overlay = document.createElement('div');

      stateManager.addOverlay(overlay);

      expect(stateManager.overlays).toHaveLength(1);
      expect(stateManager.overlays[0]).toBe(overlay);
    });

    it('clearOverlaysでoverlaysをクリアできる', () => {
      const overlay1 = document.createElement('div');
      const overlay2 = document.createElement('div');

      stateManager.addOverlay(overlay1);
      stateManager.addOverlay(overlay2);
      expect(stateManager.overlays).toHaveLength(2);

      stateManager.clearOverlays();

      expect(stateManager.overlays).toHaveLength(0);
    });
  });

  describe('CurrentIndex管理', () => {
    it('setCurrentIndexでインデックスを設定できる', () => {
      stateManager.setCurrentIndex(5);

      expect(stateManager.currentIndex).toBe(5);
    });

    it('setCurrentIndexで負の値を設定できる', () => {
      stateManager.setCurrentIndex(-1);

      expect(stateManager.currentIndex).toBe(-1);
    });
  });

  describe('SearchState管理', () => {
    it('updateSearchStateで検索状態を更新できる', () => {
      const newState = {
        query: 'test query',
        useRegex: true,
        caseSensitive: true,
        useElementSearch: false,
        elementSearchMode: 'css',
      };

      stateManager.updateSearchState(newState);

      const state = stateManager.searchState;
      expect(state.query).toBe('test query');
      expect(state.useRegex).toBe(true);
      expect(state.caseSensitive).toBe(true);
      expect(state.useElementSearch).toBe(false);
      expect(state.elementSearchMode).toBe('css');
    });

    it('searchStateはコピーを返す（不変性）', () => {
      const newState = {
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
      };

      stateManager.updateSearchState(newState);
      const state1 = stateManager.searchState;
      const state2 = stateManager.searchState;

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('Clear操作', () => {
    it('clearで全ての状態をリセットできる', () => {
      const range = document.createRange();
      range.selectNodeContents(document.body);
      const element = document.createElement('div');
      const overlay = document.createElement('div');

      stateManager.addRange(range);
      stateManager.addElement(element);
      stateManager.addOverlay(overlay);
      stateManager.setCurrentIndex(5);
      stateManager.updateSearchState({
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
      });

      stateManager.clear();

      expect(stateManager.ranges).toHaveLength(0);
      expect(stateManager.elements).toHaveLength(0);
      expect(stateManager.overlays).toHaveLength(0);
      expect(stateManager.currentIndex).toBe(-1);
    });
  });

  describe('CurrentRange/Element取得', () => {
    it('getCurrentRangeで現在のrangeを取得できる', () => {
      const range1 = document.createRange();
      const range2 = document.createRange();
      range1.selectNodeContents(document.body);
      range2.selectNodeContents(document.body);

      stateManager.addRange(range1);
      stateManager.addRange(range2);
      stateManager.setCurrentIndex(1);

      expect(stateManager.getCurrentRange()).toBe(range2);
    });

    it('rangeがない場合、getCurrentRangeはnullを返す', () => {
      expect(stateManager.getCurrentRange()).toBeNull();
    });

    it('getCurrentElementで現在のelementを取得できる', () => {
      const element1 = document.createElement('div');
      const element2 = document.createElement('span');

      stateManager.addElement(element1);
      stateManager.addElement(element2);
      stateManager.setCurrentIndex(0);

      expect(stateManager.getCurrentElement()).toBe(element1);
    });

    it('elementがない場合、getCurrentElementはnullを返す', () => {
      expect(stateManager.getCurrentElement()).toBeNull();
    });
  });

  describe('TotalMatches計算', () => {
    it('rangeがある場合、totalMatchesはrangeの数', () => {
      const range1 = document.createRange();
      const range2 = document.createRange();
      range1.selectNodeContents(document.body);
      range2.selectNodeContents(document.body);

      stateManager.addRange(range1);
      stateManager.addRange(range2);

      expect(stateManager.totalMatches).toBe(2);
    });

    it('elementがある場合、totalMatchesはelementの数', () => {
      const element1 = document.createElement('div');
      const element2 = document.createElement('span');

      stateManager.addElement(element1);
      stateManager.addElement(element2);

      expect(stateManager.totalMatches).toBe(2);
    });

    it('rangeとelementの両方がある場合、rangeの数が優先', () => {
      const range = document.createRange();
      range.selectNodeContents(document.body);
      const element = document.createElement('div');

      stateManager.addRange(range);
      stateManager.addElement(element);

      expect(stateManager.totalMatches).toBe(1);
    });
  });

  describe('forEachRange', () => {
    it('forEachRangeで全てのrangeを反復できる', () => {
      const range1 = document.createRange();
      const range2 = document.createRange();
      range1.selectNodeContents(document.body);
      range2.selectNodeContents(document.body);

      stateManager.addRange(range1);
      stateManager.addRange(range2);

      const ranges = [];
      stateManager.forEachRange((range, index) => {
        ranges.push(range);
        expect(typeof index).toBe('number');
      });

      expect(ranges).toHaveLength(2);
      expect(ranges[0]).toBe(range1);
      expect(ranges[1]).toBe(range2);
    });
  });

  describe('forEachElement', () => {
    it('forEachElementで全てのelementを反復できる', () => {
      const element1 = document.createElement('div');
      const element2 = document.createElement('span');

      stateManager.addElement(element1);
      stateManager.addElement(element2);

      const elements = [];
      stateManager.forEachElement((element) => {
        elements.push(element);
      });

      expect(elements).toHaveLength(2);
      expect(elements[0]).toBe(element1);
      expect(elements[1]).toBe(element2);
    });
  });
});
