/**
 * Overlay management for highlighting search results
 */
import type { SearchStateManager } from '~/lib/state/searchState';
import { getElementById } from '~/lib/utils/domUtils';

/**
 * Merge adjacent rectangles on the same line
 */
function mergeAdjacentRects(rectList: DOMRectList | DOMRect[], tolerance = 1): DOMRect[] {
  if (!rectList || rectList.length === 0) {
    return [];
  }

  const rects = Array.from(rectList);

  // 1. Group rectangles by line (using rounded y coordinate)
  const lines = new Map<number, DOMRect[]>();
  rects.forEach((rect) => {
    // Round y coordinate to absorb small pixel differences
    const lineY = Math.round(rect.y);
    if (!lines.has(lineY)) {
      lines.set(lineY, []);
    }
    lines.get(lineY)?.push(rect);
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

// Constants
const HIGHLIGHT_OVERLAY_ID = 'pattern-lens-overlay-container';
const HIGHLIGHT_CLASS = 'pattern-lens-highlight-overlay';
const CURRENT_MATCH_CLASS = 'pattern-lens-current-match';

// Track event listener registration state
let eventListenersAttached = false;

/**
 * Initialize overlay container
 */
export function initializeOverlayContainer(): HTMLDivElement {
  let container = getElementById<HTMLDivElement>(HIGHLIGHT_OVERLAY_ID);

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

/**
 * Create overlay element for a rectangle
 */
export function createOverlay(
  rect: DOMRect,
  scrollX: number,
  scrollY: number,
  isCurrent = false
): HTMLDivElement {
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
    width: ${rect.width + padding * 2}px;
    height: ${rect.height + padding * 2}px;
    background-color: ${bgColor};
    border: ${borderWidth}px solid ${borderColor};
    border-radius: 2px;
    pointer-events: none;
    box-sizing: border-box;
  `;
  return overlay;
}

/**
 * Update overlay positions (for scroll/resize events)
 */
export function updateOverlayPositions(stateManager: SearchStateManager): void {
  const container = getElementById<HTMLDivElement>(HIGHLIGHT_OVERLAY_ID);
  if (!container) return;

  // Clear existing overlays
  container.innerHTML = '';
  stateManager.clearOverlays();

  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // Recreate overlays from stored ranges and elements
  stateManager.forEachRange((range, index) => {
    const rects = range.getClientRects();
    const mergedRects = mergeAdjacentRects(rects);
    const isCurrent = index === stateManager.currentIndex;
    for (let i = 0; i < mergedRects.length; i++) {
      const overlay = createOverlay(mergedRects[i], scrollX, scrollY, isCurrent);
      container.appendChild(overlay);
      stateManager.addOverlay(overlay);
    }
  });

  stateManager.forEachElement((element) => {
    const rects = element.getClientRects();
    const mergedRects = mergeAdjacentRects(rects);
    for (let i = 0; i < mergedRects.length; i++) {
      const overlay = createOverlay(mergedRects[i], scrollX, scrollY);
      container.appendChild(overlay);
      stateManager.addOverlay(overlay);
    }
  });
}

/**
 * Setup event listeners for scroll and resize (prevent duplicate registration)
 */
export function setupEventListeners(
  _stateManager: SearchStateManager,
  updateCallback: () => void
): void {
  if (eventListenersAttached) {
    return; // Already attached, skip
  }

  window.addEventListener('scroll', updateCallback, { passive: true });
  window.addEventListener('resize', updateCallback, { passive: true });
  eventListenersAttached = true;
}

/**
 * Remove event listeners for scroll and resize
 */
export function removeEventListeners(updateCallback: () => void): void {
  if (!eventListenersAttached) {
    return; // Not attached, skip
  }

  window.removeEventListener('scroll', updateCallback);
  window.removeEventListener('resize', updateCallback);
  eventListenersAttached = false;
}

/**
 * Remove all highlights
 */
export function clearHighlights(
  stateManager: SearchStateManager,
  removeMinimap: () => void,
  updateCallback: () => void
): void {
  // Remove overlay container
  const container = document.getElementById(HIGHLIGHT_OVERLAY_ID);
  if (container) {
    container.remove();
  }

  // Remove event listeners
  removeEventListeners(updateCallback);

  // Clear stored data
  stateManager.clear();

  // Remove minimap
  removeMinimap();
}
