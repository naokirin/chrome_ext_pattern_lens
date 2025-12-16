/**
 * Message handlers for content script
 */
import { removeMinimap } from '~/lib/highlight/minimap';
import { clearHighlights } from '~/lib/highlight/overlay';
import { navigateToMatch } from '~/lib/navigation/navigator';
import { searchElements } from '~/lib/search/elementSearch';
import { searchText } from '~/lib/search/textSearch';
import type { SearchStateManager } from '~/lib/state/searchState';
import type {
  ClearMessage,
  GetStateMessage,
  NavigateMessage,
  SearchMessage,
  SearchResponse,
  StateResponse,
} from '~/lib/types';
import { handleError } from '~/lib/utils/errorHandler';

/**
 * Context for message handlers
 */
export interface MessageHandlerContext {
  stateManager: SearchStateManager;
  updateCallback: (() => void) | null;
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

    // Save search state
    context.stateManager.updateSearchState({
      query: message.query,
      useRegex: message.useRegex,
      caseSensitive: message.caseSensitive,
      useElementSearch: message.useElementSearch,
      elementSearchMode: message.elementSearchMode,
      useFuzzy: message.useFuzzy,
    });

    if (message.useElementSearch) {
      const result = searchElements(message.query, message.elementSearchMode, context.stateManager);
      return {
        success: true,
        count: result.count,
        currentIndex: result.currentIndex,
        totalMatches: result.totalMatches,
      };
    }
    const result = searchText(
      message.query,
      message.useRegex,
      message.caseSensitive,
      context.stateManager,
      message.useFuzzy
    );
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
