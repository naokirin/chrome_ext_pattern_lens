/**
 * Collect search results information for display in results list
 */
import {
  DEFAULT_RESULTS_LIST_CONTEXT_LENGTH,
  MAX_RESULTS_LIST_CONTEXT_LENGTH,
} from '~/lib/constants';
import type { SearchResultItem } from '~/lib/types';
import { handleError } from '~/lib/utils/errorHandler';

/**
 * Get text context before a range
 * Uses a simpler approach: get text from the common ancestor
 */
function getContextBefore(range: Range, contextLength: number): string {
  try {
    const startContainer = range.startContainer;
    const startOffset = range.startOffset;

    // Try to extend backward from text node
    if (startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = startContainer as Text;
      const text = textNode.nodeValue || '';
      const beforeText = text.substring(Math.max(0, startOffset - contextLength), startOffset);

      // If we got enough text, return it (trimmed to exact length)
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

      // Ensure we don't exceed contextLength (take last contextLength characters)
      if (collectedText.length > contextLength) {
        return collectedText.substring(collectedText.length - contextLength);
      }
      return collectedText;
    }

    // For non-text nodes, get text from parent
    // This is a fallback and may not be accurate if the same text appears multiple times
    const parent = startContainer.parentElement;
    if (parent) {
      const parentText = parent.textContent || '';
      const rangeText = range.toString();
      const matchIndex = parentText.indexOf(rangeText);
      if (matchIndex >= 0) {
        const start = Math.max(0, matchIndex - contextLength);
        let contextText = parentText.substring(start, matchIndex);
        // Ensure we don't exceed contextLength
        if (contextText.length > contextLength) {
          contextText = contextText.substring(contextText.length - contextLength);
        }
        return contextText;
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
    const endContainer = range.endContainer;
    const endOffset = range.endOffset;

    // Try to extend forward from text node
    if (endContainer.nodeType === Node.TEXT_NODE) {
      const textNode = endContainer as Text;
      const text = textNode.nodeValue || '';
      const afterText = text.substring(endOffset, endOffset + contextLength);

      // If we got enough text, return it (trimmed to exact length)
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

      // Ensure we don't exceed contextLength (take first contextLength characters)
      if (collectedText.length > contextLength) {
        return collectedText.substring(0, contextLength);
      }
      return collectedText;
    }

    // For non-text nodes, get text from parent
    // This is a fallback and may not be accurate if the same text appears multiple times
    const parent = endContainer.parentElement;
    if (parent) {
      const parentText = parent.textContent || '';
      const rangeText = range.toString();
      const matchIndex = parentText.indexOf(rangeText);
      if (matchIndex >= 0) {
        const end = matchIndex + rangeText.length;
        const afterEnd = Math.min(parentText.length, end + contextLength);
        let contextText = parentText.substring(end, afterEnd);
        // Ensure we don't exceed contextLength
        if (contextText.length > contextLength) {
          contextText = contextText.substring(0, contextLength);
        }
        return contextText;
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
 * Note: This function is used for user settings validation.
 * For internal use, we allow any positive number (no minimum restriction).
 */
function normalizeContextLength(contextLength: number | undefined): number {
  if (contextLength === undefined) {
    return DEFAULT_RESULTS_LIST_CONTEXT_LENGTH;
  }

  // Allow any positive number for internal use (test cases, etc.)
  // Only enforce maximum limit
  if (contextLength > MAX_RESULTS_LIST_CONTEXT_LENGTH) {
    return MAX_RESULTS_LIST_CONTEXT_LENGTH;
  }

  // Allow 0 or negative values to be treated as 0 (no context)
  if (contextLength <= 0) {
    return 0;
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
      const fullText = beforeEllipsis + contextBefore + matchedText + contextAfter + afterEllipsis;

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
 * Generate tag info string for an element (e.g., "<div#id.class1.class2>")
 */
function getElementTagInfo(element: Element): string {
  let info = element.tagName.toLowerCase();
  if (element.id) {
    info += `#${element.id}`;
  }
  if (element.classList.length > 0) {
    info += `.${Array.from(element.classList).join('.')}`;
  }
  return `<${info}>`;
}

/**
 * Collect element search results
 */
export function collectElementSearchResults(
  elements: Element[],
  contextLength?: number
): SearchResultItem[] {
  const normalizedContextLength = normalizeContextLength(contextLength);
  const items: SearchResultItem[] = [];

  elements.forEach((element, index) => {
    try {
      // Get tag info
      const tagInfo = getElementTagInfo(element);

      // Get text content, truncated to contextLength
      let textContent = element.textContent?.trim() || '';
      if (textContent.length > normalizedContextLength) {
        textContent = `${textContent.substring(0, normalizedContextLength)}...`;
      }

      const matchedText = textContent;
      const contextBefore = '';
      const contextAfter = '';

      // Build full text: tagInfo + text content
      const fullText = `${tagInfo} ${matchedText}`;

      items.push({
        index,
        matchedText,
        contextBefore,
        contextAfter,
        fullText,
        tagInfo,
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
