import type { SearchStateManager } from '~/lib/state/searchState';
/**
 * Text search functionality using virtual text layer
 */
import type { CharMapEntry, SearchResult, VirtualMatch } from '~/lib/types';
import { updateMinimap } from '../highlight/minimap';
import {
  createOverlay,
  initializeOverlayContainer,
  setupEventListeners,
  updateOverlayPositions,
} from '../highlight/overlay';
import { navigateToMatch } from '../navigation/navigator';
import { ESCAPED_DOT_PLACEHOLDER } from '~/lib/constants';
import { handleError } from '../utils/errorHandler';
import { BLOCK_BOUNDARY_MARKER, createVirtualTextAndMap } from './virtualText';

/**
 * Merge adjacent rectangles on the same line
 */
export function mergeAdjacentRects(rectList: DOMRectList | DOMRect[], tolerance = 1): DOMRect[] {
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

/**
 * Search for matches in virtual text
 */
export function searchInVirtualText(
  query: string,
  virtualText: string,
  useRegex: boolean,
  caseSensitive: boolean
): VirtualMatch[] {
  const matches: VirtualMatch[] = [];

  if (useRegex) {
    // Use user's regex pattern with dotAll flag for multiline matching
    // Replace '.' with pattern that excludes block boundary marker
    try {
      // Replace . with [^\uE000] to prevent matching across block boundaries
      // Handle escaped dots (\.) separately - they should match literal dots
      const modifiedQuery = query
        .replace(/\\\./g, ESCAPED_DOT_PLACEHOLDER) // Temporarily replace \. (literal dot)
        .replace(/\./g, `[^${BLOCK_BOUNDARY_MARKER}\n]`) // Replace . with [^boundary] (excluding newlines too)
        .replace(
          new RegExp(ESCAPED_DOT_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          '\\.'
        ); // Restore \.

      // Use 'g' or 'gi' flags based on case-sensitivity (not 's') so that . does not match newlines
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(modifiedQuery, flags);
      let match: RegExpExecArray | null = regex.exec(virtualText);
      while (match !== null) {
        // Filter out matches that cross block boundaries
        const matchedText = match[0];
        const hasBoundary = matchedText.includes(BLOCK_BOUNDARY_MARKER);

        // Skip matches that cross block boundaries
        if (!hasBoundary) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
          });
        }
        // Prevent infinite loop on zero-length matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
        match = regex.exec(virtualText);
      }
    } catch (error) {
      // Invalid regex pattern, return empty matches
      handleError(error, 'searchInVirtualText: Invalid regex pattern', undefined);
      return matches;
    }
  } else {
    // Normal search: escape regex special characters, then convert spaces to \s+ for flexible matching
    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalizedQuery = escapedQuery.replace(/\s+/g, '\\s+');
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(normalizedQuery, flags);
    let match: RegExpExecArray | null = regex.exec(virtualText);
    while (match !== null) {
      // Filter out matches that cross block boundaries
      const matchedText = match[0];
      if (!matchedText.includes(BLOCK_BOUNDARY_MARKER)) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
        });
      }
      match = regex.exec(virtualText);
    }
  }

  return matches;
}

/**
 * Create DOM Range from virtual text match using character-level mapping
 */
export function createRangeFromVirtualMatch(
  match: VirtualMatch,
  charMap: CharMapEntry[]
): Range | null {
  try {
    // Get character mapping for start and end positions
    const startCharInfo = charMap[match.start];
    const endCharInfo = charMap[match.end - 1]; // end is exclusive, so use end-1

    if (!startCharInfo || !endCharInfo) {
      // Character mapping not found for match
      return null;
    }

    // Skip block boundary markers (auto-inserted markers between block elements)
    if (!startCharInfo.node || !endCharInfo.node) {
      // Match includes block boundary marker, skipping
      return null;
    }

    const range = document.createRange();

    // Set start position
    range.setStart(startCharInfo.node, startCharInfo.offset);

    // Set end position (offset + 1 because Range.setEnd is exclusive)
    range.setEnd(endCharInfo.node, endCharInfo.offset + 1);

    return range;
  } catch (error) {
    // Failed to create range
    handleError(error, 'createRangeFromVirtualMatch: Failed to create range', undefined);
    return null;
  }
}

/**
 * Search and highlight text using virtual text layer and overlay
 */
export function searchText(
  query: string,
  useRegex: boolean,
  caseSensitive: boolean,
  stateManager: SearchStateManager
): SearchResult {
  let count = 0;
  const container = initializeOverlayContainer();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // Step 1: Create virtual text layer with character-level mapping
  const { virtualText, charMap } = createVirtualTextAndMap();

  // Step 2: Search in virtual text
  const matches = searchInVirtualText(query, virtualText, useRegex, caseSensitive);

  // Step 3: Convert virtual matches to DOM ranges and create overlays
  matches.forEach((match) => {
    const range = createRangeFromVirtualMatch(match, charMap);
    if (!range) return;

    try {
      // Get rectangles for this range
      const rects = range.getClientRects();

      // Merge adjacent rectangles to avoid overlapping overlays
      const mergedRects = mergeAdjacentRects(rects);

      // Create overlay for each merged rectangle (handles multi-line matches)
      const isCurrent = count === 0; // First match is current
      for (let i = 0; i < mergedRects.length; i++) {
        const overlay = createOverlay(mergedRects[i], scrollX, scrollY, isCurrent);
        container.appendChild(overlay);
        stateManager.addOverlay(overlay);
      }

      // Store range for position updates
      stateManager.addRange(range);
      count++;
    } catch (error) {
      // Failed to create overlay for range
      handleError(error, 'searchText: Failed to create overlay for range', undefined);
    }
  });

  // Add event listeners for scroll and resize
  if (count > 0) {
    setupEventListeners(stateManager, () => updateOverlayPositions(stateManager));

    // Navigate to first match
    const navResult = navigateToMatch(0, stateManager);
    return {
      count: count,
      currentIndex: navResult.currentIndex,
      totalMatches: navResult.totalMatches,
    };
  }

  return { count: 0, currentIndex: -1, totalMatches: 0 };
}
