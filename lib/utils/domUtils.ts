/**
 * Utility functions for DOM manipulation with type safety
 */

/**
 * Safely get an element by ID with type assertion
 * Returns null if element is not found
 * @param id - The element ID
 * @returns The element if found, or null
 */
export function getElementById<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Safely get a required element by ID with type assertion
 * Throws an error if the element is not found
 * Use this for elements that must exist (e.g., in popup HTML)
 * @param id - The element ID
 * @returns The element if found
 * @throws Error if element is not found
 */
export function getRequiredElementById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Required element with ID "${id}" not found`);
  }
  return element as T;
}

/**
 * Get current scroll position
 * This function is extracted to make it mockable in tests
 * @returns Object with scrollX and scrollY
 */
export function getScrollPosition(): { scrollX: number; scrollY: number } {
  return {
    scrollX: window.scrollX || window.pageXOffset || 0,
    scrollY: window.scrollY || window.pageYOffset || 0,
  };
}

/**
 * Find all scrollable elements in the document
 * Elements with overflow: scroll, overflow: auto, or overflow-y/overflow-x scroll/auto
 * @returns Array of scrollable elements
 */
export function findScrollableElements(): Element[] {
  const scrollableElements: Element[] = [];
  const allElements = document.querySelectorAll('*');

  for (const element of allElements) {
    if (element === document.body || element === document.documentElement) {
      continue; // Skip body and html
    }

    const style = window.getComputedStyle(element);
    const overflowX = style.overflowX;
    const overflowY = style.overflowY;
    const overflow = style.overflow;

    // Check if element is scrollable
    const isScrollable =
      overflow === 'scroll' ||
      overflow === 'auto' ||
      overflowX === 'scroll' ||
      overflowX === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'auto';

    if (isScrollable) {
      // Force layout calculation to get accurate scroll dimensions
      // Accessing offsetHeight forces a reflow
      void (element as HTMLElement).offsetHeight;

      // Check if element actually has scrollable content
      const hasScrollableContent =
        element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;

      if (hasScrollableContent) {
        scrollableElements.push(element);
      }
    }
  }

  return scrollableElements;
}

/**
 * Check if a rectangle is visible in viewport
 * A rectangle is considered visible if it intersects with the viewport
 * @param rect - The rectangle to check
 * @returns true if rectangle is visible in viewport
 */
export function isRectVisibleInViewport(rect: DOMRect): boolean {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  // Check if rectangle intersects with viewport
  return (
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < viewportWidth &&
    rect.top < viewportHeight &&
    rect.width > 0 &&
    rect.height > 0
  );
}

/**
 * Check if a rectangle is visible within its scrollable parent
 * @param rect - The rectangle to check (in viewport coordinates)
 * @param element - The element that contains the rectangle
 * @returns true if rectangle is visible within scrollable parent
 */
export function isRectVisibleInScrollableParent(rect: DOMRect, element: Element | Node): boolean {
  let current: Element | null = null;

  // Get the element from node if needed
  if (element.nodeType === Node.TEXT_NODE) {
    current = element.parentElement;
  } else if (element.nodeType === Node.ELEMENT_NODE) {
    current = element as Element;
  }

  if (!current) {
    return true; // If we can't determine parent, assume visible
  }

  // Walk up the DOM tree to find scrollable parents
  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const overflowX = style.overflowX;
    const overflowY = style.overflowY;
    const overflow = style.overflow;

    // Check if this element is scrollable
    const isScrollable =
      overflow === 'scroll' ||
      overflow === 'auto' ||
      overflowX === 'scroll' ||
      overflowX === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'auto';

    if (isScrollable) {
      // Get the scrollable element's bounding rect
      const parentRect = current.getBoundingClientRect();

      // Check if the rectangle is within the scrollable parent's visible area
      // The rectangle must intersect with the parent's bounding rect
      const isWithinParent =
        rect.right > parentRect.left &&
        rect.bottom > parentRect.top &&
        rect.left < parentRect.right &&
        rect.top < parentRect.bottom;

      if (!isWithinParent) {
        return false; // Rectangle is outside scrollable parent
      }
    }

    current = current.parentElement;
  }

  return true; // No scrollable parent found, or rectangle is within all parents
}

/**
 * Find the index of the match closest to current viewport center
 * @param overlays - Array of overlay elements
 * @returns Index of closest match, or 0 if none found
 */
export function findClosestMatchIndex(overlays: HTMLDivElement[]): number {
  if (overlays.length === 0) return 0;

  // Viewport center in viewport coordinates
  const viewportCenterY = window.innerHeight / 2;
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  overlays.forEach((overlay, index) => {
    const rect = overlay.getBoundingClientRect();
    // rect.top is already in viewport coordinates
    const elementCenterY = rect.top + rect.height / 2;
    const distance = Math.abs(elementCenterY - viewportCenterY);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}
