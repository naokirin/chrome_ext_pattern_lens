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
import { mergeAdjacentRects } from './textSearch';

// Constants
const HIGHLIGHT_OVERLAY_ID = 'pattern-lens-overlay-container';

/**
 * Search elements by CSS selector or XPath using overlay
 */
export function searchElements(
  query: string,
  mode: 'css' | 'xpath',
  stateManager: SearchStateManager
): SearchResult {
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
    elements = elements.filter((el) => {
      return el.id !== HIGHLIGHT_OVERLAY_ID && !el.closest(`#${HIGHLIGHT_OVERLAY_ID}`);
    });

    // Create overlays for each element
    elements.forEach((element) => {
      if (element.nodeType === Node.ELEMENT_NODE) {
        const rects = element.getClientRects();
        const mergedRects = mergeAdjacentRects(rects);

        for (let i = 0; i < mergedRects.length; i++) {
          const overlay = createOverlay(mergedRects[i], scrollX, scrollY);
          container.appendChild(overlay);
          stateManager.addOverlay(overlay);
        }

        // Store element for position updates
        stateManager.addElement(element);
      }
    });

    // Add event listeners for scroll and resize
    if (elements.length > 0) {
      setupEventListeners(stateManager, () => updateOverlayPositions(stateManager));

      // Navigate to first element
      const navResult = navigateToMatch(0, stateManager);
      return {
        count: elements.length,
        currentIndex: navResult.currentIndex,
        totalMatches: navResult.totalMatches,
      };
    }

    return { count: 0, currentIndex: -1, totalMatches: 0 };
  } catch (error) {
    const err = error as Error;
    throw new Error(`Invalid ${mode === 'css' ? 'CSS selector' : 'XPath'}: ${err.message}`);
  }
}
