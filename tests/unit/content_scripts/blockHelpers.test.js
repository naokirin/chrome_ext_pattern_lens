import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupDOM } from '../../helpers/dom-helpers.js';

// Helper functions extracted from main.js for testing
function isBlockLevel(element) {
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

describe('isBlockLevel', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('Block-level elements', () => {
    it('should identify DIV as block-level', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);

      expect(isBlockLevel(div)).toBe(true);
    });

    it('should identify P as block-level', () => {
      const p = document.createElement('p');
      document.body.appendChild(p);

      expect(isBlockLevel(p)).toBe(true);
    });

    it('should identify H1-H6 as block-level', () => {
      const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

      headings.forEach((tag) => {
        const heading = document.createElement(tag);
        document.body.appendChild(heading);
        expect(isBlockLevel(heading)).toBe(true);
      });
    });

    it('should identify UL/OL as block-level', () => {
      const ul = document.createElement('ul');
      const ol = document.createElement('ol');
      document.body.appendChild(ul);
      document.body.appendChild(ol);

      expect(isBlockLevel(ul)).toBe(true);
      expect(isBlockLevel(ol)).toBe(true);
    });

    it('should identify LI as block-level (list-item)', () => {
      const li = document.createElement('li');
      document.body.appendChild(li);

      expect(isBlockLevel(li)).toBe(true);
    });

    it('should identify TABLE elements as block-level', () => {
      const table = document.createElement('table');
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      document.body.appendChild(table);
      table.appendChild(tr);
      tr.appendChild(td);

      expect(isBlockLevel(table)).toBe(true);
      expect(isBlockLevel(tr)).toBe(true);
      expect(isBlockLevel(td)).toBe(true);
    });

    it('should identify SECTION/ARTICLE/NAV as block-level', () => {
      const section = document.createElement('section');
      const article = document.createElement('article');
      const nav = document.createElement('nav');
      document.body.appendChild(section);
      document.body.appendChild(article);
      document.body.appendChild(nav);

      expect(isBlockLevel(section)).toBe(true);
      expect(isBlockLevel(article)).toBe(true);
      expect(isBlockLevel(nav)).toBe(true);
    });
  });

  describe('Inline elements', () => {
    it('should identify SPAN as inline', () => {
      const span = document.createElement('span');
      document.body.appendChild(span);

      expect(isBlockLevel(span)).toBe(false);
    });

    it('should identify STRONG as inline', () => {
      const strong = document.createElement('strong');
      document.body.appendChild(strong);

      expect(isBlockLevel(strong)).toBe(false);
    });

    it('should identify EM as inline', () => {
      const em = document.createElement('em');
      document.body.appendChild(em);

      expect(isBlockLevel(em)).toBe(false);
    });

    it('should identify CODE as inline', () => {
      const code = document.createElement('code');
      document.body.appendChild(code);

      expect(isBlockLevel(code)).toBe(false);
    });

    it('should identify A (anchor) as inline', () => {
      const a = document.createElement('a');
      document.body.appendChild(a);

      expect(isBlockLevel(a)).toBe(false);
    });

    it('should identify all semantic inline elements', () => {
      const inlineTags = [
        'b',
        'i',
        'kbd',
        'samp',
        'var',
        'abbr',
        'cite',
        'q',
        'mark',
        'small',
        'sub',
        'sup',
      ];

      inlineTags.forEach((tag) => {
        const element = document.createElement(tag);
        document.body.appendChild(element);
        expect(isBlockLevel(element)).toBe(false);
      });
    });
  });

  describe('CSS display property', () => {
    it('should respect CSS display: flex', () => {
      const div = document.createElement('div');
      div.style.display = 'flex';
      document.body.appendChild(div);

      expect(isBlockLevel(div)).toBe(true);
    });

    it('should respect CSS display: grid', () => {
      const div = document.createElement('div');
      div.style.display = 'grid';
      document.body.appendChild(div);

      expect(isBlockLevel(div)).toBe(true);
    });

    it('should ignore inline elements even with block display', () => {
      const span = document.createElement('span');
      span.style.display = 'block';
      document.body.appendChild(span);

      // SPAN is in the inline elements list, so should still be inline
      expect(isBlockLevel(span)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should return false for null', () => {
      expect(isBlockLevel(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isBlockLevel(undefined)).toBe(false);
    });

    it('should return false for text nodes', () => {
      const textNode = document.createTextNode('test');
      expect(isBlockLevel(textNode)).toBe(false);
    });

    it('should return false for comment nodes', () => {
      const comment = document.createComment('test');
      expect(isBlockLevel(comment)).toBe(false);
    });
  });
});

