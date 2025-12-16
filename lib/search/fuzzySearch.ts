import {
  BLOCK_BOUNDARY_MARKER,
  FUZZY_SEARCH_BASE_MULTIPLIER,
  FUZZY_SEARCH_MAX_DISTANCE,
  FUZZY_SEARCH_MIN_DISTANCE,
} from '~/lib/constants';
import type { MultiKeywordMatch, VirtualMatch } from '~/lib/types';
import { normalizeText } from './normalization';
import { searchInVirtualText } from './textSearch';

/**
 * Calculate maximum distance between keywords based on total keyword length
 * @param totalKeywordLength Total length of all keywords combined
 * @returns Maximum distance in characters
 */
function calculateMaxKeywordDistance(totalKeywordLength: number): number {
  const calculatedDistance = totalKeywordLength * FUZZY_SEARCH_BASE_MULTIPLIER;

  return Math.max(
    FUZZY_SEARCH_MIN_DISTANCE,
    Math.min(calculatedDistance, FUZZY_SEARCH_MAX_DISTANCE)
  );
}

/**
 * Check if any match is completely contained within another match
 * Returns true if any match overlaps with another (one is contained in the other)
 * This prevents matches like "スト" being counted when it's part of "テスト"
 */
function hasOverlappingMatches(matches: VirtualMatch[]): boolean {
  if (matches.length < 2) {
    return false;
  }

  for (let i = 0; i < matches.length; i++) {
    const match1 = matches[i];
    for (let j = i + 1; j < matches.length; j++) {
      const match2 = matches[j];

      // Check if match1 is completely contained within match2
      if (match1.start >= match2.start && match1.end <= match2.end) {
        return true;
      }

      // Check if match2 is completely contained within match1
      if (match2.start >= match1.start && match2.end <= match1.end) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Normalize and validate keywords
 */
function normalizeAndValidateKeywords(keywords: string[]): string[] {
  if (keywords.length === 0) {
    return [];
  }

  const normalizedKeywords = keywords.map(
    (keyword) => normalizeText(keyword.trim()).normalizedText
  );
  return normalizedKeywords.filter((k) => k.length > 0);
}

/**
 * Find matches for each keyword
 */
function findMatchesForKeywords(
  keywords: string[],
  normalizedText: string
): Array<{ keyword: string; matches: VirtualMatch[] }> {
  const keywordMatches: Array<{ keyword: string; matches: VirtualMatch[] }> = [];
  for (const keyword of keywords) {
    const matches = searchInVirtualText(keyword, normalizedText, false, false);
    keywordMatches.push({ keyword, matches });
  }
  return keywordMatches;
}

/**
 * Check if all keywords have at least one match
 */
function allKeywordsHaveMatches(
  keywordMatches: Array<{ keyword: string; matches: VirtualMatch[] }>
): boolean {
  return !keywordMatches.some((km) => km.matches.length === 0);
}

/**
 * Check if combination is valid (no overlaps, within range, no boundary crossing)
 */
function isValidCombination(
  combination: VirtualMatch[],
  normalizedText: string,
  maxDistance: number
): { isValid: boolean; minRange: VirtualMatch | null } {
  // Check for overlapping matches
  if (hasOverlappingMatches(combination)) {
    return { isValid: false, minRange: null };
  }

  // Calculate minimum range
  const minRange = calculateMinRange(combination);
  if (!minRange) {
    return { isValid: false, minRange: null };
  }

  // Check if within maxDistance
  const rangeSize = minRange.end - minRange.start;
  if (rangeSize > maxDistance) {
    return { isValid: false, minRange: null };
  }

  // Check if crosses block boundaries
  if (matchCrossesBoundary(normalizedText, minRange)) {
    return { isValid: false, minRange: null };
  }

  return { isValid: true, minRange };
}

/**
 * Find multi-keyword matches in normalized text
 * Returns matches where all keywords are found within dynamically calculated maxDistance
 */
export function findMultiKeywordMatches(
  keywords: string[],
  normalizedText: string
): MultiKeywordMatch[] {
  if (keywords.length === 0) {
    return [];
  }

  // Normalize and validate keywords
  const validKeywords = normalizeAndValidateKeywords(keywords);
  if (validKeywords.length === 0) {
    return [];
  }

  // Calculate maximum distance based on total keyword length
  const totalKeywordLength = validKeywords.reduce((sum, keyword) => sum + keyword.length, 0);
  const maxDistance = calculateMaxKeywordDistance(totalKeywordLength);

  // Find matches for each keyword
  const keywordMatches = findMatchesForKeywords(validKeywords, normalizedText);

  // Check if all keywords have matches
  if (!allKeywordsHaveMatches(keywordMatches)) {
    return [];
  }

  // Generate all combinations and filter valid ones
  const results: MultiKeywordMatch[] = [];
  const combinations = generateMatchCombinations(keywordMatches);

  for (const combination of combinations) {
    const { isValid, minRange } = isValidCombination(combination, normalizedText, maxDistance);
    if (isValid && minRange) {
      results.push({
        keywords: validKeywords,
        matches: combination,
        minRange,
      });
    }
  }

  return results;
}

/**
 * Generate all combinations of matches for each keyword
 */
function generateMatchCombinations(
  keywordMatches: Array<{ keyword: string; matches: VirtualMatch[] }>
): VirtualMatch[][] {
  if (keywordMatches.length === 0) {
    return [];
  }

  if (keywordMatches.length === 1) {
    return keywordMatches[0].matches.map((match) => [match]);
  }

  // Generate cartesian product of all match arrays
  const combinations: VirtualMatch[][] = [];
  const indices = new Array(keywordMatches.length).fill(0);

  while (true) {
    // Create combination from current indices
    const combination: VirtualMatch[] = [];
    for (let i = 0; i < keywordMatches.length; i++) {
      combination.push(keywordMatches[i].matches[indices[i]]);
    }
    combinations.push(combination);

    // Increment indices
    let i = keywordMatches.length - 1;
    while (i >= 0) {
      indices[i]++;
      if (indices[i] < keywordMatches[i].matches.length) {
        break;
      }
      indices[i] = 0;
      i--;
    }

    if (i < 0) {
      break; // All combinations generated
    }
  }

  return combinations;
}

/**
 * Calculate minimum range that includes all matches
 */
function calculateMinRange(matches: VirtualMatch[]): VirtualMatch | null {
  if (matches.length === 0) {
    return null;
  }

  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = -1;

  for (const match of matches) {
    minStart = Math.min(minStart, match.start);
    maxEnd = Math.max(maxEnd, match.end);
  }

  if (minStart === Number.POSITIVE_INFINITY || maxEnd === -1) {
    return null;
  }

  return { start: minStart, end: maxEnd };
}

/**
 * Check if match crosses block boundaries
 */
function matchCrossesBoundary(text: string, match: VirtualMatch): boolean {
  const matchedText = text.substring(match.start, match.end);
  return matchedText.includes(BLOCK_BOUNDARY_MARKER);
}

/**
 * Split query into keywords (by whitespace)
 */
export function splitQueryIntoKeywords(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter((keyword) => keyword.length > 0);
}
