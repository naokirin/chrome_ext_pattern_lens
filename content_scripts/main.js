// Constants
const HIGHLIGHT_OVERLAY_ID = 'pattern-lens-overlay-container';
const HIGHLIGHT_CLASS = 'pattern-lens-highlight-overlay';
const CURRENT_MATCH_CLASS = 'pattern-lens-current-match';
const MINIMAP_CONTAINER_ID = 'pattern-lens-minimap-container';
// Use Unicode Private Use Area character as block boundary marker
// This character won't appear in normal text and won't be matched by user regex accidentally
const BLOCK_BOUNDARY_MARKER = '\uE000';

// Store ranges and elements for cleanup
let highlightData = {
  ranges: [],
  elements: [],
  overlays: []
};

// Current match navigation
let currentMatchIndex = -1;

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
function createOverlay(rect, scrollX, scrollY, isCurrent = false) {
  const overlay = document.createElement('div');
  overlay.className = isCurrent ? `${HIGHLIGHT_CLASS} ${CURRENT_MATCH_CLASS}` : HIGHLIGHT_CLASS;

  // Add padding to make the highlight more visible
  const padding = 2;
  const borderWidth = 1;

  // Different colors for current match
  const bgColor = isCurrent ? 'rgba(255, 152, 0, 0.5)' : 'rgba(255, 235, 59, 0.4)';
  const borderColor = isCurrent ? 'rgba(255, 87, 34, 0.9)' : 'rgba(255, 193, 7, 0.8)';

  overlay.style.cssText = `
    position: absolute;
    left: ${rect.left + scrollX - padding}px;
    top: ${rect.top + scrollY - padding}px;
    width: ${rect.width + (padding * 2)}px;
    height: ${rect.height + (padding * 2)}px;
    background-color: ${bgColor};
    border: ${borderWidth}px solid ${borderColor};
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
  highlightData.ranges.forEach((range, index) => {
    const rects = range.getClientRects();
    const mergedRects = mergeAdjacentRects(rects);
    const isCurrent = (index === currentMatchIndex);
    for (let i = 0; i < mergedRects.length; i++) {
      const overlay = createOverlay(mergedRects[i], scrollX, scrollY, isCurrent);
      container.appendChild(overlay);
      highlightData.overlays.push(overlay);
    }
  });

  highlightData.elements.forEach(element => {
    const rects = element.getClientRects();
    const mergedRects = mergeAdjacentRects(rects);
    for (let i = 0; i < mergedRects.length; i++) {
      const overlay = createOverlay(mergedRects[i], scrollX, scrollY);
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
  currentMatchIndex = -1;

  // Remove minimap
  removeMinimap();
}

// Get or create minimap container
function getMinimapContainer() {
  let container = document.getElementById(MINIMAP_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = MINIMAP_CONTAINER_ID;
    document.body.appendChild(container);
  }
  // Apply styles every time to handle resize
  applyMinimapStyles(container);
  return container;
}

// Apply styles to minimap container
function applyMinimapStyles(container) {
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  container.style.cssText = `
    position: fixed;
    top: 0;
    right: ${scrollbarWidth}px;
    width: 12px;
    height: 100vh;
    z-index: 2147483646;
    pointer-events: none;
    background-color: rgba(0, 0, 0, 0.05);
  `;
}

// Update minimap with current matches
function updateMinimap() {
  const container = getMinimapContainer();
  container.innerHTML = '';

  if (highlightData.ranges.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';

  const pageHeight = document.documentElement.scrollHeight;

  highlightData.ranges.forEach((range, index) => {
    const marker = document.createElement('div');

    try {
      const rect = range.getBoundingClientRect();
      const absoluteTop = rect.top + window.scrollY;
      const relativeTop = (absoluteTop / pageHeight) * 100;

      const isActive = index === currentMatchIndex;

      marker.style.cssText = `
        position: absolute;
        top: ${relativeTop}%;
        left: 0;
        width: 100%;
        height: 4px;
        background-color: ${isActive ? 'rgba(255, 87, 34, 0.9)' : 'rgba(255, 193, 7, 0.8)'};
        border-radius: 1px;
      `;

      container.appendChild(marker);
    } catch (error) {
      console.warn('[Pattern Lens] Failed to create minimap marker:', error);
    }
  });
}

// Remove minimap from page
function removeMinimap() {
  const container = document.getElementById(MINIMAP_CONTAINER_ID);
  if (container) {
    container.remove();
  }
}

// Navigate to a specific match index
function navigateToMatch(index) {
  const totalMatches = highlightData.ranges.length;

  if (totalMatches === 0) {
    return { currentIndex: -1, totalMatches: 0 };
  }

  // Normalize index (wrap around)
  if (index < 0) {
    index = totalMatches - 1;
  } else if (index >= totalMatches) {
    index = 0;
  }

  currentMatchIndex = index;

  // Update overlay colors
  updateOverlayPositions();

  // Update minimap
  updateMinimap();

  // Scroll to the current match
  const currentRange = highlightData.ranges[currentMatchIndex];
  if (currentRange) {
    try {
      // Get the parent element to scroll to
      const element = currentRange.startContainer.parentElement;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (error) {
      console.warn('[Pattern Lens] Failed to scroll to match:', error);
    }
  }

  return { currentIndex: currentMatchIndex, totalMatches: totalMatches };
}

// Helper: Check if element is block-level
function isBlockLevel(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  // Always treat these as inline elements regardless of CSS
  const inlineElements = ['SPAN', 'STRONG', 'EM', 'B', 'I', 'CODE', 'KBD', 'SAMP', 'VAR', 'A', 'ABBR', 'CITE', 'Q', 'MARK', 'SMALL', 'SUB', 'SUP'];
  if (inlineElements.includes(element.tagName)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  const display = style.display;
  return ['block', 'flex', 'grid', 'list-item', 'table', 'table-row', 'table-cell', 'flow-root'].includes(display);
}

// Helper: Find the nearest block-level ancestor
function getNearestBlockAncestor(node) {
  let current = node;
  while (current && current !== document.body) {
    if (current.nodeType === Node.ELEMENT_NODE && isBlockLevel(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return document.body;
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

    // 1. Handle element boundaries (insert marker when crossing block boundaries)
    if (lastVisibleNode) {
      // Find the nearest block-level ancestor for both nodes
      const prevBlock = getNearestBlockAncestor(lastVisibleNode);
      const currentBlock = getNearestBlockAncestor(currentNode);

      // Insert boundary marker if we're moving to a different block element
      if (prevBlock !== currentBlock) {
        if (!virtualText.endsWith(BLOCK_BOUNDARY_MARKER)) {
          virtualText += BLOCK_BOUNDARY_MARKER;
          // Mark this as block boundary (not from original DOM)
          charMap.push({ node: null, offset: -1, type: 'block-boundary' });
        }
      }
    }

    // 2. Process text content WITHOUT normalization for regex support
    const text = currentNode.nodeValue;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      virtualText += char;
      charMap.push({ node: currentNode, offset: i });
    }

    lastVisibleNode = currentNode;
  }

  return { virtualText, charMap };
}

// Search for matches in virtual text
function searchInVirtualText(query, virtualText, useRegex, caseSensitive) {
  const matches = [];

  if (useRegex) {
    // Use user's regex pattern with dotAll flag for multiline matching
    // Replace '.' with pattern that excludes block boundary marker
    try {
      // Replace . with [^\uE000] to prevent matching across block boundaries
      // Handle escaped dots (\.) separately - they should match literal dots
      const modifiedQuery = query.replace(/\\\./g, '\x00ESCAPED_DOT\x00')  // Temporarily replace \. (literal dot)
                                  .replace(/\./g, `[^${BLOCK_BOUNDARY_MARKER}\n]`)  // Replace . with [^boundary] (excluding newlines too)
                                  .replace(/\x00ESCAPED_DOT\x00/g, '\\.');  // Restore \.

      console.log('[Pattern Lens] Modified regex pattern:', modifiedQuery);
      // Use 'g' or 'gi' flags based on case-sensitivity (not 's') so that . does not match newlines
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(modifiedQuery, flags);
      let match;
      while ((match = regex.exec(virtualText)) !== null) {
        // Filter out matches that cross block boundaries
        const matchedText = match[0];
        const hasBoundary = matchedText.includes(BLOCK_BOUNDARY_MARKER);

        if (hasBoundary) {
          console.log('[Pattern Lens] Filtered match (crosses boundary):',
            matchedText.replace(/\uE000/g, '[BOUNDARY]'));
        } else {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
          });
        }
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
    // Normal search: escape regex special characters, then convert spaces to \s+ for flexible matching
    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalizedQuery = escapedQuery.replace(/\s+/g, '\\s+');
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(normalizedQuery, flags);
    let match;
    while ((match = regex.exec(virtualText)) !== null) {
      // Filter out matches that cross block boundaries
      const matchedText = match[0];
      if (!matchedText.includes(BLOCK_BOUNDARY_MARKER)) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }

  return matches;
}

// Merge adjacent rectangles on the same line
function mergeAdjacentRects(rectList, tolerance = 1) {
  if (!rectList || rectList.length === 0) {
    return [];
  }

  const rects = Array.from(rectList);

  // 1. Group rectangles by line (using rounded y coordinate)
  const lines = new Map();
  rects.forEach(rect => {
    // Round y coordinate to absorb small pixel differences
    const lineY = Math.round(rect.y);
    if (!lines.has(lineY)) {
      lines.set(lineY, []);
    }
    lines.get(lineY).push(rect);
  });

  const mergedRects = [];

  for (const line of lines.values()) {
    // 2. Sort rectangles in each line by x coordinate (left to right)
    line.sort((a, b) => a.left - b.left);

    // 3. Merge adjacent rectangles
    let currentRect = line[0];
    for (let i = 1; i < line.length; i++) {
      const nextRect = line[i];
      // If the gap between current rect's right edge and next rect's left edge is within tolerance, merge them
      if (nextRect.left - currentRect.right <= tolerance) {
        // Create new merged rectangle
        const top = Math.min(currentRect.top, nextRect.top);
        const bottom = Math.max(currentRect.bottom, nextRect.bottom);
        currentRect = new DOMRect(
          currentRect.left,
          top,
          nextRect.right - currentRect.left, // width
          bottom - top // height
        );
      } else {
        // Not adjacent, add current rect to results and move to next
        mergedRects.push(currentRect);
        currentRect = nextRect;
      }
    }
    // Add the last rectangle
    mergedRects.push(currentRect);
  }

  return mergedRects;
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

    // Skip block boundary markers (auto-inserted markers between block elements)
    if (!startCharInfo.node || !endCharInfo.node) {
      console.warn('Match includes block boundary marker, skipping');
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
function searchText(query, useRegex, caseSensitive) {
  let count = 0;
  const container = initializeOverlayContainer();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // Step 1: Create virtual text layer with character-level mapping
  const { virtualText, charMap } = createVirtualTextAndMap();

  // Debug: log virtual text to console (with visible boundary markers)
  const visibleVirtualText = virtualText.replace(/\uE000/g, '[BOUNDARY]');
  console.log('[Pattern Lens] Virtual text:', visibleVirtualText);
  console.log('[Pattern Lens] Virtual text length:', virtualText.length);
  console.log('[Pattern Lens] Query:', query);

  // Step 2: Search in virtual text
  const matches = searchInVirtualText(query, virtualText, useRegex, caseSensitive);
  console.log('[Pattern Lens] Matches found:', matches.length);

  // Step 3: Convert virtual matches to DOM ranges and create overlays
  matches.forEach((match) => {
    const range = createRangeFromVirtualMatch(match, charMap);
    if (!range) return;

    try {
      // Get rectangles for this range
      const rects = range.getClientRects();

      // Merge adjacent rectangles to avoid overlapping overlays
      const mergedRects = mergeAdjacentRects(rects);

      // Create overlay for each merged rectangle (handles multi-line matches)
      const isCurrent = (count === 0); // First match is current
      for (let i = 0; i < mergedRects.length; i++) {
        const overlay = createOverlay(mergedRects[i], scrollX, scrollY, isCurrent);
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

    // Navigate to first match
    const navResult = navigateToMatch(0);
    return { count: count, currentIndex: navResult.currentIndex, totalMatches: navResult.totalMatches };
  }

  return { count: 0, currentIndex: -1, totalMatches: 0 };
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
        const mergedRects = mergeAdjacentRects(rects);

        for (let i = 0; i < mergedRects.length; i++) {
          const overlay = createOverlay(mergedRects[i], scrollX, scrollY);
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
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'search') {
    try {
      clearHighlights();

      if (request.useElementSearch) {
        const count = searchElements(request.query, request.elementSearchMode);
        sendResponse({ success: true, count: count, currentIndex: -1, totalMatches: count });
      } else {
        const result = searchText(request.query, request.useRegex, request.caseSensitive);
        sendResponse({
          success: true,
          count: result.count,
          currentIndex: result.currentIndex,
          totalMatches: result.totalMatches
        });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  } else if (request.action === 'clear') {
    clearHighlights();
    sendResponse({ success: true });
  } else if (request.action === 'navigate-next') {
    const result = navigateToMatch(currentMatchIndex + 1);
    sendResponse({ success: true, currentIndex: result.currentIndex, totalMatches: result.totalMatches });
  } else if (request.action === 'navigate-prev') {
    const result = navigateToMatch(currentMatchIndex - 1);
    sendResponse({ success: true, currentIndex: result.currentIndex, totalMatches: result.totalMatches });
  }

  return true; // Keep the message channel open for async response
});
