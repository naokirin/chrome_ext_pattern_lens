/**
 * Utility functions for Chrome tabs
 */

/**
 * Check if a URL is a special page where content scripts cannot run
 * @param url - The URL to check
 * @returns true if the URL is a special page
 */
export function isSpecialPage(url: string | undefined): boolean {
  return (
    (url?.startsWith('chrome://') ||
      url?.startsWith('chrome-extension://') ||
      url?.startsWith('https://chrome.google.com/webstore')) ??
    false
  );
}

/**
 * Get the active tab in the current window
 * @returns The active tab with ID, or null if not found or has no ID
 */
export async function getActiveTab(): Promise<(chrome.tabs.Tab & { id: number }) | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ? (tab as chrome.tabs.Tab & { id: number }) : null;
}

/**
 * Check if content script is loaded by sending a ping message
 * @param tabId - The tab ID to check
 * @returns Promise that resolves to true if content script is loaded, false otherwise
 */
export function isContentScriptLoaded(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, (_response) => {
      if (chrome.runtime.lastError) {
        // Content script is not loaded
        resolve(false);
      } else {
        // Content script is loaded
        resolve(true);
      }
    });
  });
}

/**
 * Inject content script into a tab
 * @param tabId - The tab ID to inject the script into
 * @returns Promise that resolves when injection is complete
 */
export async function injectContentScript(tabId: number): Promise<void> {
  try {
    // WXT builds entrypoints/content.ts to content-scripts/content.js
    // Use chrome.scripting.executeScript to inject the content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/content.js'],
    });
  } catch (error) {
    // If injection fails, throw the error
    throw new Error(
      `Failed to inject content script: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
