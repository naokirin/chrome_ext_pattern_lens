import { BLOCK_BOUNDARY_MARKER, HIGHLIGHT_OVERLAY_ID } from '~/lib/constants';
/**
 * Virtual text generation for text search
 * Creates a virtual text layer with character-level mapping (Chrome-like innerText behavior)
 */
import type { CharMapEntry } from '~/lib/types';

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
 * Create node filter for TreeWalker
 * Filters out script, style, overlay container, invisible elements, and empty text nodes
 */
function createNodeFilter(): (node: Node) => number {
  return (node: Node) => {
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
  };
}

/**
 * Check if boundary marker should be inserted between two nodes
 */
function shouldInsertBoundaryMarker(prevNode: Node, currentNode: Node): boolean {
  const prevBlock = getNearestBlockAncestor(prevNode);
  const currentBlock = getNearestBlockAncestor(currentNode);
  return prevBlock !== currentBlock;
}

/**
 * Insert boundary marker into virtual text and charMap
 */
function insertBoundaryMarker(
  virtualText: string,
  charMap: CharMapEntry[]
): { virtualText: string; charMap: CharMapEntry[] } {
  // Avoid duplicate boundary markers
  if (virtualText.endsWith(BLOCK_BOUNDARY_MARKER)) {
    return { virtualText, charMap };
  }

  const newVirtualText = virtualText + BLOCK_BOUNDARY_MARKER;
  // Mark this as block boundary (not from original DOM)
  const boundaryEntry: CharMapEntry = {
    node: null,
    offset: -1,
    type: 'block-boundary',
  };
  const newCharMap: CharMapEntry[] = [...charMap, boundaryEntry];

  return { virtualText: newVirtualText, charMap: newCharMap };
}

/**
 * Process text node and add to virtual text and charMap
 */
function processTextNode(
  node: Text,
  virtualText: string,
  charMap: CharMapEntry[]
): { virtualText: string; charMap: CharMapEntry[] } {
  const text = node.nodeValue;
  if (!text) {
    return { virtualText, charMap };
  }

  // Process text content WITHOUT normalization for regex support
  let newVirtualText = virtualText;
  const newCharMap = [...charMap];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    newVirtualText += char;
    newCharMap.push({ node, offset: i });
  }

  return { virtualText: newVirtualText, charMap: newCharMap };
}

/**
 * Create virtual text layer with character-level mapping (Chrome-like innerText behavior)
 */
export function createVirtualTextAndMap(): { virtualText: string; charMap: CharMapEntry[] } {
  let virtualText = '';
  const charMap: CharMapEntry[] = [];
  let lastVisibleNode: Node | null = null;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: createNodeFilter(),
  });

  while (walker.nextNode()) {
    const currentNode = walker.currentNode as Text;

    // Handle element boundaries (insert marker when crossing block boundaries)
    if (lastVisibleNode) {
      if (shouldInsertBoundaryMarker(lastVisibleNode, currentNode)) {
        const result = insertBoundaryMarker(virtualText, charMap);
        virtualText = result.virtualText;
        charMap.length = 0;
        charMap.push(...result.charMap);
      }
    }

    // Process text content
    const result = processTextNode(currentNode, virtualText, charMap);
    virtualText = result.virtualText;
    charMap.length = 0;
    charMap.push(...result.charMap);

    lastVisibleNode = currentNode;
  }

  return { virtualText, charMap };
}
