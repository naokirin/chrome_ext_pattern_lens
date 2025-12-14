/**
 * Create a DOM structure from HTML string
 * @param {string} html - HTML string
 * @returns {HTMLElement} - Root element
 */
export function createDOMFromHTML(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
}

/**
 * Clean up DOM after test
 */
export function cleanupDOM() {
  document.body.innerHTML = '';
}

/**
 * Get text content with block boundary markers visible
 * @param {string} text - Text with \uE000 markers
 * @returns {string} - Text with [BOUNDARY] visible
 */
export function visualizeBoundaries(text) {
  return text.replace(/\uE000/g, '[BOUNDARY]');
}
