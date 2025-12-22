import {
  ESCAPED_DOT_PLACEHOLDER,
  FUZZY_SEARCH_BASE_MULTIPLIER,
  FUZZY_SEARCH_MAX_DISTANCE,
  FUZZY_SEARCH_MIN_DISTANCE,
} from '~/lib/constants';
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
  findClosestMatchIndex,
  getScrollPosition,
  isRectVisibleInScrollableParent,
  isRectVisibleInViewport,
} from '../utils/domUtils';
import { handleError } from '../utils/errorHandler';
import { findMultiKeywordMatches, splitQueryIntoKeywords } from './fuzzySearch';
import {
  convertNormalizedMatchToOriginal,
  expandQueryForAccentedChars,
  isAccentedCharInQuery,
  normalizeText,
} from './normalization';
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
 * Merge adjacent matches that refer to the same original range
 * This handles cases where a single character (like 'ä') normalizes to multiple characters ('ae')
 * and we want to match the entire original character, not just parts of it
 *
 * Also handles cases where query 'a' matches 'ae' (from 'ä') - we want to match the entire 'ae'
 */
function mergeAdjacentMatchesWithSameRange(
  matches: VirtualMatch[],
  textMapping: { ranges: Array<{ start: number; end: number }> }
): VirtualMatch[] {
  if (matches.length === 0) {
    return matches;
  }

  // Sort matches by start position
  const sortedMatches = [...matches].sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    return a.end - b.end;
  });

  // Remove exact duplicates
  const uniqueMatches: VirtualMatch[] = [];
  for (let i = 0; i < sortedMatches.length; i++) {
    const match = sortedMatches[i];
    if (
      i === 0 ||
      match.start !== sortedMatches[i - 1].start ||
      match.end !== sortedMatches[i - 1].end
    ) {
      uniqueMatches.push(match);
    }
  }

  // Group matches by their original range
  // Matches that refer to the same original range should be merged
  const rangeGroups = new Map<string, VirtualMatch[]>();
  for (const match of uniqueMatches) {
    const rangeKey = `${match.start}-${match.end}`;
    if (!rangeGroups.has(rangeKey)) {
      rangeGroups.set(rangeKey, []);
    }
    const group = rangeGroups.get(rangeKey);
    if (group) {
      group.push(match);
    }
  }

  // For each group, if there are multiple matches, check if they should be merged
  // This happens when 'a' matches part of 'ae' (from 'ä'), and we want to match the entire 'ae'
  const merged: VirtualMatch[] = [];
  const processed = new Set<string>();

  for (const match of uniqueMatches) {
    const rangeKey = `${match.start}-${match.end}`;
    if (processed.has(rangeKey)) {
      continue;
    }

    // Check if this match is part of a larger range that should be matched
    // Look for adjacent matches that refer to the same original character
    let expandedMatch: VirtualMatch | null = null;

    // Check if there are matches immediately after this one that refer to the same original range
    // This happens when 'ä' → 'ae': 'a' matches, and 'e' also refers to the same original range
    for (const otherMatch of uniqueMatches) {
      if (
        otherMatch.start === match.end &&
        otherMatch.start < textMapping.ranges.length &&
        match.start < textMapping.ranges.length
      ) {
        // Check if they refer to the same original range
        const matchRange = textMapping.ranges[match.start];
        const otherMatchRange = textMapping.ranges[otherMatch.start];

        if (
          matchRange &&
          otherMatchRange &&
          matchRange.start === otherMatchRange.start &&
          matchRange.end === otherMatchRange.end
        ) {
          // They refer to the same original character (like 'ä' → 'ae')
          // Merge them to match the entire original character
          expandedMatch = {
            start: match.start,
            end: otherMatch.end,
          };
          processed.add(`${otherMatch.start}-${otherMatch.end}`);
          break;
        }
      }
    }

    if (expandedMatch) {
      merged.push(expandedMatch);
    } else {
      merged.push(match);
    }

    processed.add(rangeKey);
  }

  return merged;
}

/**
 * Expand matches to include adjacent characters that refer to the same original range
 * This handles cases where 'a' matches part of 'ae' (from 'ä'), and we want to match the entire 'ae'
 */
