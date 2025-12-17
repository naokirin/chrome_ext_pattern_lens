/**
 * Message handlers for content script
 */
import { DOMSearchObserver, type SearchFunction } from '~/lib/observers/domObserver';
import { removeMinimap } from '~/lib/highlight/minimap';
import { clearHighlights } from '~/lib/highlight/overlay';
import { navigateToMatch } from '~/lib/navigation/navigator';
import { searchElements } from '~/lib/search/elementSearch';
import {
  collectElementSearchResults,
  collectTextSearchResults,
} from '~/lib/search/resultsCollector';
import { searchText } from '~/lib/search/textSearch';
import type { SearchStateManager } from '~/lib/state/searchState';
import type {
  ClearMessage,
  GetResultsListMessage,
  GetStateMessage,
  JumpToMatchMessage,
  NavigateMessage,
  SearchMessage,
  SearchResponse,
  SearchResultsListResponse,
  StateResponse,
} from '~/lib/types';
import { handleError } from '~/lib/utils/errorHandler';

/**
 * Context for message handlers
 */
export interface MessageHandlerContext {
  stateManager: SearchStateManager;
  updateCallback: (() => void) | null;
  domObserver?: DOMSearchObserver;
}

/**
 * Handle search action
 */
export async function handleSearch(
  message: SearchMessage,
  context: MessageHandlerContext
): Promise<SearchResponse> {
  try {
    // Clear previous highlights
    if (context.updateCallback) {
      clearHighlights(context.stateManager, removeMinimap, context.updateCallback);
    }

    // Stop existing DOM observer
    if (context.domObserver) {
      context.domObserver.stopObserving();
    }

    // Save search state
    const searchState = {
      query: message.query,
      useRegex: message.useRegex,
      caseSensitive: message.caseSensitive,
      useElementSearch: message.useElementSearch,
      elementSearchMode: message.elementSearchMode,
      useFuzzy: message.useFuzzy,
    };
    context.stateManager.updateSearchState(searchState);

    // Perform search
    let result;
    let searchFunction: SearchFunction;

    if (message.useElementSearch) {
      result = searchElements(message.query, message.elementSearchMode, context.stateManager);
      searchFunction = (query, options, stateManager, updateCallback, skipNavigation) => {
        // Save previous index before clearing
        const previousIndex = skipNavigation ? stateManager.currentIndex : -1;
        // Clear highlights before re-searching
        if (updateCallback) {
          clearHighlights(stateManager, removeMinimap, updateCallback);
        }
        searchElements(query, options.elementSearchMode, stateManager, skipNavigation, previousIndex);
      };
    } else {
      result = searchText(
        message.query,
        message.useRegex,
        message.caseSensitive,
        context.stateManager,
        message.useFuzzy
      );
      searchFunction = (query, options, stateManager, updateCallback, skipNavigation) => {
        // Save previous index before clearing
        const previousIndex = skipNavigation ? stateManager.currentIndex : -1;
        // Clear highlights before re-searching
        if (updateCallback) {
          clearHighlights(stateManager, removeMinimap, updateCallback);
        }
        searchText(
          query,
          options.useRegex,
          options.caseSensitive,
          stateManager,
          options.useFuzzy,
          skipNavigation,
          previousIndex
        );
      };
    }

    // Start DOM observer for automatic updates
    if (context.domObserver) {
      context.domObserver.startObserving(
        message.query,
        searchState,
        searchFunction,
        context.updateCallback
      );
    }

    return {
      success: true,
      count: result.count,
      currentIndex: result.currentIndex,
      totalMatches: result.totalMatches,
    };
  } catch (error) {
    const err = error as Error;
    handleError(error, 'handleSearch: Search action failed', undefined);
    return { success: false, error: err.message };
  }
}

/**
 * Handle clear action
 */
export function handleClear(
  _message: ClearMessage,
  context: MessageHandlerContext
): SearchResponse {
  // Stop DOM observer
  if (context.domObserver) {
    context.domObserver.stopObserving();
  }

  if (context.updateCallback) {
    clearHighlights(context.stateManager, removeMinimap, context.updateCallback);
  }
  // Clear search state
  context.stateManager.updateSearchState({
    query: '',
    useRegex: false,
    caseSensitive: false,
    useElementSearch: false,
    elementSearchMode: 'css',
    useFuzzy: false,
  });
  return { success: true };
}

/**
 * Handle navigate-next action
 */
export function handleNavigateNext(
  _message: NavigateMessage,
  context: MessageHandlerContext
): SearchResponse {
  const result = navigateToMatch(context.stateManager.currentIndex + 1, context.stateManager);
  return {
    success: true,
    currentIndex: result.currentIndex,
    totalMatches: result.totalMatches,
  };
}

/**
 * Handle navigate-prev action
 */
export function handleNavigatePrev(
  _message: NavigateMessage,
  context: MessageHandlerContext
): SearchResponse {
  const result = navigateToMatch(context.stateManager.currentIndex - 1, context.stateManager);
  return {
    success: true,
    currentIndex: result.currentIndex,
    totalMatches: result.totalMatches,
  };
}

/**
 * Handle get-state action
 */
export function handleGetState(
  _message: GetStateMessage,
  context: MessageHandlerContext
): StateResponse {
  return {
    success: true,
    state: context.stateManager.searchState,
    currentIndex: context.stateManager.currentIndex,
    totalMatches: context.stateManager.totalMatches,
  };
}

/**
 * Handle get-results-list action
 */
export function handleGetResultsList(
  message: GetResultsListMessage,
  context: MessageHandlerContext
): SearchResultsListResponse {
  try {
    if (context.stateManager.hasTextMatches()) {
      const items = collectTextSearchResults(context.stateManager.ranges, message.contextLength);
      return {
        success: true,
        items,
        totalMatches: context.stateManager.totalMatches,
      };
    }
    if (context.stateManager.hasElementMatches()) {
      const items = collectElementSearchResults(
        context.stateManager.elements,
        message.contextLength
      );
      return {
        success: true,
        items,
        totalMatches: context.stateManager.totalMatches,
      };
    }

    return {
      success: true,
      items: [],
      totalMatches: 0,
    };
  } catch (error) {
    const err = error as Error;
    handleError(error, 'handleGetResultsList: Failed to collect results', undefined);
    return { success: false, error: err.message };
  }
}

/**
 * Handle jump-to-match action
 */
export function handleJumpToMatch(
  message: JumpToMatchMessage,
  context: MessageHandlerContext
): SearchResponse {
  const result = navigateToMatch(message.index, context.stateManager);
  return {
    success: true,
    currentIndex: result.currentIndex,
    totalMatches: result.totalMatches,
  };
}
