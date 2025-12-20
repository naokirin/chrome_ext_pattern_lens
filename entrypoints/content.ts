import { updateOverlayPositions } from '~/lib/highlight/overlay';
import { routeMessage } from '~/lib/messaging/router';
import { DOMSearchObserver } from '~/lib/observers/domObserver';
import { SearchStateManager } from '~/lib/state/searchState';
// Import shared type definitions
import type { Message, OpenPopupMessage, Settings } from '~/lib/types';

// State management instance
const stateManager = new SearchStateManager();

// Track event listener registration state (managed by overlay module)
let updateCallback: (() => void) | null = null;

// DOM observer for automatic search updates
const domObserver: DOMSearchObserver = new DOMSearchObserver(stateManager, { enabled: true });

// Load settings and update DOM observer
function initializeDOMObserver(): void {
  chrome.storage.sync.get({ autoUpdateSearch: true }, (items) => {
    const settings = items as Settings;
    const enabled = settings.autoUpdateSearch ?? true;
    domObserver.updateOptions({ enabled });
  });
}

// Keyboard intercept handler
let keyboardInterceptHandler: ((event: KeyboardEvent) => void) | null = null;

// Setup keyboard intercept for Ctrl+F (Cmd+F on macOS)
function setupKeyboardIntercept(): void {
  // Remove existing handler if any
  if (keyboardInterceptHandler) {
    document.removeEventListener('keydown', keyboardInterceptHandler, true);
    keyboardInterceptHandler = null;
  }

  // Load settings
  chrome.storage.sync.get({ overrideCtrlF: false }, (items) => {
    const settings = items as Settings;
    const enabled = settings.overrideCtrlF ?? false;

    if (enabled) {
      keyboardInterceptHandler = (event: KeyboardEvent) => {
        // Ctrl+F (Windows/Linux) または Cmd+F (macOS)
        if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          // Background Scriptにメッセージを送信
          const message: OpenPopupMessage = { action: 'open-popup' };
          chrome.runtime.sendMessage(message).catch((error) => {
            console.error('Failed to send message to background:', error);
          });
        }
      };

      // キャプチャフェーズでインターセプト（早期にイベントを取得）
      document.addEventListener('keydown', keyboardInterceptHandler, true);
    }
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

    // Setup keyboard intercept for Ctrl+F
    setupKeyboardIntercept();

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        if (changes.autoUpdateSearch) {
          // Settings changed, update observer options
          const enabled = changes.autoUpdateSearch.newValue ?? true;
          domObserver.updateOptions({ enabled });
        }
        if (changes.overrideCtrlF) {
          // Ctrl+F override setting changed, re-setup keyboard intercept
          setupKeyboardIntercept();
        }
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
