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