function expandMatchesToSameRange(
  normalizedMatches: VirtualMatch[],
  normalizedText: string,
  textMapping: { ranges: Array<{ start: number; end: number }> }
): VirtualMatch[] {
  const expanded: VirtualMatch[] = [];

  for (const match of normalizedMatches) {
    const expandedMatch = { ...match };

    // Check if there are adjacent characters in normalized text that refer to the same original range
    // This happens when 'ä' → 'ae': 'a' matches, and 'e' also refers to the same original range
    let currentPos = match.end;
    while (currentPos < normalizedText.length && currentPos < textMapping.ranges.length) {
      const currentRange = textMapping.ranges[currentPos];
      const matchRange = textMapping.ranges[match.start];

      if (
        currentRange &&
        matchRange &&
        currentRange.start === matchRange.start &&
        currentRange.end === matchRange.end
      ) {
        // This character refers to the same original range, expand the match
        expandedMatch.end = currentPos + 1;
        currentPos++;
      } else {
        break;
      }
    }

    expanded.push(expandedMatch);
  }

  return expanded;
}

/**
 * Get accented characters from query and their normalized positions
 * Returns a map of normalized position to original accented character
 * Optimized version that uses the normalized result directly
 */
function getQueryAccentedChars(
  query: string,
  normalizedResult: {
    normalizedText: string;
    mapping: { ranges: Array<{ start: number; end: number }> };
  }
): Map<number, string> {
  const accentedChars = new Map<number, string>();

  // Map each normalized position back to the original query character
  // When a character normalizes to multiple characters (e.g., ä → ae), all positions should map to the original char
  // Optimize by iterating through ranges once instead of nested loops
  for (let j = 0; j < normalizedResult.mapping.ranges.length; j++) {
    const range = normalizedResult.mapping.ranges[j];
    const originalIndex = range.start;
    if (originalIndex < query.length) {
      const char = query[originalIndex];
      if (isAccentedCharInQuery(char)) {
        accentedChars.set(j, char);
      }
    }
  }

  return accentedChars;
}

/**
 * Case-insensitive mapping for accented characters
 * Maps both uppercase and lowercase versions to a canonical form (lowercase)
 */
const ACCENTED_CHAR_CASE_MAPPING = new Map<string, string>([
  // German umlauts
  ['ä', 'ä'],
  ['Ä', 'ä'],
  ['ö', 'ö'],
  ['Ö', 'ö'],
  ['ü', 'ü'],
  ['Ü', 'ü'],
  // French
  ['à', 'à'],
  ['À', 'à'],
  ['â', 'â'],
  ['Â', 'â'],
  ['ç', 'ç'],
  ['Ç', 'ç'],
  ['é', 'é'],
  ['É', 'é'],
  ['è', 'è'],
  ['È', 'è'],
  ['ê', 'ê'],
  ['Ê', 'ê'],
  ['ë', 'ë'],
  ['Ë', 'ë'],
  ['î', 'î'],
  ['Î', 'î'],
  ['ï', 'ï'],
  ['Ï', 'ï'],
  ['ô', 'ô'],
  ['Ô', 'ô'],
  ['ù', 'ù'],
  ['Ù', 'ù'],
  ['û', 'û'],
  ['Û', 'û'],
  ['ÿ', 'ÿ'],
  ['Ÿ', 'ÿ'],
  ['œ', 'œ'],
  ['Œ', 'œ'],
  // Italian
  ['ì', 'ì'],
  ['Ì', 'ì'],
  ['ò', 'ò'],
  ['Ò', 'ò'],
  // Spanish
  ['á', 'á'],
  ['Á', 'á'],
  ['í', 'í'],
  ['Í', 'í'],
  ['ñ', 'ñ'],
  ['Ñ', 'ñ'],
  ['ó', 'ó'],
  ['Ó', 'ó'],
  ['ú', 'ú'],
  ['Ú', 'ú'],
  // Portuguese
  ['ã', 'ã'],
  ['Ã', 'ã'],
  ['õ', 'õ'],
  ['Õ', 'õ'],
  // Scandinavian
  ['å', 'å'],
  ['Å', 'å'],
  ['æ', 'æ'],
  ['Æ', 'æ'],
  ['ø', 'ø'],
  ['Ø', 'ø'],
  // Other European languages
  ['č', 'č'],
  ['Č', 'č'],
  ['ć', 'ć'],
  ['Ć', 'ć'],
  ['đ', 'đ'],
  ['Đ', 'đ'],
  ['š', 'š'],
  ['Š', 'š'],
  ['ž', 'ž'],
  ['Ž', 'ž'],
  ['ł', 'ł'],
  ['Ł', 'ł'],
  ['ń', 'ń'],
  ['Ń', 'ń'],
  ['ś', 'ś'],
  ['Ś', 'ś'],
  ['ź', 'ź'],
  ['Ź', 'ź'],
  ['ż', 'ż'],
  ['Ż', 'ż'],
  // Romanian
  ['ă', 'ă'],
  ['Ă', 'ă'],
  ['ș', 'ș'],
  ['Ș', 'ș'],
  ['ț', 'ț'],
  ['Ț', 'ț'],
  // Czech/Slovak
  ['ý', 'ý'],
  ['Ý', 'ý'],
]);

