/**
 * Collect search results information for display in results list
 */
import {
  DEFAULT_RESULTS_LIST_CONTEXT_LENGTH,
  MAX_RESULTS_LIST_CONTEXT_LENGTH,
  MIN_RESULTS_LIST_CONTEXT_LENGTH,
} from '~/lib/constants';
import type { SearchResultItem } from '~/lib/types';
import { handleError } from '~/lib/utils/errorHandler';

/**
 * Get text context before a range
 * Uses a simpler approach: get text from the common ancestor
 */
function getContextBefore(range: Range, contextLength: number): string {
  try {
    // Create a range that extends backward from the start of the match
    const contextRange = range.cloneRange();
    const startContainer = range.startContainer;
    const startOffset = range.startOffset;

    // Try to extend backward
    if (startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = startContainer as Text;
      const text = textNode.nodeValue || '';
      const beforeText = text.substring(Math.max(0, startOffset - contextLength), startOffset);

      // If we got enough text, return it
      if (beforeText.length >= contextLength) {
        return beforeText;
      }

      // Otherwise, try to extend to previous siblings
      let remaining = contextLength - beforeText.length;
      let current: Node | null = startContainer.previousSibling;
      let collectedText = beforeText;

      while (remaining > 0 && current) {
        const nodeText = (current as Text).nodeValue || (current as Element).textContent || '';
        const needed = Math.min(remaining, nodeText.length);
        collectedText = nodeText.substring(Math.max(0, nodeText.length - needed)) + collectedText;
        remaining -= needed;
        current = current.previousSibling;
      }

      return collectedText;
    }

    // For non-text nodes, get text from parent
    const parent = startContainer.parentElement;
    if (parent) {
      const parentText = parent.textContent || '';
      const rangeText = range.toString();
      const matchIndex = parentText.indexOf(rangeText);
      if (matchIndex >= 0) {
        const start = Math.max(0, matchIndex - contextLength);
        return parentText.substring(start, matchIndex);
      }
    }

    return '';
  } catch (error) {
    handleError(error, 'getContextBefore: Failed to get context', undefined);
    return '';
  }
}

/**
 * Get text context after a range
 * Uses a simpler approach: get text from the common ancestor
 */
function getContextAfter(range: Range, contextLength: number): string {
  try {
    // Create a range that extends forward from the end of the match
    const endContainer = range.endContainer;
    const endOffset = range.endOffset;

    // Try to extend forward
    if (endContainer.nodeType === Node.TEXT_NODE) {
      const textNode = endContainer as Text;
      const text = textNode.nodeValue || '';
      const afterText = text.substring(endOffset, endOffset + contextLength);

      // If we got enough text, return it
      if (afterText.length >= contextLength) {
        return afterText;
      }

      // Otherwise, try to extend to next siblings
      let remaining = contextLength - afterText.length;
      let current: Node | null = endContainer.nextSibling;
      let collectedText = afterText;

      while (remaining > 0 && current) {
        const nodeText = (current as Text).nodeValue || (current as Element).textContent || '';
        const needed = Math.min(remaining, nodeText.length);
        collectedText += nodeText.substring(0, needed);
        remaining -= needed;
        current = current.nextSibling;
      }

      return collectedText;
    }

    // For non-text nodes, get text from parent
    const parent = endContainer.parentElement;
    if (parent) {
      const parentText = parent.textContent || '';
      const rangeText = range.toString();
      const matchIndex = parentText.indexOf(rangeText);
      if (matchIndex >= 0) {
        const end = matchIndex + rangeText.length;
        const afterEnd = Math.min(parentText.length, end + contextLength);
        return parentText.substring(end, afterEnd);
      }
    }

    return '';
  } catch (error) {
    handleError(error, 'getContextAfter: Failed to get context', undefined);
    return '';
  }
}

/**
 * Normalize context length to valid range
 */
function normalizeContextLength(contextLength: number | undefined): number {
  if (contextLength === undefined) {
    return DEFAULT_RESULTS_LIST_CONTEXT_LENGTH;
  }

  if (contextLength < MIN_RESULTS_LIST_CONTEXT_LENGTH) {
    return MIN_RESULTS_LIST_CONTEXT_LENGTH;
  }

  if (contextLength > MAX_RESULTS_LIST_CONTEXT_LENGTH) {
    return MAX_RESULTS_LIST_CONTEXT_LENGTH;
  }

  return contextLength;
}

/**
 * Collect text search results with context
 */
export function collectTextSearchResults(
  ranges: Range[],
  contextLength?: number
): SearchResultItem[] {
  const normalizedContextLength = normalizeContextLength(contextLength);
  const items: SearchResultItem[] = [];

  ranges.forEach((range, index) => {
    try {
      const matchedText = range.toString();
      const contextBefore = getContextBefore(range, normalizedContextLength);
      const contextAfter = getContextAfter(range, normalizedContextLength);

      // Build full text with ellipsis if context is truncated
      const beforeEllipsis = contextBefore.length >= normalizedContextLength ? '...' : '';
      const afterEllipsis = contextAfter.length >= normalizedContextLength ? '...' : '';
      const fullText =
        beforeEllipsis + contextBefore + matchedText + contextAfter + afterEllipsis;

      items.push({
        index,
        matchedText,
        contextBefore,
        contextAfter,
        fullText,
      });
    } catch (error) {
      handleError(
        error,
        `collectTextSearchResults: Failed to collect result for range ${index}`,
        undefined
      );
    }
  });

  return items;
}

/**
 * Collect element search results
 */
export function collectElementSearchResults(
  elements: Element[],
  contextLength?: number
): SearchResultItem[] {
  const items: SearchResultItem[] = [];

  elements.forEach((element, index) => {
    try {
      // For element search, show the element's text content
      const matchedText = element.textContent?.trim() || element.outerHTML.substring(0, 100);
      const contextBefore = '';
      const contextAfter = '';

      // Build full text
      const fullText = matchedText;

      items.push({
        index,
        matchedText,
        contextBefore,
        contextAfter,
        fullText,
      });
    } catch (error) {
      handleError(
        error,
        `collectElementSearchResults: Failed to collect result for element ${index}`,
        undefined
      );
    }
  });

  return items;
}
