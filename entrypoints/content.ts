import { DOMSearchObserver } from '~/lib/observers/domObserver';
import { updateOverlayPositions } from '~/lib/highlight/overlay';
import { routeMessage } from '~/lib/messaging/router';
import { SearchStateManager } from '~/lib/state/searchState';
// Import shared type definitions
import type { Message, Settings } from '~/lib/types';

// State management instance
const stateManager = new SearchStateManager();

// Track event listener registration state (managed by overlay module)
let updateCallback: (() => void) | null = null;

// DOM observer for automatic search updates
let domObserver: DOMSearchObserver = new DOMSearchObserver(stateManager, { enabled: true });

// Load settings and update DOM observer
function initializeDOMObserver(): void {
  chrome.storage.sync.get({ autoUpdateSearch: true }, (items) => {
    const settings = items as Settings;
    const enabled = settings.autoUpdateSearch ?? true;
    domObserver.updateOptions({ enabled });
  });
}

// WXT Content Script
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Create update callback that will be used by event listeners
    updateCallback = () => updateOverlayPositions(stateManager);

    // Initialize DOM observer with settings
    initializeDOMObserver();

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes.autoUpdateSearch) {
        // Settings changed, update observer options
        const enabled = changes.autoUpdateSearch.newValue ?? true;
        domObserver.updateOptions({ enabled });
      }
    });

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
