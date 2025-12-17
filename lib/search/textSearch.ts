import { ESCAPED_DOT_PLACEHOLDER } from '~/lib/constants';
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
import {
  getScrollPosition,
  isRectVisibleInScrollableParent,
  isRectVisibleInViewport,
} from '../utils/domUtils';
import { handleError } from '../utils/errorHandler';
import { findMultiKeywordMatches, splitQueryIntoKeywords } from './fuzzySearch';
import { convertNormalizedMatchToOriginal, normalizeText } from './normalization';
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
 * Modify regex query to prevent matching across block boundaries
 * Replaces '.' with pattern that excludes block boundary marker
 */
function modifyRegexQuery(query: string): string {
  // Replace . with [^\uE000] to prevent matching across block boundaries
  // Handle escaped dots (\.) separately - they should match literal dots
  return query
    .replace(/\\\./g, ESCAPED_DOT_PLACEHOLDER) // Temporarily replace \. (literal dot)
    .replace(/\./g, `[^${BLOCK_BOUNDARY_MARKER}\n]`) // Replace . with [^boundary] (excluding newlines too)
    .replace(
      new RegExp(ESCAPED_DOT_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      '\\.'
    ); // Restore \.
}

/**
 * Normalize plain text query for regex search
 * Escapes regex special characters and converts spaces to \s+ for flexible matching
 */
function normalizePlainTextQuery(query: string): string {
  const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escapedQuery.replace(/\s+/g, '\\s+');
}

/**
 * Check if match crosses block boundaries
 */
function matchCrossesBoundary(matchedText: string): boolean {
  return matchedText.includes(BLOCK_BOUNDARY_MARKER);
}

/**
 * Find all matches using regex and filter out those crossing boundaries
 */
function findMatchesWithRegex(regex: RegExp, virtualText: string): VirtualMatch[] {
  const matches: VirtualMatch[] = [];
  let match: RegExpExecArray | null = regex.exec(virtualText);

  while (match !== null) {
    const matchedText = match[0];

    // Skip matches that cross block boundaries
    if (!matchCrossesBoundary(matchedText)) {
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

  return matches;
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
  const flags = caseSensitive ? 'g' : 'gi';

  if (useRegex) {
    // Use user's regex pattern with modified query to prevent matching across block boundaries
    try {
      const modifiedQuery = modifyRegexQuery(query);
      const regex = new RegExp(modifiedQuery, flags);
      return findMatchesWithRegex(regex, virtualText);
    } catch (error) {
      // Invalid regex pattern, return empty matches
      handleError(error, 'searchInVirtualText: Invalid regex pattern', undefined);
      return [];
    }
  } else {
    // Normal search: escape regex special characters, then convert spaces to \s+ for flexible matching
    const normalizedQuery = normalizePlainTextQuery(query);
    const regex = new RegExp(normalizedQuery, flags);
    return findMatchesWithRegex(regex, virtualText);
  }
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
 * Perform single keyword fuzzy search
 */
function performSingleKeywordFuzzySearch(
  query: string,
  normalizedText: string,
  textMapping: { ranges: Array<{ start: number; end: number }> }
): VirtualMatch[] {
  const normalizedQuery = normalizeText(query).normalizedText;
  const normalizedMatches = searchInVirtualText(normalizedQuery, normalizedText, false, false);

  // Convert normalized matches to original virtual text positions
  const matches: VirtualMatch[] = [];
  for (const normalizedMatch of normalizedMatches) {
    const originalMatch = convertNormalizedMatchToOriginal(normalizedMatch, textMapping);
    if (originalMatch) {
      matches.push(originalMatch);
    }
  }
  return matches;
}

/**
 * Perform multi-keyword fuzzy search
 */
function performMultiKeywordFuzzySearch(
  keywords: string[],
  normalizedText: string,
  textMapping: { ranges: Array<{ start: number; end: number }> }
): VirtualMatch[] {
  const multiKeywordMatches = findMultiKeywordMatches(keywords, normalizedText);

  // Convert normalized matches to original virtual text positions
  const matches: VirtualMatch[] = [];
  for (const multiMatch of multiKeywordMatches) {
    const originalMatch = convertNormalizedMatchToOriginal(multiMatch.minRange, textMapping);
    if (originalMatch) {
      matches.push(originalMatch);
    }
  }
  return matches;
}

/**
 * Perform fuzzy search (single or multi-keyword)
 */
function performFuzzySearch(
  query: string,
  normalizedText: string,
  textMapping: { ranges: Array<{ start: number; end: number }> }
): VirtualMatch[] {
  const keywords = splitQueryIntoKeywords(query);
  if (keywords.length > 1) {
    return performMultiKeywordFuzzySearch(keywords, normalizedText, textMapping);
  }
  return performSingleKeywordFuzzySearch(query, normalizedText, textMapping);
}

/**
 * Create text matches from query using virtual text layer
 * @returns Array of DOM Ranges representing matches
 */
export function createTextMatches(
  query: string,
  useRegex: boolean,
  caseSensitive: boolean,
  useFuzzy = false
): Range[] {
  // Step 1: Create virtual text layer with character-level mapping
  const { virtualText, charMap } = createVirtualTextAndMap();

  // Step 2: Search in virtual text
  let matches: VirtualMatch[] = [];

  if (useFuzzy) {
    // Fuzzy search: normalize text and query, then search
    const normalizedResult = normalizeText(virtualText);
    matches = performFuzzySearch(query, normalizedResult.normalizedText, normalizedResult.mapping);
  } else {
    // Normal search
    matches = searchInVirtualText(query, virtualText, useRegex, caseSensitive);
  }

  // Step 3: Convert virtual matches to DOM ranges
  const ranges: Range[] = [];
  matches.forEach((match) => {
    const range = createRangeFromVirtualMatch(match, charMap);
    if (range) {
      ranges.push(range);
    }
  });

  return ranges;
}

/**
 * Create overlays from DOM ranges and add them to state manager
 * @returns Number of matches processed
 */
export function createOverlaysFromRanges(
  ranges: Range[],
  stateManager: SearchStateManager
): number {
  const container = initializeOverlayContainer();
  const { scrollX, scrollY } = getScrollPosition();
  let count = 0;

  ranges.forEach((range) => {
    try {
      // Get rectangles for this range
      const rects = range.getClientRects();

      // Merge adjacent rectangles to avoid overlapping overlays
      const mergedRects = mergeAdjacentRects(rects);

      // Create overlay for each merged rectangle (handles multi-line matches)
      const isCurrent = count === 0; // First match is current
      for (let i = 0; i < mergedRects.length; i++) {
        const rect = mergedRects[i];
        // Only create overlay if rectangle is visible in viewport and within scrollable parents
        if (
          isRectVisibleInViewport(rect) &&
          isRectVisibleInScrollableParent(rect, range.startContainer)
        ) {
          const overlay = createOverlay(rect, scrollX, scrollY, isCurrent);
          container.appendChild(overlay);
          stateManager.addOverlay(overlay);
        }
      }

      // Store range for position updates
      stateManager.addRange(range);
      count++;
    } catch (error) {
      // Failed to create overlay for range
      handleError(error, 'createOverlaysFromRanges: Failed to create overlay for range', undefined);
    }
  });

  return count;
}

/**
 * Search and highlight text using virtual text layer and overlay
 */
export function searchText(
  query: string,
  useRegex: boolean,
  caseSensitive: boolean,
  stateManager: SearchStateManager,
  useFuzzy = false,
  skipNavigation = false
): SearchResult {
  // Step 1: Create text matches
  const ranges = createTextMatches(query, useRegex, caseSensitive, useFuzzy);

  // Step 2: Create overlays from ranges
  const count = createOverlaysFromRanges(ranges, stateManager);

  // Step 3: Add event listeners and navigate to first match
  if (count > 0) {
    setupEventListeners(stateManager, () => updateOverlayPositions(stateManager));

    // Navigate to first match (skip if this is a re-search from DOM observer)
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
}