describe('getNearestBlockAncestor', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('Basic functionality', () => {
    it('should return immediate parent if it is block-level', () => {
      document.body.innerHTML = '<div id="parent"><p id="child">text</p></div>';
      const child = document.getElementById('child');
      const textNode = child.firstChild;

      const ancestor = getNearestBlockAncestor(textNode);

      expect(ancestor.id).toBe('child');
    });

    it('should skip inline parents and find block parent', () => {
      document.body.innerHTML = '<div id="block"><span id="inline">text</span></div>';
      const span = document.getElementById('inline');
      const textNode = span.firstChild;

      const ancestor = getNearestBlockAncestor(textNode);

      expect(ancestor.id).toBe('block');
    });

    it('should traverse multiple levels', () => {
      document.body.innerHTML = '<div id="outer"><span><strong><em>text</em></strong></span></div>';
      const em = document.querySelector('em');
      const textNode = em.firstChild;

      const ancestor = getNearestBlockAncestor(textNode);

      expect(ancestor.id).toBe('outer');
    });

    it('should return document.body if no block ancestor found', () => {
      document.body.innerHTML = '<span><strong>text</strong></span>';
      const strong = document.querySelector('strong');
      const textNode = strong.firstChild;

      const ancestor = getNearestBlockAncestor(textNode);

      expect(ancestor).toBe(document.body);
    });
  });

  describe('Complex DOM structures', () => {
    it('should work with nested block elements', () => {
      document.body.innerHTML = `
        <div id="outer">
          <div id="middle">
            <div id="inner">
              <span>text</span>
            </div>
          </div>
        </div>
      `;
      const span = document.querySelector('span');
      const textNode = span.firstChild;

      const ancestor = getNearestBlockAncestor(textNode);

      // Should return the innermost block (inner div)
      expect(ancestor.id).toBe('inner');
    });

    it('should handle list structures', () => {
      document.body.innerHTML = '<ul id="list"><li id="item"><span>text</span></li></ul>';
      const span = document.querySelector('span');
      const textNode = span.firstChild;

      const ancestor = getNearestBlockAncestor(textNode);

      // LI is block-level (list-item)
      expect(ancestor.id).toBe('item');
    });

    it('should handle table structures', () => {
      document.body.innerHTML = `
        <table id="table">
          <tr id="row">
            <td id="cell"><span>text</span></td>
          </tr>
        </table>
      `;
      const span = document.querySelector('span');
      const textNode = span.firstChild;

      const ancestor = getNearestBlockAncestor(textNode);

      // TD is block-level (table-cell)
      expect(ancestor.id).toBe('cell');
    });
  });

  describe('Starting from different node types', () => {
    it('should work starting from element node', () => {
      document.body.innerHTML = '<div id="outer"><span id="inner">text</span></div>';
      const span = document.getElementById('inner');

      const ancestor = getNearestBlockAncestor(span);

      expect(ancestor.id).toBe('outer');
    });

    it('should work starting from text node', () => {
      document.body.innerHTML = '<div id="block">text</div>';
      const textNode = document.querySelector('#block').firstChild;

      const ancestor = getNearestBlockAncestor(textNode);

      expect(ancestor.id).toBe('block');
    });

    it('should return block element if started from block element', () => {
      document.body.innerHTML = '<div id="outer"><div id="inner">text</div></div>';
      const inner = document.getElementById('inner');

      const ancestor = getNearestBlockAncestor(inner);

      // Should return the element itself if it's already a block
      expect(ancestor.id).toBe('inner');
    });
  });

  describe('Edge cases', () => {
    it('should return document.body for body element', () => {
      const ancestor = getNearestBlockAncestor(document.body);

      expect(ancestor).toBe(document.body);
    });

    it('should handle mixed inline and block elements', () => {
      document.body.innerHTML = `
        <div id="block1">
          <span>
            <strong>
              text1
            </strong>
          </span>
        </div>
        <div id="block2">
          text2
        </div>
      `;
      const strong = document.querySelector('strong');
      const textNode = strong.firstChild;

      const ancestor = getNearestBlockAncestor(textNode);

      expect(ancestor.id).toBe('block1');
    });

    it('should work with semantic HTML5 elements', () => {
      document.body.innerHTML =
        '<article id="article"><section id="section"><span>text</span></section></article>';
      const span = document.querySelector('span');
      const textNode = span.firstChild;

      const ancestor = getNearestBlockAncestor(textNode);

      // Section is block-level
      expect(ancestor.id).toBe('section');
    });
  });

  describe('Integration with isBlockLevel', () => {
    it('should return a block-level element', () => {
      document.body.innerHTML = '<div id="block"><span><strong>text</strong></span></div>';
      const strong = document.querySelector('strong');
      const textNode = strong.firstChild;

      const ancestor = getNearestBlockAncestor(textNode);

      expect(isBlockLevel(ancestor)).toBe(true);
    });

    it('should never return an inline element', () => {
      document.body.innerHTML = '<div><span id="span1"><span id="span2">text</span></span></div>';
      const span2 = document.getElementById('span2');
      const textNode = span2.firstChild;

      const ancestor = getNearestBlockAncestor(textNode);

      // Should skip both spans and return the div
      expect(ancestor.tagName).toBe('DIV');
      expect(isBlockLevel(ancestor)).toBe(true);
    });
  });
});
