// Import shared type definitions
import type {
  SearchMessage,
  ClearMessage,
  NavigateMessage,
  GetStateMessage,
  Message,
  SearchResponse,
  StateResponse,
  Response,
  SearchState,
  HighlightData,
  CharMapEntry,
  VirtualMatch,
  NavigationResult,
  SearchResult,
} from '~/lib/types';

// Constants
const HIGHLIGHT_OVERLAY_ID = 'pattern-lens-overlay-container';
const HIGHLIGHT_CLASS = 'pattern-lens-highlight-overlay';
const CURRENT_MATCH_CLASS = 'pattern-lens-current-match';
const MINIMAP_CONTAINER_ID = 'pattern-lens-minimap-container';
// Use Unicode Private Use Area character as block boundary marker
// This character won't appear in normal text and won't be matched by user regex accidentally
const BLOCK_BOUNDARY_MARKER = '\uE000';

// Store ranges and elements for cleanup
const highlightData: HighlightData = {
  ranges: [],
  elements: [],
  overlays: []
};

// Current match navigation
let currentMatchIndex = -1;

// Store last search parameters for state restoration
let lastSearchState: SearchState = {
  query: '',
  useRegex: false,
  caseSensitive: false,
  useElementSearch: false,
  elementSearchMode: 'css'
};

