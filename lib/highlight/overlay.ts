import {
  CURRENT_MATCH_CLASS,
  HIGHLIGHT_CLASS,
  HIGHLIGHT_OVERLAY_ID,
  OVERLAY_BG_COLOR_CURRENT,
  OVERLAY_BG_COLOR_NORMAL,
  OVERLAY_BORDER_COLOR_CURRENT,
  OVERLAY_BORDER_COLOR_NORMAL,
  OVERLAY_BORDER_RADIUS,
  OVERLAY_BORDER_WIDTH,
  OVERLAY_PADDING,
  OVERLAY_Z_INDEX,
  RECT_MERGE_TOLERANCE,
} from '~/lib/constants';
/**
 * Overlay management for highlighting search results
 */
import type { SearchStateManager } from '~/lib/state/searchState';
import { getElementById, getScrollPosition } from '~/lib/utils/domUtils';
import { throttleAnimationFrame } from '~/lib/utils/throttle';

/**
 * Merge adjacent rectangles on the same line
 */
function mergeAdjacentRects(
  rectList: DOMRectList | DOMRect[],
  tolerance = RECT_MERGE_TOLERANCE
): DOMRect[] {
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

// Track event listener registration state
let eventListenersAttached = false;

// Store the actual callback functions for removal
let scrollCallback: (() => void) | null = null;
let resizeCallback: (() => void) | null = null;

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
      z-index: ${OVERLAY_Z_INDEX};
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

  // Different colors for current match
  const bgColor = isCurrent ? OVERLAY_BG_COLOR_CURRENT : OVERLAY_BG_COLOR_NORMAL;
  const borderColor = isCurrent ? OVERLAY_BORDER_COLOR_CURRENT : OVERLAY_BORDER_COLOR_NORMAL;

  overlay.style.cssText = `
    position: absolute;
    left: ${rect.left + scrollX - OVERLAY_PADDING}px;
    top: ${rect.top + scrollY - OVERLAY_PADDING}px;
    width: ${rect.width + OVERLAY_PADDING * 2}px;
    height: ${rect.height + OVERLAY_PADDING * 2}px;
    background-color: ${bgColor};
    border: ${OVERLAY_BORDER_WIDTH}px solid ${borderColor};
    border-radius: ${OVERLAY_BORDER_RADIUS}px;
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

  const { scrollX, scrollY } = getScrollPosition();

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
 * Uses throttled update with requestAnimationFrame for better performance
 */
export function setupEventListeners(
  stateManager: SearchStateManager,
  _updateCallback: () => void
): void {
  if (eventListenersAttached) {
    return; // Already attached, skip
  }

  // Create throttled version using requestAnimationFrame for smooth updates
  const throttledUpdate = throttleAnimationFrame(() => {
    updateOverlayPositions(stateManager);
  });

  // Store callbacks for removal
  scrollCallback = throttledUpdate;
  resizeCallback = throttledUpdate;

  window.addEventListener('scroll', scrollCallback, { passive: true });
  window.addEventListener('resize', resizeCallback, { passive: true });
  eventListenersAttached = true;
}

/**
 * Remove event listeners for scroll and resize
 */
export function removeEventListeners(_updateCallback: () => void): void {
  if (!eventListenersAttached) {
    return; // Not attached, skip
  }

  if (scrollCallback) {
    window.removeEventListener('scroll', scrollCallback);
    scrollCallback = null;
  }

  if (resizeCallback) {
    window.removeEventListener('resize', resizeCallback);
    resizeCallback = null;
  }

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
