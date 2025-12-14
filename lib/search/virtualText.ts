/**
 * Virtual text generation for text search
 * Creates a virtual text layer with character-level mapping (Chrome-like innerText behavior)
 */
import type { CharMapEntry } from '~/lib/types';
import { BLOCK_BOUNDARY_MARKER, HIGHLIGHT_OVERLAY_ID } from '~/lib/constants';

// Re-export for backward compatibility
export { BLOCK_BOUNDARY_MARKER };

/**
 * Check if element is block-level
 */
function isBlockLevel(element: Element | null): boolean {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  // Always treat these as inline elements regardless of CSS
  const inlineElements = [
    'SPAN',
    'STRONG',
    'EM',
    'B',
    'I',
    'CODE',
    'KBD',
    'SAMP',
    'VAR',
    'A',
    'ABBR',
    'CITE',
    'Q',
    'MARK',
    'SMALL',
    'SUB',
    'SUP',
  ];
  if (inlineElements.includes(element.tagName)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  const display = style.display;
  return [
    'block',
    'flex',
    'grid',
    'list-item',
    'table',
    'table-row',
    'table-cell',
    'flow-root',
  ].includes(display);
}

/**
 * Find the nearest block-level ancestor
 */
function getNearestBlockAncestor(node: Node): Element {
  let current: Node | null = node;
  while (current && current !== document.body) {
    if (current.nodeType === Node.ELEMENT_NODE && isBlockLevel(current as Element)) {
      return current as Element;
    }
    current = current.parentElement;
  }
  return document.body;
}

/**
 * Check if element is visible
 */
function isVisible(element: Element | null): boolean {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

/**
 * Create virtual text layer with character-level mapping (Chrome-like innerText behavior)
 */
export function createVirtualTextAndMap(): { virtualText: string; charMap: CharMapEntry[] } {
  let virtualText = '';
  const charMap: CharMapEntry[] = []; // Array of { node: TextNode, offset: number } for each character in virtualText
  let lastVisibleNode: Node | null = null;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node: Node) => {
      const parent = node.parentElement;
      // Skip script, style, overlay container
      if (
        !parent ||
        parent.tagName === 'SCRIPT' ||
        parent.tagName === 'STYLE' ||
        parent.id === HIGHLIGHT_OVERLAY_ID ||
        parent.closest(`#${HIGHLIGHT_OVERLAY_ID}`)
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      // Skip invisible elements
      if (!isVisible(parent)) {
        return NodeFilter.FILTER_REJECT;
      }
      // Skip completely empty text nodes (but keep whitespace-only nodes)
      if (!node.nodeValue || node.nodeValue.length === 0) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) {
    const currentNode = walker.currentNode;

    // 1. Handle element boundaries (insert marker when crossing block boundaries)
    if (lastVisibleNode) {
      // Find the nearest block-level ancestor for both nodes
      const prevBlock = getNearestBlockAncestor(lastVisibleNode);
      const currentBlock = getNearestBlockAncestor(currentNode);

      // Insert boundary marker if we're moving to a different block element
      if (prevBlock !== currentBlock) {
        if (!virtualText.endsWith(BLOCK_BOUNDARY_MARKER)) {
          virtualText += BLOCK_BOUNDARY_MARKER;
          // Mark this as block boundary (not from original DOM)
          charMap.push({ node: null, offset: -1, type: 'block-boundary' });
        }
      }
    }

    // 2. Process text content WITHOUT normalization for regex support
    const text = currentNode.nodeValue;
    if (!text) continue;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      virtualText += char;
      charMap.push({ node: currentNode as Text, offset: i });
    }

    lastVisibleNode = currentNode;
  }

  return { virtualText, charMap };
}
