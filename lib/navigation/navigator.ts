import type { SearchStateManager } from '~/lib/state/searchState';
/**
 * Navigation management for search results
 */
import type { NavigationResult } from '~/lib/types';
import { updateMinimap } from '../highlight/minimap';
import { updateOverlayPositions } from '../highlight/overlay';
import { handleError } from '../utils/errorHandler';

/**
 * Normalize match index (wrap around)
 */
export function normalizeMatchIndex(index: number, totalMatches: number): number {
  if (totalMatches === 0) {
    return -1;
  }

  let normalizedIndex = index;
  if (normalizedIndex < 0) {
    normalizedIndex = totalMatches - 1;
  } else if (normalizedIndex >= totalMatches) {
    normalizedIndex = 0;
  }

  return normalizedIndex;
}

/**
 * Update highlight for current match (overlay colors and minimap)
 */
export function updateMatchHighlight(stateManager: SearchStateManager): void {
  if (stateManager.hasTextMatches()) {
    updateOverlayPositions(stateManager);
    updateMinimap(stateManager);
  } else if (stateManager.hasElementMatches()) {
    updateOverlayPositions(stateManager);
    updateMinimap(stateManager);
  }
}

/**
 * Scroll to the current match
 */
export function scrollToMatch(stateManager: SearchStateManager): void {
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
        handleError(error, 'scrollToMatch: Failed to scroll to text match', undefined);
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
        handleError(error, 'scrollToMatch: Failed to scroll to element', undefined);
      }
    }
  }
}

/**
 * Navigate to a specific match index
 */
export function navigateToMatch(index: number, stateManager: SearchStateManager): NavigationResult {
  const totalMatches = stateManager.totalMatches;

  if (totalMatches === 0) {
    return { currentIndex: -1, totalMatches: 0 };
  }

  // Normalize index (wrap around)
  const normalizedIndex = normalizeMatchIndex(index, totalMatches);
  stateManager.setCurrentIndex(normalizedIndex);

  // Update highlight for current match
  updateMatchHighlight(stateManager);

  // Scroll to the current match
  scrollToMatch(stateManager);

  return { currentIndex: stateManager.currentIndex, totalMatches: totalMatches };
}
