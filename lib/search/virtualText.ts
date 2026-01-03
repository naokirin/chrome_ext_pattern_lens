import { BLOCK_BOUNDARY_MARKER, HIGHLIGHT_OVERLAY_ID } from '~/lib/constants';
/**
 * Virtual text generation for text search
 * Creates a virtual text layer with character-level mapping (Chrome-like innerText behavior)
 */
import type { CharMapEntry } from '~/lib/types';

// Re-export for backward compatibility
export { BLOCK_BOUNDARY_MARKER };

// ============================================================================
// Non-renderable elements configuration
// ============================================================================

/**
 * Tag names of elements that should not be rendered or processed
 * These elements can cause issues when calling getComputedStyle or processing their content
 */
const NON_RENDERABLE_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'] as const;

/**
 * Check if a tag name represents a non-renderable element
 */
function isNonRenderableTag(tagName: string | null | undefined): boolean {
  if (!tagName) return false;
  return NON_RENDERABLE_TAGS.includes(tagName.toUpperCase() as typeof NON_RENDERABLE_TAGS[number]);
}

/**
 * Check if an element is a non-renderable element
 */
function isNonRenderableElement(element: Element | null): boolean {
  if (!element) return false;
  return isNonRenderableTag(element.tagName);
}

// ============================================================================
// Caching for performance optimization
// ============================================================================

/**
 * Cache for computed styles to avoid repeated getComputedStyle calls
 * Using WeakMap to prevent memory leaks
 */
const computedStyleCache = new WeakMap<Element, CSSStyleDeclaration>();
const visibilityCache = new WeakMap<Element, boolean>();
const blockLevelCache = new WeakMap<Element, boolean>();
const blockAncestorCache = new WeakMap<Node, Element>();

/**
 * Get computed style with caching
 */
function getCachedComputedStyle(element: Element): CSSStyleDeclaration | null {
  // Skip script, style, and other non-renderable elements
  // Calling getComputedStyle on these can cause issues or infinite recursion
  if (isNonRenderableElement(element)) {
    return null;
  }

  // Additional safety check: Skip if element is inside a non-renderable element
  let current: Element | null = element.parentElement;
  let depth = 0;
  const MAX_DEPTH = 50; // 安全のため最大深度を制限
  while (current && depth < MAX_DEPTH) {
    if (isNonRenderableElement(current)) {
      return null;
    }
    current = current.parentElement;
    depth++;
  }

  if (computedStyleCache.has(element)) {
    return computedStyleCache.get(element)!;
  }
  try {
    const style = window.getComputedStyle(element);
    computedStyleCache.set(element, style);
    return style;
  } catch (error) {
    console.error('[VirtualText] Error in getCachedComputedStyle:', {
      error,
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      parentElement: element.parentElement?.tagName || null,
    });
    return null;
  }
}

/**
 * Check if element is block-level
 */