/**
 * Check if two accented characters match case-insensitively
 */
function accentedCharsMatchCaseInsensitive(char1: string, char2: string): boolean {
  const canonical1 = ACCENTED_CHAR_CASE_MAPPING.get(char1) || char1.toLowerCase();
  const canonical2 = ACCENTED_CHAR_CASE_MAPPING.get(char2) || char2.toLowerCase();
  return canonical1 === canonical2;
}

/**
 * Pre-compute original character lookup map for faster access
 */
function buildOriginalCharMap(
  textMapping: { ranges: Array<{ start: number; end: number }> },
  originalText: string
): Map<number, string> {
  const charMap = new Map<number, string>();
  for (let i = 0; i < textMapping.ranges.length; i++) {
    const range = textMapping.ranges[i];
    if (range && range.start < originalText.length) {
      charMap.set(i, originalText[range.start]);
    }
  }
  return charMap;
}

/**
 * Check if the original character at the given position matches the query accented character
 * Optimized version using pre-computed character map
 */
function doesOriginalCharMatchQueryAccentedChar(
  normalizedPos: number,
  queryNormalizedPos: number,
  originalCharMap: Map<number, string>,
  queryAccentedChars: Map<number, string>
): boolean {
  const originalChar = originalCharMap.get(normalizedPos);
  if (!originalChar) {
    return false;
  }

  const queryAccentedChar = queryAccentedChars.get(queryNormalizedPos);

  // If query has an accented char at this position, original char must match (case-insensitive)
  if (queryAccentedChar) {
    return accentedCharsMatchCaseInsensitive(originalChar, queryAccentedChar);
  }

  // If query doesn't have an accented char at this position, allow any character
  return true;
}

/**
 * Filter matches to only include those where original characters match query accented characters exactly
 */
