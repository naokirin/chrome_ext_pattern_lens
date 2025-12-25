import {
  MINIMAP_BG_COLOR,
  MINIMAP_CONTAINER_ID,
  MINIMAP_MARKER_BORDER_RADIUS,
  MINIMAP_MARKER_COLOR_CURRENT,
  MINIMAP_MARKER_COLOR_NORMAL,
  MINIMAP_MARKER_HEIGHT,
  MINIMAP_WIDTH,
  MINIMAP_Z_INDEX,
} from '~/lib/constants';
/**
 * Minimap management for showing search result positions
 */
import type { SearchStateManager } from '~/lib/state/searchState';
import { getElementById, getScrollPosition } from '~/lib/utils/domUtils';
import { handleError } from '../utils/errorHandler';

/**
 * Get or create minimap container
 */
export function getMinimapContainer(): HTMLDivElement {
  let container = getElementById<HTMLDivElement>(MINIMAP_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = MINIMAP_CONTAINER_ID;
    document.body.appendChild(container);
  }
  // Apply styles every time to handle resize
  applyMinimapStyles(container);
  return container;
}

/**
 * Apply styles to minimap container
 */
function applyMinimapStyles(container: HTMLDivElement): void {
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  container.style.cssText = `
    position: fixed;
    top: 0;
    right: ${scrollbarWidth}px;
    width: ${MINIMAP_WIDTH}px;
    height: 100vh;
    z-index: ${MINIMAP_Z_INDEX};
    pointer-events: none;
    background-color: ${MINIMAP_BG_COLOR};
  `;
}

/**
 * Update minimap with current matches
 */
export function updateMinimap(stateManager: SearchStateManager): void {
  const container = getMinimapContainer();
  container.innerHTML = '';

  if (!stateManager.hasMatches()) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';

  const pageHeight = document.documentElement.scrollHeight;

  // Handle text search matches (ranges)
  if (stateManager.hasTextMatches()) {
    stateManager.forEachRange((range, index) => {
      const marker = document.createElement('div');

      try {
        // Range.getBoundingClientRect() may not be available in test environments
        // Try multiple fallback strategies
        let rect: DOMRect | null = null;

        // Strategy 1: Try Range.getBoundingClientRect() (available in real browsers)
        if (typeof range.getBoundingClientRect === 'function') {
          try {
            rect = range.getBoundingClientRect();
          } catch {
            // Fall through to next strategy
          }
        }

        // Strategy 2: Try Range.getClientRects() (available in real browsers)
        if (!rect && typeof range.getClientRects === 'function') {
          try {
            const rects = range.getClientRects();
            if (rects.length > 0) {
              // Use the first rect, or calculate bounding box from all rects
              const firstRect = rects[0];
              let minTop = firstRect.top;
              let maxBottom = firstRect.bottom;
              for (let i = 1; i < rects.length; i++) {
                minTop = Math.min(minTop, rects[i].top);
                maxBottom = Math.max(maxBottom, rects[i].bottom);
              }
              rect = new DOMRect(firstRect.left, minTop, firstRect.width, maxBottom - minTop);
            }
          } catch {
            // Fall through to next strategy
          }
        }

        // Strategy 3: Get element from range and use its getBoundingClientRect()
        if (!rect) {
          const startElement =
            range.startContainer.nodeType === Node.TEXT_NODE
              ? range.startContainer.parentElement
              : (range.startContainer as Element);
          if (startElement && typeof startElement.getBoundingClientRect === 'function') {
            try {
              rect = startElement.getBoundingClientRect();
            } catch {
              // Fall through
            }
          }
        }

        if (!rect) {
          throw new Error('Unable to get bounding rect from range');
        }

        const { scrollY } = getScrollPosition();
        const absoluteTop = rect.top + scrollY;
        const relativeTop = (absoluteTop / pageHeight) * 100;

        const isActive = index === stateManager.currentIndex;

        marker.style.cssText = `
          position: absolute;
          top: ${relativeTop}%;
          left: 0;
          width: 100%;
          height: ${MINIMAP_MARKER_HEIGHT}px;
          background-color: ${isActive ? MINIMAP_MARKER_COLOR_CURRENT : MINIMAP_MARKER_COLOR_NORMAL};
          border-radius: ${MINIMAP_MARKER_BORDER_RADIUS}px;
        `;

        container.appendChild(marker);
      } catch (error) {
        // Failed to create minimap marker
        handleError(error, 'updateMinimap: Failed to create minimap marker', undefined);
      }
    });
  }

  // Handle element search matches
  if (stateManager.hasElementMatches()) {
    stateManager.forEachElement((element, index) => {
      const marker = document.createElement('div');

      try {
        const rect = element.getBoundingClientRect();
        const { scrollY } = getScrollPosition();
        const absoluteTop = rect.top + scrollY;
        const relativeTop = (absoluteTop / pageHeight) * 100;

        const isActive = index === stateManager.currentIndex;

        marker.style.cssText = `
          position: absolute;
          top: ${relativeTop}%;
          left: 0;
          width: 100%;
          height: ${MINIMAP_MARKER_HEIGHT}px;
          background-color: ${isActive ? MINIMAP_MARKER_COLOR_CURRENT : MINIMAP_MARKER_COLOR_NORMAL};
          border-radius: ${MINIMAP_MARKER_BORDER_RADIUS}px;
        `;

        container.appendChild(marker);
      } catch (error) {
        // Failed to create minimap marker
        handleError(error, 'updateMinimap: Failed to create minimap marker for element', undefined);
      }
    });
  }
}

/**
 * Remove minimap from page
 */
export function removeMinimap(): void {
  const container = document.getElementById(MINIMAP_CONTAINER_ID);
  if (container) {
    container.remove();
  }
}