// Initialize overlay container
function initializeOverlayContainer(): HTMLDivElement {
  let container = document.getElementById(HIGHLIGHT_OVERLAY_ID) as HTMLDivElement;

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
function createOverlay(rect: DOMRect, scrollX: number, scrollY: number, isCurrent = false): HTMLDivElement {
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
function updateOverlayPositions(): void {
  const container = document.getElementById(HIGHLIGHT_OVERLAY_ID) as HTMLDivElement;
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
function clearHighlights(): void {
  // Remove overlay container
  const container = document.getElementById(HIGHLIGHT_OVERLAY_ID);
  if (container) {
    container.remove();
  }

  // Remove event listeners
  window.removeEventListener('scroll', updateOverlayPositions);
  window.removeEventListener('resize', updateOverlayPositions);

  // Clear stored data
  highlightData.ranges.length = 0;
  highlightData.elements.length = 0;
  highlightData.overlays.length = 0;
  currentMatchIndex = -1;

  // Remove minimap
  removeMinimap();
}

// Get or create minimap container
function getMinimapContainer(): HTMLDivElement {
  let container = document.getElementById(MINIMAP_CONTAINER_ID) as HTMLDivElement;
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
function applyMinimapStyles(container: HTMLDivElement): void {
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
function updateMinimap(): void {
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
      // Failed to create minimap marker, silently ignore
    }
  });
}

// Remove minimap from page
function removeMinimap(): void {
  const container = document.getElementById(MINIMAP_CONTAINER_ID);
  if (container) {
    container.remove();
  }
}

// Navigate to a specific match index
function navigateToMatch(index: number): NavigationResult {
  // Support both text search (ranges) and element search (elements)
  const totalMatches = highlightData.ranges.length || highlightData.elements.length;

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

  // Update overlay colors (for text search)
  if (highlightData.ranges.length > 0) {
    updateOverlayPositions();
    updateMinimap();
  }

  // Scroll to the current match
  if (highlightData.ranges.length > 0) {
    // Text search: scroll to range
    const currentRange = highlightData.ranges[currentMatchIndex];
    if (currentRange) {
      try {
        const element = currentRange.startContainer.parentElement;
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch (error) {
        // Failed to scroll to match, silently ignore
      }
    }
  } else if (highlightData.elements.length > 0) {
    // Element search: scroll to element
    const currentElement = highlightData.elements[currentMatchIndex];
    if (currentElement) {
      try {
        currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (error) {
        // Failed to scroll to element, silently ignore
      }
    }
  }

  return { currentIndex: currentMatchIndex, totalMatches: totalMatches };
}

// Helper: Check if element is block-level
function isBlockLevel(element: Element | null): boolean {
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
function getNearestBlockAncestor(node: Node): Element {
  let current: Node | null = node;
  while (current && current !== document.body) {
    if (current.nodeType === Node.ELEMENT_NODE && isBlockLevel(current as Element)) {
      return current as Element;
    }
    current = current.parentElement;
  }
  return document.body;
}

// Helper: Check if element is visible
function isVisible(element: Element | null): boolean {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

// Create virtual text layer with character-level mapping (Chrome-like innerText behavior)
function createVirtualTextAndMap(): { virtualText: string; charMap: CharMapEntry[] } {
  let virtualText = '';
  const charMap: CharMapEntry[] = []; // Array of { node: TextNode, offset: number } for each character in virtualText
  let lastVisibleNode: Node | null = null;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node: Node) => {
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
    if (!text) continue;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      virtualText += char;
      charMap.push({ node: currentNode as Text, offset: i });
    }

    lastVisibleNode = currentNode;
  }

  return { virtualText, charMap };
}

// Search for matches in virtual text
function searchInVirtualText(query: string, virtualText: string, useRegex: boolean, caseSensitive: boolean): VirtualMatch[] {
  const matches: VirtualMatch[] = [];

  if (useRegex) {
    // Use user's regex pattern with dotAll flag for multiline matching
    // Replace '.' with pattern that excludes block boundary marker
    try {
      // Replace . with [^\uE000] to prevent matching across block boundaries
      // Handle escaped dots (\.) separately - they should match literal dots
      const modifiedQuery = query.replace(/\\\./g, '\x00ESCAPED_DOT\x00')  // Temporarily replace \. (literal dot)
        .replace(/\./g, `[^${BLOCK_BOUNDARY_MARKER}\n]`)  // Replace . with [^boundary] (excluding newlines too)
        .replace(/\x00ESCAPED_DOT\x00/g, '\\.');  // Restore \.

      // Use 'g' or 'gi' flags based on case-sensitivity (not 's') so that . does not match newlines
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(modifiedQuery, flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(virtualText)) !== null) {
        // Filter out matches that cross block boundaries
        const matchedText = match[0];
        const hasBoundary = matchedText.includes(BLOCK_BOUNDARY_MARKER);

        // Skip matches that cross block boundaries
        if (!hasBoundary) {
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
      // Invalid regex pattern, return empty matches
      return matches;
    }
  } else {
    // Normal search: escape regex special characters, then convert spaces to \s+ for flexible matching
    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalizedQuery = escapedQuery.replace(/\s+/g, '\\s+');
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(normalizedQuery, flags);
    let match: RegExpExecArray | null;
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
function mergeAdjacentRects(rectList: DOMRectList | DOMRect[], tolerance = 1): DOMRect[] {
  if (!rectList || rectList.length === 0) {
    return [];
  }

  const rects = Array.from(rectList);

  // 1. Group rectangles by line (using rounded y coordinate)
  const lines = new Map<number, DOMRect[]>();
  rects.forEach(rect => {
    // Round y coordinate to absorb small pixel differences
    const lineY = Math.round(rect.y);
    if (!lines.has(lineY)) {
      lines.set(lineY, []);
    }
    lines.get(lineY)!.push(rect);
  });

  const mergedRects: DOMRect[] = [];

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
function createRangeFromVirtualMatch(match: VirtualMatch, charMap: CharMapEntry[]): Range | null {
  try {
    // Get character mapping for start and end positions
    const startCharInfo = charMap[match.start];
    const endCharInfo = charMap[match.end - 1]; // end is exclusive, so use end-1

    if (!startCharInfo || !endCharInfo) {
      // Character mapping not found for match
      return null;
    }

    // Skip block boundary markers (auto-inserted markers between block elements)
    if (!startCharInfo.node || !endCharInfo.node) {
      // Match includes block boundary marker, skipping
      return null;
    }

    const range = document.createRange();

    // Set start position
    range.setStart(startCharInfo.node, startCharInfo.offset);

    // Set end position (offset + 1 because Range.setEnd is exclusive)
    range.setEnd(endCharInfo.node, endCharInfo.offset + 1);

    return range;
  } catch (error) {
    // Failed to create range
    return null;
  }
}

// Search and highlight text using virtual text layer and overlay
function searchText(query: string, useRegex: boolean, caseSensitive: boolean): SearchResult {
  let count = 0;
  const container = initializeOverlayContainer();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // Step 1: Create virtual text layer with character-level mapping
  const { virtualText, charMap } = createVirtualTextAndMap();

  // Step 2: Search in virtual text
  const matches = searchInVirtualText(query, virtualText, useRegex, caseSensitive);

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
      // Failed to create overlay for range, silently ignore
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
function searchElements(query: string, mode: 'css' | 'xpath'): SearchResult {
  const container = initializeOverlayContainer();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  let elements: Element[] = [];

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
        const item = result.snapshotItem(i);
        if (item && item.nodeType === Node.ELEMENT_NODE) {
          elements.push(item as Element);
        }
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

      // Navigate to first element
      const navResult = navigateToMatch(0);
      return { count: elements.length, currentIndex: navResult.currentIndex, totalMatches: navResult.totalMatches };
    }

    return { count: 0, currentIndex: -1, totalMatches: 0 };
  } catch (error) {
    const err = error as Error;
    throw new Error(`Invalid ${mode === 'css' ? 'CSS selector' : 'XPath'}: ${err.message}`);
  }
}

// WXT Content Script
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Handle messages from popup
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.action === 'search') {
        try {
          clearHighlights();

          const searchMessage = request as SearchMessage;

          // Save search state
          lastSearchState = {
            query: searchMessage.query,
            useRegex: searchMessage.useRegex,
            caseSensitive: searchMessage.caseSensitive,
            useElementSearch: searchMessage.useElementSearch,
            elementSearchMode: searchMessage.elementSearchMode
          };

          if (searchMessage.useElementSearch) {
            const result = searchElements(searchMessage.query, searchMessage.elementSearchMode);
            sendResponse({
              success: true,
              count: result.count,
              currentIndex: result.currentIndex,
              totalMatches: result.totalMatches
            } as SearchResponse);
          } else {
            const result = searchText(searchMessage.query, searchMessage.useRegex, searchMessage.caseSensitive);
            sendResponse({
              success: true,
              count: result.count,
              currentIndex: result.currentIndex,
              totalMatches: result.totalMatches
            } as SearchResponse);
          }
        } catch (error) {
          const err = error as Error;
          sendResponse({ success: false, error: err.message } as SearchResponse);
        }
      } else if (request.action === 'clear') {
        clearHighlights();
        // Clear search state
        lastSearchState = {
          query: '',
          useRegex: false,
          caseSensitive: false,
          useElementSearch: false,
          elementSearchMode: 'css'
        };
        sendResponse({ success: true } as SearchResponse);
      } else if (request.action === 'navigate-next') {
        const result = navigateToMatch(currentMatchIndex + 1);
        sendResponse({ success: true, currentIndex: result.currentIndex, totalMatches: result.totalMatches } as SearchResponse);
      } else if (request.action === 'navigate-prev') {
        const result = navigateToMatch(currentMatchIndex - 1);
        sendResponse({ success: true, currentIndex: result.currentIndex, totalMatches: result.totalMatches } as SearchResponse);
      } else if (request.action === 'get-state') {
        // Return current search state (support both text and element search)
        const totalMatches = highlightData.ranges.length || highlightData.elements.length;
        sendResponse({
          success: true,
          state: lastSearchState,
          currentIndex: currentMatchIndex,
          totalMatches: totalMatches
        } as StateResponse);
      }

      return true; // Keep the message channel open for async response
    });
  },
});
