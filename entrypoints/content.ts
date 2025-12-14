import { removeMinimap } from '~/lib/highlight/minimap';
import {
  clearHighlights,
  removeEventListeners,
  updateOverlayPositions,
} from '~/lib/highlight/overlay';
import { navigateToMatch } from '~/lib/navigation/navigator';
import { searchElements } from '~/lib/search/elementSearch';
import { searchText } from '~/lib/search/textSearch';
import { SearchStateManager } from '~/lib/state/searchState';
// Import shared type definitions
import type { SearchMessage, SearchResponse, StateResponse } from '~/lib/types';

// State management instance
const stateManager = new SearchStateManager();

// Track event listener registration state (managed by overlay module)
let updateCallback: (() => void) | null = null;

// WXT Content Script
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Create update callback that will be used by event listeners
    updateCallback = () => updateOverlayPositions(stateManager);

    // Handle messages from popup
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.action === 'search') {
        try {
          // Clear previous highlights
          if (updateCallback) {
            clearHighlights(stateManager, removeMinimap, updateCallback);
          }

          const searchMessage = request as SearchMessage;

          // Save search state
          stateManager.updateSearchState({
            query: searchMessage.query,
            useRegex: searchMessage.useRegex,
            caseSensitive: searchMessage.caseSensitive,
            useElementSearch: searchMessage.useElementSearch,
            elementSearchMode: searchMessage.elementSearchMode,
          });

          if (searchMessage.useElementSearch) {
            const result = searchElements(
              searchMessage.query,
              searchMessage.elementSearchMode,
              stateManager
            );
            sendResponse({
              success: true,
              count: result.count,
              currentIndex: result.currentIndex,
              totalMatches: result.totalMatches,
            } as SearchResponse);
          } else {
            const result = searchText(
              searchMessage.query,
              searchMessage.useRegex,
              searchMessage.caseSensitive,
              stateManager
            );
            sendResponse({
              success: true,
              count: result.count,
              currentIndex: result.currentIndex,
              totalMatches: result.totalMatches,
            } as SearchResponse);
          }
        } catch (error) {
          const err = error as Error;
          sendResponse({ success: false, error: err.message } as SearchResponse);
        }
      } else if (request.action === 'clear') {
        if (updateCallback) {
          clearHighlights(stateManager, removeMinimap, updateCallback);
        }
        // Clear search state
        stateManager.updateSearchState({
          query: '',
          useRegex: false,
          caseSensitive: false,
          useElementSearch: false,
          elementSearchMode: 'css',
        });
        sendResponse({ success: true } as SearchResponse);
      } else if (request.action === 'navigate-next') {
        const result = navigateToMatch(stateManager.currentIndex + 1, stateManager);
        sendResponse({
          success: true,
          currentIndex: result.currentIndex,
          totalMatches: result.totalMatches,
        } as SearchResponse);
      } else if (request.action === 'navigate-prev') {
        const result = navigateToMatch(stateManager.currentIndex - 1, stateManager);
        sendResponse({
          success: true,
          currentIndex: result.currentIndex,
          totalMatches: result.totalMatches,
        } as SearchResponse);
      } else if (request.action === 'get-state') {
        // Return current search state (support both text and element search)
        sendResponse({
          success: true,
          state: stateManager.searchState,
          currentIndex: stateManager.currentIndex,
          totalMatches: stateManager.totalMatches,
        } as StateResponse);
      }

      return true; // Keep the message channel open for async response
    });
  },
});
