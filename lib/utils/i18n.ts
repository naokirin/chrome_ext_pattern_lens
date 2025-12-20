/**
 * i18n utility functions for Chrome Extension
 * Handles localization of HTML elements using chrome.i18n API
 */

/**
 * Initialize i18n for all elements with data-i18n attributes
 * Should be called on DOMContentLoaded
 */
export function initializeI18n(): void {
  // Replace text content with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (key) {
      const message = chrome.i18n.getMessage(key);
      if (message) {
        element.textContent = message;
      }
    }
  });

  // Replace placeholder attribute with data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (key) {
      const message = chrome.i18n.getMessage(key);
      if (message) {
        element.setAttribute('placeholder', message);
      }
    }
  });

  // Replace title attribute with data-i18n-title
  document.querySelectorAll('[data-i18n-title]').forEach((element) => {
    const key = element.getAttribute('data-i18n-title');
    if (key) {
      const message = chrome.i18n.getMessage(key);
      if (message) {
        element.setAttribute('title', message);
      }
    }
  });
}

/**
 * Get a localized message by key
 * @param key - Message key from messages.json
 * @param substitutions - Optional substitution strings
 * @returns Localized message
 */
export function getMessage(key: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(key, substitutions);
}
