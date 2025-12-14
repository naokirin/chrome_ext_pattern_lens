// Constants
const HIGHLIGHT_OVERLAY_ID = 'pattern-lens-overlay-container';
const HIGHLIGHT_CLASS = 'pattern-lens-highlight-overlay';

// Store ranges and elements for cleanup
let highlightData = {
  ranges: [],
  elements: [],
  overlays: []
};

// Initialize overlay container
function initializeOverlayContainer() {
  let container = document.getElementById(HIGHLIGHT_OVERLAY_ID);

  if (!container) {
    container = document.createElement('div');
    container.id = HIGHLIGHT_OVERLAY_ID;
    container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483647;
    `;
    document.body.appendChild(container);
  }

  return container;
}

// Create overlay element for a rectangle
function createOverlay(rect, scrollX, scrollY) {
  const overlay = document.createElement('div');
  overlay.className = HIGHLIGHT_CLASS;

  // Add padding to make the highlight more visible
  const padding = 2;
  const borderWidth = 1;

  overlay.style.cssText = `
    position: absolute;
    left: ${rect.left + scrollX - padding}px;
    top: ${rect.top + scrollY - padding}px;
    width: ${rect.width + (padding * 2)}px;
    height: ${rect.height + (padding * 2)}px;
    background-color: rgba(255, 235, 59, 0.4);
    border: ${borderWidth}px solid rgba(255, 193, 7, 0.8);
    border-radius: 2px;
    pointer-events: none;
    box-sizing: border-box;
  `;
  return overlay;
}

// Update overlay positions (for scroll/resize events)
function updateOverlayPositions() {
  const container = document.getElementById(HIGHLIGHT_OVERLAY_ID);
  if (!container) return;

  // Clear existing overlays
  container.innerHTML = '';
  highlightData.overlays = [];

  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // Recreate overlays from stored ranges and elements
  highlightData.ranges.forEach(range => {
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const overlay = createOverlay(rects[i], scrollX, scrollY);
      container.appendChild(overlay);
      highlightData.overlays.push(overlay);
    }
  });

  highlightData.elements.forEach(element => {
    const rects = element.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const overlay = createOverlay(rects[i], scrollX, scrollY);
      container.appendChild(overlay);
      highlightData.overlays.push(overlay);
    }
  });
}

// Remove all highlights
function clearHighlights() {
  // Remove overlay container
  const container = document.getElementById(HIGHLIGHT_OVERLAY_ID);
  if (container) {
    container.remove();
  }

  // Remove event listeners
  window.removeEventListener('scroll', updateOverlayPositions);
  window.removeEventListener('resize', updateOverlayPositions);

  // Clear stored data
  highlightData = {
    ranges: [],
    elements: [],
    overlays: []
  };
}

// Search and highlight text using Range and overlay
function searchText(query, useRegex) {
  let count = 0;
  const pattern = useRegex ? new RegExp(query, 'gi') : null;
  const container = initializeOverlayContainer();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip script, style, and overlay container
        const parent = node.parentElement;
        if (
          !parent ||
          parent.tagName === 'SCRIPT' ||
          parent.tagName === 'STYLE' ||
          parent.id === HIGHLIGHT_OVERLAY_ID ||
          parent.closest(`#${HIGHLIGHT_OVERLAY_ID}`)
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const nodesToProcess = [];
  let currentNode;

  while ((currentNode = walker.nextNode())) {
    nodesToProcess.push(currentNode);
  }

  nodesToProcess.forEach((node) => {
    const text = node.nodeValue;
    if (!text || text.trim().length === 0) return;

    let matches = [];

    if (useRegex && pattern) {
      let match;
      // Reset regex state
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    } else {
      const lowerText = text.toLowerCase();
      const lowerQuery = query.toLowerCase();
      let pos = lowerText.indexOf(lowerQuery);
      while (pos !== -1) {
        matches.push({
          start: pos,
          end: pos + query.length,
        });
        pos = lowerText.indexOf(lowerQuery, pos + 1);
      }
    }

    // Create ranges and overlays for each match
    matches.forEach((match) => {
      try {
        const range = document.createRange();
        range.setStart(node, match.start);
        range.setEnd(node, match.end);

        // Get rectangles for this range
        const rects = range.getClientRects();

        // Create overlay for each rectangle (handles multi-line matches)
        for (let i = 0; i < rects.length; i++) {
          const overlay = createOverlay(rects[i], scrollX, scrollY);
          container.appendChild(overlay);
          highlightData.overlays.push(overlay);
        }

        // Store range for position updates
        highlightData.ranges.push(range);
        count++;
      } catch (error) {
        console.warn('Failed to create range for match:', error);
      }
    });
  });

  // Add event listeners for scroll and resize
  if (count > 0) {
    window.addEventListener('scroll', updateOverlayPositions, { passive: true });
    window.addEventListener('resize', updateOverlayPositions, { passive: true });
  }

  return count;
}

// Search elements by CSS selector or XPath using overlay
function searchElements(query, mode) {
  const container = initializeOverlayContainer();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  let elements = [];

  try {
    if (mode === 'css') {
      elements = Array.from(document.querySelectorAll(query));
    } else if (mode === 'xpath') {
      const result = document.evaluate(
        query,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      for (let i = 0; i < result.snapshotLength; i++) {
        elements.push(result.snapshotItem(i));
      }
    }

    // Filter out overlay container and its children
    elements = elements.filter(el => {
      return el.id !== HIGHLIGHT_OVERLAY_ID &&
             !el.closest(`#${HIGHLIGHT_OVERLAY_ID}`);
    });

    // Create overlays for each element
    elements.forEach((element) => {
      if (element.nodeType === Node.ELEMENT_NODE) {
        const rects = element.getClientRects();

        for (let i = 0; i < rects.length; i++) {
          const overlay = createOverlay(rects[i], scrollX, scrollY);
          container.appendChild(overlay);
          highlightData.overlays.push(overlay);
        }

        // Store element for position updates
        highlightData.elements.push(element);
      }
    });

    // Add event listeners for scroll and resize
    if (elements.length > 0) {
      window.addEventListener('scroll', updateOverlayPositions, { passive: true });
      window.addEventListener('resize', updateOverlayPositions, { passive: true });
    }

    return elements.length;
  } catch (error) {
    throw new Error(`Invalid ${mode === 'css' ? 'CSS selector' : 'XPath'}: ${error.message}`);
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'search') {
    try {
      clearHighlights();

      let count = 0;

      if (request.useElementSearch) {
        count = searchElements(request.query, request.elementSearchMode);
      } else {
        count = searchText(request.query, request.useRegex);
      }

      sendResponse({ success: true, count: count });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  } else if (request.action === 'clear') {
    clearHighlights();
    sendResponse({ success: true });
  }

  return true; // Keep the message channel open for async response
});
