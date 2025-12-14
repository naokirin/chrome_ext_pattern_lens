import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as handlersModule from '~/lib/messaging/handlers';
import { routeMessage } from '~/lib/messaging/router';
import { SearchStateManager } from '~/lib/state/searchState';
import { cleanupDOM } from '../../../helpers/dom-helpers.js';

describe('messaging/router', () => {
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
  });

  afterEach(() => {
    cleanupDOM();
    stateManager.clear();
    vi.restoreAllMocks();
  });

  describe('routeMessage', () => {
    it('searchアクションをhandleSearchにルーティングする', async () => {
      const handleSearchSpy = vi.spyOn(handlersModule, 'handleSearch').mockResolvedValue({
        success: true,
        count: 1,
        currentIndex: 0,
        totalMatches: 1,
      });

      const message = {
        action: 'search',
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
      };

      const result = await routeMessage(message, context);

      expect(handleSearchSpy).toHaveBeenCalledWith(message, context);
      expect(result?.success).toBe(true);
      expect(result?.count).toBe(1);
    });

    it('clearアクションをhandleClearにルーティングする', async () => {
      const handleClearSpy = vi
        .spyOn(handlersModule, 'handleClear')
        .mockReturnValue({ success: true });

      const message = { action: 'clear' };

      const result = await routeMessage(message, context);

      expect(handleClearSpy).toHaveBeenCalledWith(message, context);
      expect(result?.success).toBe(true);
    });

    it('navigate-nextアクションをhandleNavigateNextにルーティングする', async () => {
      const handleNavigateNextSpy = vi.spyOn(handlersModule, 'handleNavigateNext').mockReturnValue({
        success: true,
        currentIndex: 1,
        totalMatches: 2,
      });

      const message = { action: 'navigate-next' };

      const result = await routeMessage(message, context);

      expect(handleNavigateNextSpy).toHaveBeenCalledWith(message, context);
      expect(result?.success).toBe(true);
      expect(result?.currentIndex).toBe(1);
    });

    it('navigate-prevアクションをhandleNavigatePrevにルーティングする', async () => {
      const handleNavigatePrevSpy = vi.spyOn(handlersModule, 'handleNavigatePrev').mockReturnValue({
        success: true,
        currentIndex: 0,
        totalMatches: 2,
      });

      const message = { action: 'navigate-prev' };

      const result = await routeMessage(message, context);

      expect(handleNavigatePrevSpy).toHaveBeenCalledWith(message, context);
      expect(result?.success).toBe(true);
      expect(result?.currentIndex).toBe(0);
    });

    it('get-stateアクションをhandleGetStateにルーティングする', async () => {
      stateManager.updateSearchState({
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
      });

      const handleGetStateSpy = vi.spyOn(handlersModule, 'handleGetState').mockReturnValue({
        success: true,
        state: stateManager.searchState,
        currentIndex: -1,
        totalMatches: 0,
      });

      const message = { action: 'get-state' };

      const result = await routeMessage(message, context);

      expect(handleGetStateSpy).toHaveBeenCalledWith(message, context);
      expect(result?.success).toBe(true);
      expect(result?.state).toBeDefined();
    });

    it('ハンドラーでエラーが発生した場合、エラーレスポンスを返す', async () => {
      const error = new Error('Handler error');
      vi.spyOn(handlersModule, 'handleSearch').mockRejectedValue(error);

      const message = {
        action: 'search',
        query: 'test',
        useRegex: false,
        caseSensitive: false,
        useElementSearch: false,
        elementSearchMode: 'css',
      };

      const result = await routeMessage(message, context);

      expect(result?.success).toBe(false);
      expect(result?.error).toBe('Handler error');
    });

    it('未知のアクションの場合、undefinedを返す', async () => {
      // TypeScriptの型チェックを回避するため、型アサーションを使用
      const message = { action: 'unknown-action' };

      const result = await routeMessage(message, context);

      expect(result).toBeUndefined();
    });
  });
});