function isBlockLevel(element: Element | null): boolean {
  try {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    // Skip script, style, and other non-renderable elements
    // These should never be processed and calling getComputedStyle on them can cause issues
    if (isNonRenderableElement(element)) {
      return false;
    }

    // キャッシュをチェック
    if (blockLevelCache.has(element)) {
      return blockLevelCache.get(element)!;
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
    if (inlineElements.includes(element.tagName.toUpperCase())) {
      blockLevelCache.set(element, false);
      return false;
    }

    const style = getCachedComputedStyle(element);
    if (!style) {
      blockLevelCache.set(element, false);
      return false;
    }

    const display = style.display;
    const isBlock = [
      'block',
      'flex',
      'grid',
      'list-item',
      'table',
      'table-row',
      'table-cell',
      'flow-root',
    ].includes(display);

    blockLevelCache.set(element, isBlock);
    return isBlock;
  } catch (error) {
    console.error('[VirtualText] Error in isBlockLevel:', {
      error,
      element: element ? {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        parentElement: element.parentElement?.tagName || null,
      } : null,
    });
    return false;
  }
}

/**
 * Find the nearest block-level ancestor
 */
function getNearestBlockAncestor(node: Node): Element {
  try {
    // キャッシュをチェック
    if (blockAncestorCache.has(node)) {
      return blockAncestorCache.get(node)!;
    }

    let current: Node | null = node;
    const visited = new WeakSet<Node>();
    let depth = 0;
    const MAX_DEPTH = 1000; // 安全のため最大深度を制限
    const path: Array<{ tagName: string; id: string; className: string }> = [];

    while (current && current !== document.body && depth < MAX_DEPTH) {
      // 循環参照のチェック
      if (visited.has(current)) {
        break;
      }
      visited.add(current);

      if (current.nodeType === Node.ELEMENT_NODE) {
        const el = current as Element;

        // Skip script, style, and other non-renderable elements
        if (isNonRenderableElement(el)) {
          current = current.parentElement;
          depth++;
          continue;
        }

        path.push({
          tagName: el.tagName,
          id: el.id || '',
          className: el.className || '',
        });

        if (isBlockLevel(el)) {
          const result = el;
          blockAncestorCache.set(node, result);
          return result;
        }
      }
      current = current.parentElement;
      depth++;
    }

    const result = document.body;
    blockAncestorCache.set(node, result);
    return result;
  } catch (error) {
    console.error('[VirtualText] Error in getNearestBlockAncestor:', {
      error,
      nodeType: node.nodeType,
      nodeName: node.nodeName,
      parentElement: node.parentElement?.tagName || null,
    });
    return document.body;
  }
}

/**
 * Check if element is visible
 */
function isVisible(element: Element | null): boolean {
  try {
    if (!element) return false;

    // Skip script, style, and other non-renderable elements
    // These should never be processed and calling getComputedStyle on them can cause issues
    if (isNonRenderableElement(element)) {
      return false;
    }

    // キャッシュをチェック
    if (visibilityCache.has(element)) {
      return visibilityCache.get(element)!;
    }

    const style = getCachedComputedStyle(element);
    if (!style) {
      visibilityCache.set(element, false);
      return false;
    }

    const visible = style.display !== 'none' && style.visibility !== 'hidden';
    visibilityCache.set(element, visible);
    return visible;
  } catch (error) {
    console.error('[VirtualText] Error in isVisible:', {
      error,
      element: element ? {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        parentElement: element.parentElement?.tagName || null,
      } : null,
    });
    return false;
  }
}

/**
 * Check if node or any of its ancestors is a script, style, or other non-renderable element
 */
function isInNonRenderableElement(node: Node): boolean {
  try {
    let current: Node | null = node;
    let depth = 0;
    const MAX_DEPTH = 100; // 安全のため最大深度を制限
    const visited = new WeakSet<Node>(); // 循環参照を防ぐ

    while (current && depth < MAX_DEPTH) {
      // 循環参照のチェック
      if (visited.has(current)) {
        break;
      }
      visited.add(current);

      if (current.nodeType === Node.ELEMENT_NODE) {
        const el = current as Element;
        if (isNonRenderableElement(el)) {
          return true;
        }
      }
      current = current.parentElement;
      depth++;
    }
    return false;
  } catch (error) {
    // エラーが発生した場合は、安全のため true を返す（ノードを除外）
    console.error('[VirtualText] Error in isInNonRenderableElement:', {
      error,
      nodeType: node.nodeType,
      nodeName: node.nodeName,
      parentElement: node.parentElement?.tagName || null,
    });
    return true; // エラー時は安全のため除外
  }
}

/**
 * Create node filter for TreeWalker
 * Filters out script, style, overlay container, invisible elements, and empty text nodes
 */
function createNodeFilter(): (node: Node) => number {
  return (node: Node) => {
    try {
      const parent = node.parentElement;
      if (!parent) {
        return NodeFilter.FILTER_REJECT;
      }

      // CRITICAL: Check parent tag first before any other operations
      // This must be done before calling isVisible() or any function that might call getComputedStyle
      if (isNonRenderableElement(parent)) {
        return NodeFilter.FILTER_REJECT;
      }

      // Check if node or any ancestor is non-renderable (additional safety check)
      if (isInNonRenderableElement(node)) {
        return NodeFilter.FILTER_REJECT;
      }

      // Check for overlay container (direct check instead of closest() to avoid deep recursion)
      let current: Element | null = parent;
      let depth = 0;
      const MAX_DEPTH = 100; // 安全のため最大深度を制限
      while (current && depth < MAX_DEPTH) {
        if (current.id === HIGHLIGHT_OVERLAY_ID) {
          return NodeFilter.FILTER_REJECT;
        }
        current = current.parentElement;
        depth++;
      }

      // Skip invisible elements (only call isVisible after we've confirmed parent is not style/script)
      // isVisible will also check for style/script internally, but we want to avoid calling it
      // on style/script elements in the first place
      if (!isVisible(parent)) {
        return NodeFilter.FILTER_REJECT;
      }
      // Skip completely empty text nodes (but keep whitespace-only nodes)
      if (!node.nodeValue || node.nodeValue.length === 0) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    } catch (error) {
      // If any error occurs, reject the node to be safe
      console.error('[VirtualText] Error in createNodeFilter:', {
        error,
        nodeType: node.nodeType,
        nodeName: node.nodeName,
        parentElement: node.parentElement?.tagName || null,
      });
      return NodeFilter.FILTER_REJECT;
    }
  };
}

/**
 * Check if boundary marker should be inserted between two nodes
 */
function shouldInsertBoundaryMarker(prevNode: Node, currentNode: Node): boolean {
  try {
    // CRITICAL: Direct check of parent tags before any other operations
    const prevParent = prevNode.parentElement;
    const currentParent = currentNode.parentElement;

    if (isNonRenderableElement(prevParent) || isNonRenderableElement(currentParent)) {
      return false;
    }

    // Safety check: Skip if either node is in non-renderable element
    if (isInNonRenderableElement(prevNode) || isInNonRenderableElement(currentNode)) {
      return false;
    }

    const prevBlock = getNearestBlockAncestor(prevNode);
    const currentBlock = getNearestBlockAncestor(currentNode);
    return prevBlock !== currentBlock;
  } catch (error) {
    console.error('[VirtualText] Error in shouldInsertBoundaryMarker:', {
      error,
      prevNode: {
        nodeType: prevNode.nodeType,
        nodeName: prevNode.nodeName,
        parentElement: prevNode.parentElement?.tagName || null,
      },
      currentNode: {
        nodeType: currentNode.nodeType,
        nodeName: currentNode.nodeName,
        parentElement: currentNode.parentElement?.tagName || null,
      },
    });
    return false;
  }
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
  try {
    let virtualText = '';
    const charMap: CharMapEntry[] = [];
    let lastVisibleNode: Node | null = null;

    // Create a custom filter that explicitly rejects style/script nodes
    const nodeFilter = createNodeFilter();

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node: Node) => {
        // Additional immediate check before calling the filter
        const parent = node.parentElement;
        if (isNonRenderableElement(parent)) {
          return NodeFilter.FILTER_REJECT;
        }
        return nodeFilter(node);
      },
    });

    const MAX_NODES = 100000; // 安全のため最大ノード数を制限
    let nodeCount = 0;

    while (walker.nextNode() && nodeCount < MAX_NODES) {
      try {
        const currentNode = walker.currentNode as Text;

        // CRITICAL: Safety check - MUST be first thing we do
        // Skip if node is in non-renderable element
        // This is a defensive check in case the filter didn't catch it
        const parent = currentNode.parentElement;
        if (!parent) {
          nodeCount++;
          continue;
        }

        // Direct check of parent tag (fastest check)
        if (isNonRenderableElement(parent)) {
          nodeCount++;
          continue;
        }

        // Additional check using isInNonRenderableElement (defensive programming)
        if (isInNonRenderableElement(currentNode)) {
          nodeCount++;
          continue;
        }

        // Only increment nodeCount if we're actually processing this node
        nodeCount++;

        // Handle element boundaries (insert marker when crossing block boundaries)
        if (lastVisibleNode) {
          // CRITICAL: Double-check both nodes before calling shouldInsertBoundaryMarker
          // This prevents getNearestBlockAncestor from being called on style/script nodes
          const lastParent = lastVisibleNode.parentElement;
          const currentParent = currentNode.parentElement;

          // ABSOLUTELY DO NOT call shouldInsertBoundaryMarker if either node is in non-renderable element
          if (isNonRenderableElement(lastParent) || isNonRenderableElement(currentParent)) {
            // Skip boundary marker insertion for non-renderable elements
            // Do not update lastVisibleNode either
            continue;
          }

          // Additional safety check using isInNonRenderableElement
          if (isInNonRenderableElement(lastVisibleNode) || isInNonRenderableElement(currentNode)) {
            continue;
          }

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

        // Only set lastVisibleNode if currentNode passed all checks
        lastVisibleNode = currentNode;
      } catch (nodeError) {
        console.error('[VirtualText] Error processing node:', {
          error: nodeError,
          nodeCount,
          currentNode: {
            nodeType: walker.currentNode.nodeType,
            nodeName: walker.currentNode.nodeName,
            parentElement: walker.currentNode.parentElement?.tagName || null,
            textContent: walker.currentNode.textContent?.substring(0, 50) || null,
          },
          lastVisibleNode: lastVisibleNode ? {
            nodeType: lastVisibleNode.nodeType,
            nodeName: lastVisibleNode.nodeName,
            parentElement: lastVisibleNode.parentElement?.tagName || null,
          } : null,
        });
        // エラーが発生したノードはスキップして続行
        continue;
      }
    }

    // 上限に達した場合は警告を出力
    if (nodeCount >= MAX_NODES) {
      console.warn('[VirtualText] Maximum node count reached, truncating results');
    }

    return { virtualText, charMap };
  } catch (error) {
    // スタックオーバーフローやその他のエラーをキャッチ
    console.error('[VirtualText] Error in createVirtualTextAndMap:', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      documentBody: document.body ? {
        tagName: document.body.tagName,
        childElementCount: document.body.childElementCount,
      } : null,
    });
    // 空の結果を返してクラッシュを防ぐ
    return { virtualText: '', charMap: [] };
  }
}