function filterMatchesByAccentedChars(
  normalizedMatches: VirtualMatch[],
  originalCharMap: Map<number, string>,
  queryHasAccentedChars: boolean,
  queryAccentedChars: Map<number, string>,
  normalizedQuery: string
): VirtualMatch[] {
  if (!queryHasAccentedChars || queryAccentedChars.size === 0) {
    return normalizedMatches;
  }

  // If query has accented characters, only match positions where original text has the same accented characters
  // Optimize by pre-checking if match length matches query length
  const queryLength = normalizedQuery.length;
  const accentedPositions = Array.from(queryAccentedChars.keys());

  return normalizedMatches.filter((match) => {
    const matchLength = match.end - match.start;

    // Quick check: match length must match query length
    if (matchLength !== queryLength) {
      return false;
    }

    // Only check positions where query has accented characters
    for (const queryPos of accentedPositions) {
      if (queryPos >= matchLength) {
        continue;
      }

      const matchPos = match.start + queryPos;
      if (
        !doesOriginalCharMatchQueryAccentedChar(
          matchPos,
          queryPos,
          originalCharMap,
          queryAccentedChars
        )
      ) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Perform single keyword fuzzy search with accented character expansion
 */
function performSingleKeywordFuzzySearch(
  query: string,
  normalizedText: string,
  textMapping: { ranges: Array<{ start: number; end: number }> },
  originalText?: string
): VirtualMatch[] {
  // Early return if query is empty
  if (query.length === 0) {
    return [];
  }

  // Check if query contains accented characters
  let queryHasAccentedChars = false;
  for (let i = 0; i < query.length; i++) {
    if (isAccentedCharInQuery(query[i])) {
      queryHasAccentedChars = true;
      break;
    }
  }

  // Expand query to handle accented characters (e.g., 'ä' → ['a', 'ae'])
  const expandedQueries = expandQueryForAccentedChars(query);

  // Fast path: if only one expanded query and no accented chars in query, use simple search
  if (expandedQueries.length === 1 && !queryHasAccentedChars) {
    const normalizedQuery = normalizeText(expandedQueries[0]).normalizedText;
    const normalizedMatches = searchInVirtualText(normalizedQuery, normalizedText, false, false);

    // Expand matches to include adjacent characters that refer to the same original range
    const expandedNormalizedMatches = expandMatchesToSameRange(
      normalizedMatches,
      normalizedText,
      textMapping
    );

    // Convert normalized matches to original virtual text positions
    const allMatches: VirtualMatch[] = [];
    for (const normalizedMatch of expandedNormalizedMatches) {
      const originalMatch = convertNormalizedMatchToOriginal(normalizedMatch, textMapping);
      if (originalMatch) {
        allMatches.push(originalMatch);
      }
    }

    return mergeAdjacentMatchesWithSameRange(allMatches, textMapping);
  }

  // Pre-compute query normalized result and accented chars once to avoid redundant calculations
  const queryNormalizedResult = queryHasAccentedChars ? normalizeText(query) : null;
  const queryAccentedChars =
    queryHasAccentedChars && queryNormalizedResult
      ? getQueryAccentedChars(query, queryNormalizedResult)
      : new Map<number, string>();

  // Pre-compute original character map for faster lookups
  const originalCharMap = originalText
    ? buildOriginalCharMap(textMapping, originalText)
    : new Map<number, string>();

  // Pre-compute normalized results for expanded queries to avoid redundant calculations
  const expandedQueryResults = expandedQueries.map((expandedQuery) => {
    const normalizedResult = normalizeText(expandedQuery);
    return {
      normalizedQuery: normalizedResult.normalizedText,
    };
  });

  // Search with each expanded query pattern
  const allMatches: VirtualMatch[] = [];
  for (const { normalizedQuery } of expandedQueryResults) {
    const normalizedMatches = searchInVirtualText(normalizedQuery, normalizedText, false, false);

    // Early return if no matches found
    if (normalizedMatches.length === 0) {
      continue;
    }

    // Filter matches: if query has accented chars, only match positions where original text has the same accented chars
    const filteredMatches = filterMatchesByAccentedChars(
      normalizedMatches,
      originalCharMap,
      queryHasAccentedChars,
      queryAccentedChars,
      normalizedQuery
    );

    // Early return if no filtered matches
    if (filteredMatches.length === 0) {
      continue;
    }

    // Expand matches to include adjacent characters that refer to the same original range
    const expandedNormalizedMatches = expandMatchesToSameRange(
      filteredMatches,
      normalizedText,
      textMapping
    );

    // Convert normalized matches to original virtual text positions
    for (const normalizedMatch of expandedNormalizedMatches) {
      const originalMatch = convertNormalizedMatchToOriginal(normalizedMatch, textMapping);
      if (originalMatch) {
        allMatches.push(originalMatch);
      }
    }
  }

  // Remove duplicates and merge adjacent matches with same range
  const uniqueMatches = mergeAdjacentMatchesWithSameRange(allMatches, textMapping);

  return uniqueMatches;
}

/**
 * Perform multi-keyword fuzzy search
 */
function performMultiKeywordFuzzySearch(
  keywords: string[],
  normalizedText: string,
  textMapping: { ranges: Array<{ start: number; end: number }> },
  baseMultiplier: number,
  minDistance: number,
  maxDistance: number
): VirtualMatch[] {
  const multiKeywordMatches = findMultiKeywordMatches(
    keywords,
    normalizedText,
    baseMultiplier,
    minDistance,
    maxDistance
  );

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
  textMapping: { ranges: Array<{ start: number; end: number }> },
  baseMultiplier: number,
  minDistance: number,
  maxDistance: number,
  originalText?: string
): VirtualMatch[] {
  const keywords = splitQueryIntoKeywords(query);
  if (keywords.length > 1) {
    return performMultiKeywordFuzzySearch(
      keywords,
      normalizedText,
      textMapping,
      baseMultiplier,
      minDistance,
      maxDistance
    );
  }
  return performSingleKeywordFuzzySearch(query, normalizedText, textMapping, originalText);
}

/**
 * Create text matches from query using virtual text layer
 * @param baseMultiplier Multiplier for fuzzy search range calculation (default: FUZZY_SEARCH_BASE_MULTIPLIER)
 * @param minDistance Minimum distance for fuzzy search (default: FUZZY_SEARCH_MIN_DISTANCE)
 * @param maxDistance Maximum distance for fuzzy search (default: FUZZY_SEARCH_MAX_DISTANCE)
 * @returns Array of DOM Ranges representing matches
 */
export function createTextMatches(
  query: string,
  useRegex: boolean,
  caseSensitive: boolean,
  useFuzzy = false,
  baseMultiplier: number = FUZZY_SEARCH_BASE_MULTIPLIER,
  minDistance: number = FUZZY_SEARCH_MIN_DISTANCE,
  maxDistance: number = FUZZY_SEARCH_MAX_DISTANCE
): Range[] {
  // Step 1: Create virtual text layer with character-level mapping
  const { virtualText, charMap } = createVirtualTextAndMap();

  // Step 2: Search in virtual text
  let matches: VirtualMatch[] = [];

  if (useFuzzy) {
    // Fuzzy search: normalize text and query, then search
    const normalizedResult = normalizeText(virtualText);
    matches = performFuzzySearch(
      query,
      normalizedResult.normalizedText,
      normalizedResult.mapping,
      baseMultiplier,
      minDistance,
      maxDistance,
      normalizedResult.originalText
    );
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
 * @param baseMultiplier Multiplier for fuzzy search range calculation (default: FUZZY_SEARCH_BASE_MULTIPLIER)
 * @param minDistance Minimum distance for fuzzy search (default: FUZZY_SEARCH_MIN_DISTANCE)
 * @param maxDistance Maximum distance for fuzzy search (default: FUZZY_SEARCH_MAX_DISTANCE)
 */
export function searchText(
  query: string,
  useRegex: boolean,
  caseSensitive: boolean,
  stateManager: SearchStateManager,
  useFuzzy = false,
  skipNavigation = false,
  previousIndex = -1,
  baseMultiplier: number = FUZZY_SEARCH_BASE_MULTIPLIER,
  minDistance: number = FUZZY_SEARCH_MIN_DISTANCE,
  maxDistance: number = FUZZY_SEARCH_MAX_DISTANCE
): SearchResult {
  // Step 1: Create text matches
  const ranges = createTextMatches(
    query,
    useRegex,
    caseSensitive,
    useFuzzy,
    baseMultiplier,
    minDistance,
    maxDistance
  );

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

    // For re-search, preserve the previous index if valid, otherwise find closest
    let newIndex: number;
    if (previousIndex >= 0 && previousIndex < count) {
      // Previous index is still valid
      newIndex = previousIndex;
    } else if (previousIndex >= count) {
      // Previous index is out of range (items removed), use last valid index
      newIndex = count - 1;
    } else {
      // No previous index, find closest to viewport center
      newIndex = findClosestMatchIndex(stateManager.overlays);
    }
    stateManager.setCurrentIndex(newIndex);
    return { count: count, currentIndex: newIndex, totalMatches: count };
  }

  return { count: 0, currentIndex: -1, totalMatches: 0 };
}
