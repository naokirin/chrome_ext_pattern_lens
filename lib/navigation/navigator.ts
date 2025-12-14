import type { SearchStateManager } from '~/lib/state/searchState';
/**
 * Navigation management for search results
 */
import type { NavigationResult } from '~/lib/types';
import { updateMinimap } from '../highlight/minimap';
import { updateOverlayPositions } from '../highlight/overlay';
import { handleError } from '../utils/errorHandler';

/**
 * Navigate to a specific match index
 */
export function navigateToMatch(index: number, stateManager: SearchStateManager): NavigationResult {
  // Support both text search (ranges) and element search (elements)
  const totalMatches = stateManager.totalMatches;

  if (totalMatches === 0) {
    return { currentIndex: -1, totalMatches: 0 };
  }

  // Normalize index (wrap around)
  let normalizedIndex = index;
  if (normalizedIndex < 0) {
    normalizedIndex = totalMatches - 1;
  } else if (normalizedIndex >= totalMatches) {
    normalizedIndex = 0;
  }

  stateManager.setCurrentIndex(normalizedIndex);

  // Update overlay colors (for text search)
  if (stateManager.hasTextMatches()) {
    updateOverlayPositions(stateManager);
    updateMinimap(stateManager);
  }

  // Scroll to the current match
  if (stateManager.hasTextMatches()) {
    // Text search: scroll to range
    const currentRange = stateManager.getCurrentRange();
    if (currentRange) {
      try {
        const element = currentRange.startContainer.parentElement;
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch (error) {
        // Failed to scroll to match
        handleError(error, 'navigateToMatch: Failed to scroll to text match', undefined);
      }
    }
  } else if (stateManager.hasElementMatches()) {
    // Element search: scroll to element
    const currentElement = stateManager.getCurrentElement();
    if (currentElement) {
      try {
        currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (error) {
        // Failed to scroll to element
        handleError(error, 'navigateToMatch: Failed to scroll to element', undefined);
      }
    }
  }

  return { currentIndex: stateManager.currentIndex, totalMatches: totalMatches };
}
