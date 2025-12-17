import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as minimapModule from '~/lib/highlight/minimap';
import * as overlayModule from '~/lib/highlight/overlay';
import {
  handleClear,
  handleGetResultsList,
  handleGetState,
  handleJumpToMatch,
  handleNavigateNext,
  handleNavigatePrev,
  handleSearch,
} from '~/lib/messaging/handlers';
import * as navigatorModule from '~/lib/navigation/navigator';
import * as elementSearchModule from '~/lib/search/elementSearch';
import * as resultsCollectorModule from '~/lib/search/resultsCollector';
import * as textSearchModule from '~/lib/search/textSearch';
import { SearchStateManager } from '~/lib/state/searchState';
import { cleanupDOM } from '../../../helpers/dom-helpers.js';

describe('messaging/handlers', () => {
  let stateManager;
  let context;
  let updateCallback;

  beforeEach(() => {
    cleanupDOM();
    stateManager = new SearchStateManager();
    updateCallback = vi.fn();
    context = {
      stateManager,
      updateCallback,
    };

    // Mock dependencies
    vi.spyOn(overlayModule, 'clearHighlights').mockImplementation(() => {});
    vi.spyOn(minimapModule, 'removeMinimap').mockImplementation(() => {});
    vi.spyOn(navigatorModule, 'navigateToMatch').mockReturnValue({
      currentIndex: 0,
      totalMatches: 1,
    });
    vi.spyOn(elementSearchModule, 'searchElements').mockReturnValue({
      count: 1,
      currentIndex: 0,
      totalMatches: 1,
    });
    vi.spyOn(textSearchModule, 'searchText').mockReturnValue({
      count: 1,
      currentIndex: 0,
      totalMatches: 1,
    });
  });

  afterEach(() => {
    cleanupDOM();
    stateManager.clear();
    vi.restoreAllMocks();
  });

  describe('handleSearch', () => {
    it('要素検索モードで検索を実行できる', async () => {
      const message = {
        action: 'search',
        query: '.test-class',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: true,
        elementSearchMode: 'css',
      };

      const result = await handleSearch(message, context);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.currentIndex).toBe(0);
      expect(result.totalMatches).toBe(1);
      expect(elementSearchModule.searchElements).toHaveBeenCalledWith(
        '.test-class',
        'css',
        stateManager
      );
    });

    it('テキスト検索モードで検索を実行できる', async () => {
      const message = {
        action: 'search',
        query: 'test query',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
        useFuzzy: false,
      };

      const result = await handleSearch(message, context);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(textSearchModule.searchText).toHaveBeenCalledWith(
        'test query',
        false,
        false,
        stateManager,
        false
      );
    });

    it('検索前にハイライトをクリアする', async () => {
      const message = {
        action: 'search',
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
        useFuzzy: false,
      };

      await handleSearch(message, context);

      expect(overlayModule.clearHighlights).toHaveBeenCalledWith(
        stateManager,
        minimapModule.removeMinimap,
        updateCallback
      );
    });

    it('検索状態を保存する', async () => {
      const message = {
        action: 'search',
        query: 'test query',
        useRegex: true,
        caseSensitive: true,
        useElementSearch: false,
        elementSearchMode: 'css',
        useFuzzy: false,
      };

      await handleSearch(message, context);

      const savedState = stateManager.searchState;
      expect(savedState.query).toBe('test query');
      expect(savedState.useRegex).toBe(true);
      expect(savedState.caseSensitive).toBe(true);
      expect(savedState.useElementSearch).toBe(false);
    });

    it('エラーが発生した場合、エラーレスポンスを返す', async () => {
      const error = new Error('Search failed');
      vi.spyOn(textSearchModule, 'searchText').mockImplementation(() => {
        throw error;
      });

      const message = {
        action: 'search',
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
        useFuzzy: false,
      };

      const result = await handleSearch(message, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Search failed');
    });
  });

  describe('handleClear', () => {
    it('ハイライトをクリアする', () => {
      const message = { action: 'clear' };

      const result = handleClear(message, context);

      expect(result.success).toBe(true);
      expect(overlayModule.clearHighlights).toHaveBeenCalledWith(
        stateManager,
        minimapModule.removeMinimap,
        updateCallback
      );
    });

    it('検索状態をクリアする', () => {
      // まず状態を設定
      stateManager.updateSearchState({
        query: 'test',
        useRegex: true,
        caseSensitive: true,
        useElementSearch: false,
        elementSearchMode: 'css',
      });

      const message = { action: 'clear' };
      handleClear(message, context);

      const clearedState = stateManager.searchState;
      expect(clearedState.query).toBe('');
      expect(clearedState.useRegex).toBe(false);
      expect(clearedState.caseSensitive).toBe(false);
      expect(clearedState.useElementSearch).toBe(false);
    });

    it('updateCallbackがnullの場合でもエラーを投げない', () => {
      const contextWithoutCallback = {
        stateManager,
        updateCallback: null,
      };
      const message = { action: 'clear' };

      expect(() => {
        handleClear(message, contextWithoutCallback);
      }).not.toThrow();
    });
  });

  describe('handleNavigateNext', () => {
    it('次のマッチにナビゲートする', () => {
      // マッチを設定
      const range = document.createRange();
      range.selectNodeContents(document.body);
      stateManager.addRange(range);
      stateManager.setCurrentIndex(0);

      const message = { action: 'navigate-next' };
      const result = handleNavigateNext(message, context);

      expect(result.success).toBe(true);
      expect(navigatorModule.navigateToMatch).toHaveBeenCalledWith(1, stateManager);
    });

    it('ナビゲーション結果を返す', () => {
      const range = document.createRange();
      range.selectNodeContents(document.body);
      stateManager.addRange(range);
      stateManager.setCurrentIndex(0);

      const message = { action: 'navigate-next' };
      const result = handleNavigateNext(message, context);

      expect(result.currentIndex).toBe(0);
      expect(result.totalMatches).toBe(1);
    });
  });

  describe('handleNavigatePrev', () => {
    it('前のマッチにナビゲートする', () => {
      // マッチを設定
      const range = document.createRange();
      range.selectNodeContents(document.body);
      stateManager.addRange(range);
      stateManager.setCurrentIndex(1);

      const message = { action: 'navigate-prev' };
      const result = handleNavigatePrev(message, context);

      expect(result.success).toBe(true);
      expect(navigatorModule.navigateToMatch).toHaveBeenCalledWith(0, stateManager);
    });

    it('ナビゲーション結果を返す', () => {
      const range = document.createRange();
      range.selectNodeContents(document.body);
      stateManager.addRange(range);
      stateManager.setCurrentIndex(1);

      const message = { action: 'navigate-prev' };
      const result = handleNavigatePrev(message, context);

      expect(result.currentIndex).toBe(0);
      expect(result.totalMatches).toBe(1);
    });
  });

  describe('handleGetState', () => {
    it('現在の検索状態を返す', () => {
      stateManager.updateSearchState({
        query: 'test query',
        useRegex: true,
        caseSensitive: true,
        useElementSearch: false,
        elementSearchMode: 'css',
      });
      stateManager.setCurrentIndex(2);

      const message = { action: 'get-state' };
      const result = handleGetState(message, context);

      expect(result.success).toBe(true);
      expect(result.state?.query).toBe('test query');
      expect(result.state?.useRegex).toBe(true);
      expect(result.currentIndex).toBe(2);
    });

    it('状態が空の場合でも正しく動作する', () => {
      const message = { action: 'get-state' };
      const result = handleGetState(message, context);

      expect(result.success).toBe(true);
      expect(result.state).toBeDefined();
      expect(result.currentIndex).toBe(-1);
      expect(result.totalMatches).toBe(0);
    });

    it('マッチ数も返す', () => {
      const range1 = document.createRange();
      const range2 = document.createRange();
      range1.selectNodeContents(document.body);
      range2.selectNodeContents(document.body);
      stateManager.addRange(range1);
      stateManager.addRange(range2);

      const message = { action: 'get-state' };
      const result = handleGetState(message, context);

      expect(result.totalMatches).toBe(2);
    });
  });

  describe('handleGetResultsList', () => {
    it('テキスト検索結果がある場合、結果一覧を返す', () => {
      document.body.innerHTML = '<div>Test content</div>';
      const range = document.createRange();
      range.selectNodeContents(document.body.querySelector('div')?.firstChild || document.body);
      stateManager.addRange(range);

      vi.spyOn(resultsCollectorModule, 'collectTextSearchResults').mockReturnValue([
        {
          index: 0,
          matchedText: 'Test',
          contextBefore: ' ',
          contextAfter: ' content',
          fullText: ' Test content',
        },
      ]);

      const message = { action: 'get-results-list', contextLength: 10 };
      const result = handleGetResultsList(message, context);

      expect(result.success).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.totalMatches).toBe(1);
      expect(resultsCollectorModule.collectTextSearchResults).toHaveBeenCalledWith(
        stateManager.ranges,
        10
      );
    });

    it('要素検索結果がある場合、結果一覧を返す', () => {
      document.body.innerHTML = '<div class="test">Content</div>';
      const element = document.body.querySelector('.test');
      if (element) {
        stateManager.addElement(element);
      }

      vi.spyOn(resultsCollectorModule, 'collectElementSearchResults').mockReturnValue([
        {
          index: 0,
          matchedText: 'Content',
          contextBefore: '',
          contextAfter: '',
          fullText: 'Content',
        },
      ]);

      const message = { action: 'get-results-list', contextLength: 10 };
      const result = handleGetResultsList(message, context);

      expect(result.success).toBe(true);
      expect(result.items).toHaveLength(1);
      expect(result.totalMatches).toBe(1);
      expect(resultsCollectorModule.collectElementSearchResults).toHaveBeenCalledWith(
        stateManager.elements,
        10
      );
    });

    it('検索結果がない場合、空の配列を返す', () => {
      const message = { action: 'get-results-list' };
      const result = handleGetResultsList(message, context);

      expect(result.success).toBe(true);
      expect(result.items).toEqual([]);
      expect(result.totalMatches).toBe(0);
    });

    it('contextLengthが指定されていない場合、デフォルト値を使用する', () => {
      document.body.innerHTML = '<div>Test</div>';
      const range = document.createRange();
      range.selectNodeContents(document.body.querySelector('div')?.firstChild || document.body);
      stateManager.addRange(range);

      vi.spyOn(resultsCollectorModule, 'collectTextSearchResults').mockReturnValue([]);

      const message = { action: 'get-results-list' };
      handleGetResultsList(message, context);

      expect(resultsCollectorModule.collectTextSearchResults).toHaveBeenCalledWith(
        stateManager.ranges,
        undefined
      );
    });
  });

  describe('handleJumpToMatch', () => {
    it('指定されたインデックスのマッチにジャンプする', () => {
      const range1 = document.createRange();
      const range2 = document.createRange();
      range1.selectNodeContents(document.body);
      range2.selectNodeContents(document.body);
      stateManager.addRange(range1);
      stateManager.addRange(range2);

      const navigateSpy = vi.spyOn(navigatorModule, 'navigateToMatch').mockReturnValue({
        currentIndex: 1,
        totalMatches: 2,
      });

      const message = { action: 'jump-to-match', index: 1 };
      const result = handleJumpToMatch(message, context);

      expect(result.success).toBe(true);
      expect(result.currentIndex).toBe(1);
      expect(result.totalMatches).toBe(2);
      expect(navigateSpy).toHaveBeenCalledWith(1, stateManager);
    });

    it('インデックス0にジャンプできる', () => {
      const range = document.createRange();
      range.selectNodeContents(document.body);
      stateManager.addRange(range);

      const navigateSpy = vi.spyOn(navigatorModule, 'navigateToMatch').mockReturnValue({
        currentIndex: 0,
        totalMatches: 1,
      });

      const message = { action: 'jump-to-match', index: 0 };
      const result = handleJumpToMatch(message, context);

      expect(result.success).toBe(true);
      expect(result.currentIndex).toBe(0);
      expect(navigateSpy).toHaveBeenCalledWith(0, stateManager);
    });
  });
});
