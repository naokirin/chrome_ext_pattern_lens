import { DOMSearchObserver } from '~/lib/observers/domObserver';
import { updateOverlayPositions } from '~/lib/highlight/overlay';
import { routeMessage } from '~/lib/messaging/router';
import { SearchStateManager } from '~/lib/state/searchState';
// Import shared type definitions
import type { Message } from '~/lib/types';

// State management instance
const stateManager = new SearchStateManager();

// Track event listener registration state (managed by overlay module)
let updateCallback: (() => void) | null = null;

// DOM observer for automatic search updates
const domObserver = new DOMSearchObserver(stateManager);

// WXT Content Script
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Create update callback that will be used by event listeners
    updateCallback = () => updateOverlayPositions(stateManager);

    // Handle messages from popup
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      // Route message to appropriate handler
      routeMessage(request as Message, {
        stateManager,
        updateCallback,
        domObserver,
      }).then((response) => {
        if (response) {
          sendResponse(response);
        }
      });

      return true; // Keep the message channel open for async response
    });
  },
});
