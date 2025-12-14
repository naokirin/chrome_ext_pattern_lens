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

// Helper: Check if element is block-level
function isBlockLevel(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }
  const style = window.getComputedStyle(element);
  const display = style.display;
  return ['block', 'flex', 'grid', 'list-item', 'table', 'table-row', 'table-cell', 'flow-root'].includes(display);
}

// Helper: Check if element is visible
function isVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

// Create virtual text layer with character-level mapping (Chrome-like innerText behavior)
function createVirtualTextAndMap() {
  let virtualText = '';
  const charMap = []; // Array of { node: TextNode, offset: number } for each character in virtualText
  let lastVisibleNode = null;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        // Skip script, style, overlay container
        if (
          !parent ||
          parent.tagName === 'SCRIPT' ||
          parent.tagName === 'STYLE' ||
          parent.id === HIGHLIGHT_OVERLAY_ID ||
          parent.closest(`#${HIGHLIGHT_OVERLAY_ID}`)
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip invisible elements
        if (!isVisible(parent)) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip completely empty text nodes (but keep whitespace-only nodes)
        if (!node.nodeValue || node.nodeValue.length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  while (walker.nextNode()) {
    const currentNode = walker.currentNode;
    const currentParent = currentNode.parentElement;

    // 1. Handle element boundaries (insert space only at block element boundaries)
    if (lastVisibleNode) {
      const prevParent = lastVisibleNode.parentElement;

      // If different parents, determine if space should be inserted
      if (prevParent !== currentParent) {
        const prevIsBlock = isBlockLevel(prevParent);
        const currentIsBlock = isBlockLevel(currentParent);

        // Insert space only if either element is block-level
        if (prevIsBlock || currentIsBlock) {
          if (!virtualText.endsWith(' ')) {
            virtualText += ' ';
            // Mark this space as synthetic (not from original DOM)
            charMap.push({ node: null, offset: -1 });
          }
        }
      }
    }

    // 2. Process text content with normalization
    const text = currentNode.nodeValue;
    let lastCharWasSpace = virtualText.endsWith(' ');

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const isWhitespace = /\s/.test(char);

      if (isWhitespace) {
        // Normalize: collapse consecutive whitespace into single space
        if (!lastCharWasSpace) {
          virtualText += ' ';
          charMap.push({ node: currentNode, offset: i });
          lastCharWasSpace = true;
        }
        // Skip additional whitespace characters (they're normalized away)
      } else {
        // Regular character
        virtualText += char;
        charMap.push({ node: currentNode, offset: i });
        lastCharWasSpace = false;
      }
    }

    lastVisibleNode = currentNode;
  }

  return { virtualText, charMap };
}

// Search for matches in virtual text
function searchInVirtualText(query, virtualText, useRegex) {
  const matches = [];

  if (useRegex) {
    // Use user's regex pattern directly
    try {
      const regex = new RegExp(query, 'gi');
      let match;
      while ((match = regex.exec(virtualText)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
        });
        // Prevent infinite loop on zero-length matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    } catch (error) {
      console.warn('Invalid regex pattern:', error);
      return matches;
    }
  } else {
    // Normal search: convert spaces in query to \s+ for flexible matching
    const normalizedQuery = query.trim().replace(/\s+/g, '\\s+');
    const regex = new RegExp(normalizedQuery, 'gi');
    let match;
    while ((match = regex.exec(virtualText)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return matches;
}

// Create DOM Range from virtual text match using character-level mapping
function createRangeFromVirtualMatch(match, charMap) {
  try {
    // Get character mapping for start and end positions
    const startCharInfo = charMap[match.start];
    const endCharInfo = charMap[match.end - 1]; // end is exclusive, so use end-1

    if (!startCharInfo || !endCharInfo) {
      console.warn('Character mapping not found for match:', match);
      return null;
    }

    // Skip synthetic spaces (auto-inserted spaces between elements)
    if (!startCharInfo.node || !endCharInfo.node) {
      console.warn('Match includes synthetic space, skipping');
      return null;
    }

    const range = document.createRange();

    // Set start position
    range.setStart(startCharInfo.node, startCharInfo.offset);

    // Set end position (offset + 1 because Range.setEnd is exclusive)
    range.setEnd(endCharInfo.node, endCharInfo.offset + 1);

    return range;
  } catch (error) {
    console.warn('Failed to create range:', error);
    return null;
  }
}

// Search and highlight text using virtual text layer and overlay
function searchText(query, useRegex) {
  let count = 0;
  const container = initializeOverlayContainer();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // Step 1: Create virtual text layer with character-level mapping
  const { virtualText, charMap } = createVirtualTextAndMap();

  // Debug: log virtual text to console
  console.log('[Pattern Lens] Virtual text:', virtualText);
  console.log('[Pattern Lens] Query:', query);

  // Step 2: Search in virtual text
  const matches = searchInVirtualText(query, virtualText, useRegex);
  console.log('[Pattern Lens] Matches found:', matches.length);

  // Step 3: Convert virtual matches to DOM ranges and create overlays
  matches.forEach((match) => {
    const range = createRangeFromVirtualMatch(match, charMap);
    if (!range) return;

    try {
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
      console.warn('Failed to create overlay for range:', error);
    }
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
