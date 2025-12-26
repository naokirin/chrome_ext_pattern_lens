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
import {
  findScrollableElements,
  getElementById,
  getScrollPosition,
  isRectVisibleInScrollableParent,
  isRectVisibleInViewport,
} from '~/lib/utils/domUtils';
import { throttleAnimationFrame } from '~/lib/utils/throttle';
import { updateMinimap } from './minimap';

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

// Store scrollable element listeners
const scrollableElementListeners = new Map<Element, () => void>();

// Map to track overlay-to-range/element relationships for efficient updates
// For ranges: overlay -> { range, index, rectIndex }
// For elements: overlay -> { element, rectIndex }
interface RangeOverlayInfo {
  range: Range;
  index: number;
  rectIndex: number;
}
interface ElementOverlayInfo {
  element: Element;
  rectIndex: number;
}
const overlayToRangeInfoMap = new Map<HTMLDivElement, RangeOverlayInfo>();
const overlayToElementInfoMap = new Map<HTMLDivElement, ElementOverlayInfo>();

/**
 * Initialize overlay container
 */
export function initializeOverlayContainer(): HTMLDivElement {
  let container = getElementById<HTMLDivElement>(HIGHLIGHT_OVERLAY_ID);

  if (!container) {
    container = document.createElement('div');
    container.id = HIGHLIGHT_OVERLAY_ID;
    container.style.cssText = `
      position: fixed;
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
 * Note: rect should be from getClientRects() which returns viewport coordinates
 * Since overlay container uses position: fixed, we don't need to add scroll position
 */
export function createOverlay(
  rect: DOMRect,
  _scrollX: number,
  _scrollY: number,
  isCurrent = false
): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = isCurrent ? `${HIGHLIGHT_CLASS} ${CURRENT_MATCH_CLASS}` : HIGHLIGHT_CLASS;

  // Different colors for current match
  const bgColor = isCurrent ? OVERLAY_BG_COLOR_CURRENT : OVERLAY_BG_COLOR_NORMAL;
  const borderColor = isCurrent ? OVERLAY_BORDER_COLOR_CURRENT : OVERLAY_BORDER_COLOR_NORMAL;

  overlay.style.cssText = `
    position: absolute;
    left: ${rect.left - OVERLAY_PADDING}px;
    top: ${rect.top - OVERLAY_PADDING}px;
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
 * Register overlay-to-range mapping for efficient position updates
 */
export function registerOverlayForRange(
  overlay: HTMLDivElement,
  range: Range,
  index: number,
  rectIndex: number
): void {
  overlayToRangeInfoMap.set(overlay, { range, index, rectIndex });
}

/**
 * Register overlay-to-element mapping for efficient position updates
 */
export function registerOverlayForElement(
  overlay: HTMLDivElement,
  element: Element,
  rectIndex: number
): void {
  overlayToElementInfoMap.set(overlay, { element, rectIndex });
}

/**
 * Update existing overlay position directly (for scroll events)
 * This is faster than recreating all overlays
 */
function updateOverlayPosition(overlay: HTMLDivElement, rect: DOMRect, isCurrent: boolean): void {
  const bgColor = isCurrent ? OVERLAY_BG_COLOR_CURRENT : OVERLAY_BG_COLOR_NORMAL;
  const borderColor = isCurrent ? OVERLAY_BORDER_COLOR_CURRENT : OVERLAY_BORDER_COLOR_NORMAL;

  overlay.style.left = `${rect.left - OVERLAY_PADDING}px`;
  overlay.style.top = `${rect.top - OVERLAY_PADDING}px`;
  overlay.style.width = `${rect.width + OVERLAY_PADDING * 2}px`;
  overlay.style.height = `${rect.height + OVERLAY_PADDING * 2}px`;
  overlay.style.backgroundColor = bgColor;
  overlay.style.borderColor = borderColor;

  // Update class for current match
  if (isCurrent) {
    overlay.className = `${HIGHLIGHT_CLASS} ${CURRENT_MATCH_CLASS}`;
  } else {
    overlay.className = HIGHLIGHT_CLASS;
  }
}

/**
 * Update overlay positions (for scroll/resize events)
 * Since overlay container uses position: fixed, getClientRects() viewport coordinates
 * can be used directly without adding scroll position
 *
 * Optimized version: Updates existing overlays in place when possible,
 * only recreates when necessary (new matches, removed matches, or structure changes)
 */
export function updateOverlayPositions(stateManager: SearchStateManager): void {
  const container = getElementById<HTMLDivElement>(HIGHLIGHT_OVERLAY_ID);
  if (!container) return;

  // If there are no ranges or elements, clear all overlays
  if (!stateManager.hasMatches()) {
    container.innerHTML = '';
    stateManager.clearOverlays();
    overlayToRangeInfoMap.clear();
    overlayToElementInfoMap.clear();
    return;
  }

  // Get scroll position for compatibility (though not needed with fixed positioning)
  const { scrollX, scrollY } = getScrollPosition();

  // Collect all current overlays that need to be updated
  const existingOverlays = new Set(stateManager.overlays);
  const usedOverlays = new Set<HTMLDivElement>();
  const overlaysToRemove: HTMLDivElement[] = [];

  // Update overlays for ranges
  stateManager.forEachRange((range, index) => {
    try {
      const rects = range.getClientRects();
      const mergedRects = mergeAdjacentRects(rects);
      const isCurrent = index === stateManager.currentIndex;

      for (let rectIndex = 0; rectIndex < mergedRects.length; rectIndex++) {
        const rect = mergedRects[rectIndex];
        const isVisible =
          isRectVisibleInViewport(rect) &&
          isRectVisibleInScrollableParent(rect, range.startContainer);

        // Find existing overlay for this range and rectIndex
        let overlay: HTMLDivElement | null = null;
        for (const existingOverlay of existingOverlays) {
          if (!usedOverlays.has(existingOverlay)) {
            const info = overlayToRangeInfoMap.get(existingOverlay);
            if (
              info &&
              info.range === range &&
              info.index === index &&
              info.rectIndex === rectIndex
            ) {
              overlay = existingOverlay;
              usedOverlays.add(overlay);
              break;
            }
          }
        }

        if (isVisible) {
          if (overlay) {
            // Update existing overlay position
            updateOverlayPosition(overlay, rect, isCurrent);
            // Update index in case current match changed
            const info = overlayToRangeInfoMap.get(overlay);
            if (info) {
              info.index = index;
            }
          } else {
            // Create new overlay
            overlay = createOverlay(rect, scrollX, scrollY, isCurrent);
            container.appendChild(overlay);
            stateManager.addOverlay(overlay);
            overlayToRangeInfoMap.set(overlay, { range, index, rectIndex });
          }
        } else if (overlay) {
          // Overlay is no longer visible, remove it
          overlay.remove();
          overlaysToRemove.push(overlay);
          overlayToRangeInfoMap.delete(overlay);
        }
      }
    } catch {
      // Range is invalid, skip
    }
  });

  // Update overlays for elements
  stateManager.forEachElement((element, _index) => {
    try {
      const rects = element.getClientRects();
      const mergedRects = mergeAdjacentRects(rects);

      for (let rectIndex = 0; rectIndex < mergedRects.length; rectIndex++) {
        const rect = mergedRects[rectIndex];
        const isVisible =
          isRectVisibleInViewport(rect) && isRectVisibleInScrollableParent(rect, element);

        // Find existing overlay for this element and rectIndex
        let overlay: HTMLDivElement | null = null;
        for (const existingOverlay of existingOverlays) {
          if (!usedOverlays.has(existingOverlay)) {
            const info = overlayToElementInfoMap.get(existingOverlay);
            if (info && info.element === element && info.rectIndex === rectIndex) {
              overlay = existingOverlay;
              usedOverlays.add(overlay);
              break;
            }
          }
        }

        if (isVisible) {
          if (overlay) {
            // Update existing overlay position
            updateOverlayPosition(overlay, rect, false);
          } else {
            // Create new overlay
            overlay = createOverlay(rect, scrollX, scrollY, false);
            container.appendChild(overlay);
            stateManager.addOverlay(overlay);
            overlayToElementInfoMap.set(overlay, { element, rectIndex });
          }
        } else if (overlay) {
          // Overlay is no longer visible, remove it
          overlay.remove();
          overlaysToRemove.push(overlay);
          overlayToElementInfoMap.delete(overlay);
        }
      }
    } catch {
      // Element is invalid, skip
    }
  });

  // Remove overlays that are no longer needed
  for (const overlay of existingOverlays) {
    if (!usedOverlays.has(overlay)) {
      overlay.remove();
      overlaysToRemove.push(overlay);
      overlayToRangeInfoMap.delete(overlay);
      overlayToElementInfoMap.delete(overlay);
    }
  }

  // Remove from state manager
  for (const overlay of overlaysToRemove) {
    const index = stateManager.overlays.indexOf(overlay);
    if (index !== -1) {
      stateManager.overlays.splice(index, 1);
    }
  }

  // Update minimap to reflect current scroll position
  updateMinimap(stateManager);
}

/**
 * Setup event listeners for scroll and resize (prevent duplicate registration)
 * Uses requestAnimationFrame for smooth updates, but calls update immediately on first scroll
 * to reduce perceived latency
 * Also listens to scroll events on scrollable elements (overflow: scroll/auto)
 */
export function setupEventListeners(
  stateManager: SearchStateManager,
  _updateCallback: () => void
): void {
  if (eventListenersAttached) {
    return; // Already attached, skip
  }

  let rafId: number | null = null;
  let lastUpdateTime = 0;
  const UPDATE_THROTTLE_MS = 16; // ~60fps

  // Optimized update function that updates immediately on scroll,
  // then throttles subsequent updates using requestAnimationFrame
  const updateHandler = () => {
    const now = performance.now();

    // Update immediately if enough time has passed since last update
    if (now - lastUpdateTime >= UPDATE_THROTTLE_MS) {
      updateOverlayPositions(stateManager);
      lastUpdateTime = now;

      // Cancel any pending RAF update since we just updated
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else {
      // Schedule update using requestAnimationFrame for smooth animation
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          updateOverlayPositions(stateManager);
          lastUpdateTime = performance.now();
          rafId = null;
        });
      }
    }
  };

  // Store callbacks for removal
  scrollCallback = updateHandler;
  resizeCallback = throttleAnimationFrame(() => {
    updateOverlayPositions(stateManager);
  });

  // Listen to window scroll and resize
  window.addEventListener('scroll', scrollCallback, { passive: true });
  window.addEventListener('resize', resizeCallback, { passive: true });

  // Listen to scroll events on all scrollable elements (overflow: scroll/auto)
  const scrollableElements = findScrollableElements();
  for (const element of scrollableElements) {
    const listener = updateHandler;
    element.addEventListener('scroll', listener, { passive: true });
    scrollableElementListeners.set(element, listener);
  }

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

  // Remove listeners from scrollable elements
  for (const [element, listener] of scrollableElementListeners.entries()) {
    element.removeEventListener('scroll', listener);
  }
  scrollableElementListeners.clear();

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

  // Clear overlay mapping
  overlayToRangeInfoMap.clear();
  overlayToElementInfoMap.clear();

  // Remove minimap
  removeMinimap();
}
