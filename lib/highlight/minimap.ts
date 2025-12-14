/**
 * Minimap management for showing search result positions
 */
import type { SearchStateManager } from '~/lib/state/searchState';
import { getElementById } from '~/lib/utils/domUtils';
import { handleError } from '../utils/errorHandler';

// Constants
const MINIMAP_CONTAINER_ID = 'pattern-lens-minimap-container';

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
    width: 12px;
    height: 100vh;
    z-index: 2147483646;
    pointer-events: none;
    background-color: rgba(0, 0, 0, 0.05);
  `;
}

/**
 * Update minimap with current matches
 */
export function updateMinimap(stateManager: SearchStateManager): void {
  const container = getMinimapContainer();
  container.innerHTML = '';

  if (!stateManager.hasTextMatches()) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';

  const pageHeight = document.documentElement.scrollHeight;

  stateManager.forEachRange((range, index) => {
    const marker = document.createElement('div');

    try {
      const rect = range.getBoundingClientRect();
      const absoluteTop = rect.top + window.scrollY;
      const relativeTop = (absoluteTop / pageHeight) * 100;

      const isActive = index === stateManager.currentIndex;

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
      // Failed to create minimap marker
      handleError(error, 'updateMinimap: Failed to create minimap marker', undefined);
    }
  });
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
