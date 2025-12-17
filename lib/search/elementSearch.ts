import { HIGHLIGHT_OVERLAY_ID } from '~/lib/constants';
import type { SearchStateManager } from '~/lib/state/searchState';
/**
 * Element search functionality (CSS selector and XPath)
 */
import type { SearchResult } from '~/lib/types';
import {
  createOverlay,
  initializeOverlayContainer,
  setupEventListeners,
  updateOverlayPositions,
} from '../highlight/overlay';
import { navigateToMatch } from '../navigation/navigator';
import {
  getScrollPosition,
  isRectVisibleInScrollableParent,
  isRectVisibleInViewport,
} from '../utils/domUtils';
import { handleError } from '../utils/errorHandler';
import { mergeAdjacentRects } from './textSearch';

/**
 * Find elements by CSS selector or XPath
 * @returns Array of matching elements
 * @throws Error if query is invalid
 */
export function findElements(query: string, mode: 'css' | 'xpath'): Element[] {
  let elements: Element[] = [];

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
  elements = elements.filter((el) => {
    return el.id !== HIGHLIGHT_OVERLAY_ID && !el.closest(`#${HIGHLIGHT_OVERLAY_ID}`);
  });

  return elements;
}

/**
 * Create overlays from elements and add them to state manager
 * @returns Number of elements processed
 */
export function createOverlaysFromElements(
  elements: Element[],
  stateManager: SearchStateManager
): number {
  const container = initializeOverlayContainer();
  const { scrollX, scrollY } = getScrollPosition();
  let count = 0;

  elements.forEach((element) => {
    if (element.nodeType === Node.ELEMENT_NODE) {
      const rects = element.getClientRects();
      const mergedRects = mergeAdjacentRects(rects);

      for (let i = 0; i < mergedRects.length; i++) {
        const rect = mergedRects[i];
        // Only create overlay if rectangle is visible in viewport and within scrollable parents
        if (
          isRectVisibleInViewport(rect) &&
          isRectVisibleInScrollableParent(rect, element)
        ) {
          const overlay = createOverlay(rect, scrollX, scrollY);
          container.appendChild(overlay);
          stateManager.addOverlay(overlay);
        }
      }

      // Store element for position updates
      stateManager.addElement(element);
      count++;
    }
  });

  return count;
}

/**
 * Search elements by CSS selector or XPath using overlay
 */
export function searchElements(
  query: string,
  mode: 'css' | 'xpath',
  stateManager: SearchStateManager,
  skipNavigation = false
): SearchResult {
  try {
    // Step 1: Find elements
    const elements = findElements(query, mode);

    // Step 2: Create overlays from elements
    const count = createOverlaysFromElements(elements, stateManager);

    // Step 3: Add event listeners and navigate to first element
    if (count > 0) {
      setupEventListeners(stateManager, () => updateOverlayPositions(stateManager));

      // Navigate to first element (skip if this is a re-search from DOM observer)
      if (!skipNavigation) {
        const navResult = navigateToMatch(0, stateManager);
        return {
          count: count,
          currentIndex: navResult.currentIndex,
          totalMatches: navResult.totalMatches,
        };
      }

      return { count: count, currentIndex: 0, totalMatches: count };
    }

    return { count: 0, currentIndex: -1, totalMatches: 0 };
  } catch (error) {
    const err = error as Error;
    const errorMessage = `Invalid ${mode === 'css' ? 'CSS selector' : 'XPath'}: ${err.message}`;
    handleError(error, `searchElements: ${errorMessage}`, undefined);
    throw new Error(errorMessage);
  }
}
