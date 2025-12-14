import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupDOM, createDOMFromHTML, visualizeBoundaries } from '../../helpers/dom-helpers.js';

// Since content_scripts/main.js is not a module, we need to test it by loading it in the global scope
// For now, we'll manually extract and test the key functions

const BLOCK_BOUNDARY_MARKER = '\uE000';

// Helper functions extracted from main.js for testing
function isBlockLevel(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

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

function getNearestBlockAncestor(node) {
  let current = node;
  while (current && current !== document.body) {
    if (current.nodeType === Node.ELEMENT_NODE && isBlockLevel(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return document.body;
}

function isVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function createVirtualTextAndMap() {
  let virtualText = '';
  const charMap = [];
  let lastVisibleNode = null;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || !isVisible(parent)) {
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

    if (lastVisibleNode) {
      const prevBlock = getNearestBlockAncestor(lastVisibleNode);
      const currentBlock = getNearestBlockAncestor(currentNode);

      if (prevBlock !== currentBlock) {
        if (!virtualText.endsWith(BLOCK_BOUNDARY_MARKER)) {
          virtualText += BLOCK_BOUNDARY_MARKER;
          charMap.push({ node: null, offset: -1, type: 'block-boundary' });
        }
      }
    }

    const text = currentNode.nodeValue;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      virtualText += char;
      charMap.push({ node: currentNode, offset: i });
    }

    lastVisibleNode = currentNode;
  }

  return { virtualText, charMap };
}

describe('createVirtualTextAndMap', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('should create virtual text from simple inline elements', () => {
    document.body.innerHTML = '<span>Hello</span><span>World</span>';

    const { virtualText, charMap } = createVirtualTextAndMap();

    // Inline elements should not have boundary markers between them
    expect(virtualText).toBe('HelloWorld');
    expect(charMap.length).toBe(10);
  });

  it('should insert boundary marker between block elements', () => {
    document.body.innerHTML = '<div>Hello</div><div>World</div>';

    const { virtualText, charMap } = createVirtualTextAndMap();

    // Block elements should have boundary marker between them
    expect(virtualText).toBe(`Hello${BLOCK_BOUNDARY_MARKER}World`);
    expect(charMap.length).toBe(11); // 5 + 1 (boundary) + 5

    // Check boundary marker in charMap
    const boundaryIndex = charMap.findIndex((item) => item.type === 'block-boundary');
    expect(boundaryIndex).toBe(5);
    expect(charMap[boundaryIndex].node).toBe(null);
  });

  it('should handle nested inline elements within block elements', () => {
    document.body.innerHTML = '<div><span>Hello</span><span>World</span></div>';

    const { virtualText, charMap } = createVirtualTextAndMap();

    // All text is within the same block, so no boundary markers
    expect(virtualText).toBe('HelloWorld');
    expect(visualizeBoundaries(virtualText)).toBe('HelloWorld');
  });

  it('should preserve whitespace between inline elements', () => {
    document.body.innerHTML = '<div><span>Hello</span> <span>World</span></div>';

    const { virtualText, charMap } = createVirtualTextAndMap();

    // Whitespace text node should be preserved
    expect(virtualText).toBe('Hello World');
    expect(visualizeBoundaries(virtualText)).toBe('Hello World');
  });

  it('should handle paragraph elements (test case 2-2 from test-cross-element.html)', () => {
    document.body.innerHTML = '<p>Lorem ipsum</p><p>dolor sit</p>';

    const { virtualText, charMap } = createVirtualTextAndMap();

    // Should insert boundary marker between paragraphs
    expect(virtualText).toBe(`Lorem ipsum${BLOCK_BOUNDARY_MARKER}dolor sit`);
    expect(visualizeBoundaries(virtualText)).toBe('Lorem ipsum[BOUNDARY]dolor sit');
  });

  it('should handle heading and paragraph elements (test case 2-3)', () => {
    document.body.innerHTML = '<h4>Important Note</h4><p>This is critical</p>';

    const { virtualText, charMap } = createVirtualTextAndMap();

    // Should insert boundary marker between heading and paragraph
    expect(virtualText).toBe(`Important Note${BLOCK_BOUNDARY_MARKER}This is critical`);
  });

  it('should handle list items (test case 3-2)', () => {
    document.body.innerHTML = `
      <ul>
        <li>First</li>
        <li>Second</li>
        <li>Third</li>
      </ul>
    `;

    const { virtualText, charMap } = createVirtualTextAndMap();

    // List items are block-level, so should have boundary markers between them
    const visible = visualizeBoundaries(virtualText);
    expect(visible).toContain('First');
    expect(visible).toContain('Second');
    expect(visible).toContain('Third');
    expect(visible).toContain('[BOUNDARY]');
  });

  it('should handle table cells (test case 3-3)', () => {
    document.body.innerHTML = `
      <table>
        <tr>
          <td>Cell</td>
          <td>One</td>
          <td>Two</td>
        </tr>
      </table>
    `;

    const { virtualText, charMap } = createVirtualTextAndMap();

    // Table cells are block-level, so should have boundary markers
    const visible = visualizeBoundaries(virtualText);
    expect(visible).toContain('Cell');
    expect(visible).toContain('One');
    expect(visible).toContain('Two');
    expect(visible).toContain('[BOUNDARY]');
  });

  it('should preserve whitespace-only text nodes', () => {
    document.body.innerHTML = '<div>   </div><div>Text</div>';

    const { virtualText, charMap } = createVirtualTextAndMap();

    // Whitespace-only text nodes are preserved, with boundary marker between blocks
    expect(virtualText).toBe(`   ${BLOCK_BOUNDARY_MARKER}Text`);
  });

  it('should skip hidden elements', () => {
    document.body.innerHTML = '<div style="display: none;">Hidden</div><div>Visible</div>';

    const { virtualText, charMap } = createVirtualTextAndMap();

    // Hidden elements should be skipped
    expect(virtualText).toBe('Visible');
  });

  it('should handle mixed inline and block elements', () => {
    document.body.innerHTML =
      '<div><span>git</span><span>commit</span><span>-m</span></div><div>"message"</div>';

    const { virtualText, charMap } = createVirtualTextAndMap();

    // Inline elements within same block: no boundary
    // Different block elements: boundary marker
    const visible = visualizeBoundaries(virtualText);
    expect(visible).toBe('gitcommit-m[BOUNDARY]"message"');
  });

  it('should correctly map characters to DOM nodes', () => {
    document.body.innerHTML = '<div>AB</div><div>CD</div>';

    const { virtualText, charMap } = createVirtualTextAndMap();

    // Verify character mapping
    expect(charMap[0].node.nodeValue).toBe('AB');
    expect(charMap[0].offset).toBe(0);
    expect(charMap[1].node.nodeValue).toBe('AB');
    expect(charMap[1].offset).toBe(1);

    // Boundary marker
    expect(charMap[2].type).toBe('block-boundary');
    expect(charMap[2].node).toBe(null);

    // Second block
    expect(charMap[3].node.nodeValue).toBe('CD');
    expect(charMap[3].offset).toBe(0);
    expect(charMap[4].node.nodeValue).toBe('CD');
    expect(charMap[4].offset).toBe(1);
  });
});
