import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupDOM } from '../../helpers/dom-helpers.js';

// Helper function extracted from main.js for testing
function createRangeFromVirtualMatch(match, charMap) {
  try {
    // Get character mapping for start and end positions
    const startCharInfo = charMap[match.start];
    const endCharInfo = charMap[match.end - 1]; // end is exclusive, so use end-1

    if (!startCharInfo || !endCharInfo) {
      console.warn('Character mapping not found for match:', match);
      return null;
    }

    // Skip block boundary markers (auto-inserted markers between block elements)
    if (!startCharInfo.node || !endCharInfo.node) {
      console.warn('Match includes block boundary marker, skipping');
      return null;
    }

    const range = document.createRange();

    // Set start position
    range.setStart(startCharInfo.node, startCharInfo.offset);

    // Set end position (offset + 1 because Range.setEnd is exclusive)
    range.setEnd(endCharInfo.node, endCharInfo.offset + 1);

    return range;
  } catch (error) {
    console.warn('Failed to create range:', error);
    return null;
  }
}

describe('createRangeFromVirtualMatch', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('Basic functionality', () => {
    it('should create range from simple match within single text node', () => {
      document.body.innerHTML = '<div>Hello World</div>';
      const textNode = document.querySelector('div').firstChild;

      const charMap = [
        { node: textNode, offset: 0 },
        { node: textNode, offset: 1 },
        { node: textNode, offset: 2 },
        { node: textNode, offset: 3 },
        { node: textNode, offset: 4 },
        { node: textNode, offset: 5 },
        { node: textNode, offset: 6 },
        { node: textNode, offset: 7 },
        { node: textNode, offset: 8 },
        { node: textNode, offset: 9 },
        { node: textNode, offset: 10 },
      ];

      const match = { start: 0, end: 5 }; // "Hello"
      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).not.toBe(null);
      expect(range.startContainer).toBe(textNode);
      expect(range.startOffset).toBe(0);
      expect(range.endContainer).toBe(textNode);
      expect(range.endOffset).toBe(5);
      expect(range.toString()).toBe('Hello');
    });

    it('should create range for middle portion of text', () => {
      document.body.innerHTML = '<div>Hello World</div>';
      const textNode = document.querySelector('div').firstChild;

      const charMap = Array.from({ length: 11 }, (_, i) => ({
        node: textNode,
        offset: i,
      }));

      const match = { start: 6, end: 11 }; // "World"
      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).not.toBe(null);
      expect(range.toString()).toBe('World');
      expect(range.startOffset).toBe(6);
      expect(range.endOffset).toBe(11);
    });

    it('should create range for single character', () => {
      document.body.innerHTML = '<div>Hello</div>';
      const textNode = document.querySelector('div').firstChild;

      const charMap = Array.from({ length: 5 }, (_, i) => ({
        node: textNode,
        offset: i,
      }));

      const match = { start: 2, end: 3 }; // "l"
      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).not.toBe(null);
      expect(range.toString()).toBe('l');
      expect(range.startOffset).toBe(2);
      expect(range.endOffset).toBe(3);
    });
  });

  describe('Cross-element ranges', () => {
    it('should create range spanning multiple inline elements', () => {
      document.body.innerHTML = '<div><span>Hello</span><span>World</span></div>';
      const span1 = document.querySelectorAll('span')[0];
      const span2 = document.querySelectorAll('span')[1];
      const textNode1 = span1.firstChild;
      const textNode2 = span2.firstChild;

      const charMap = [
        { node: textNode1, offset: 0 },
        { node: textNode1, offset: 1 },
        { node: textNode1, offset: 2 },
        { node: textNode1, offset: 3 },
        { node: textNode1, offset: 4 },
        { node: textNode2, offset: 0 },
        { node: textNode2, offset: 1 },
        { node: textNode2, offset: 2 },
        { node: textNode2, offset: 3 },
        { node: textNode2, offset: 4 },
      ];

      const match = { start: 2, end: 8 }; // "lloWor"
      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).not.toBe(null);
      expect(range.startContainer).toBe(textNode1);
      expect(range.startOffset).toBe(2);
      expect(range.endContainer).toBe(textNode2);
      expect(range.endOffset).toBe(3);
      expect(range.toString()).toBe('lloWor');
    });

    it('should handle range starting in one element and ending in another', () => {
      document.body.innerHTML = '<div><span>AB</span><span>CD</span></div>';
      const textNode1 = document.querySelectorAll('span')[0].firstChild;
      const textNode2 = document.querySelectorAll('span')[1].firstChild;

      const charMap = [
        { node: textNode1, offset: 0 },
        { node: textNode1, offset: 1 },
        { node: textNode2, offset: 0 },
        { node: textNode2, offset: 1 },
      ];

      const match = { start: 1, end: 3 }; // "BC"
      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).not.toBe(null);
      expect(range.toString()).toBe('BC');
      expect(range.startContainer).toBe(textNode1);
      expect(range.endContainer).toBe(textNode2);
    });
  });

  describe('Error handling', () => {
    it('should return null if startCharInfo is missing', () => {
      const charMap = [{ node: document.createTextNode('test'), offset: 0 }];

      const match = { start: 10, end: 15 }; // Out of bounds
      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).toBe(null);
    });

    it('should return null if endCharInfo is missing', () => {
      const textNode = document.createTextNode('test');
      const charMap = [
        { node: textNode, offset: 0 },
        { node: textNode, offset: 1 },
      ];

      const match = { start: 0, end: 10 }; // End is out of bounds
      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).toBe(null);
    });

    it('should return null if startCharInfo.node is null (boundary marker)', () => {
      const textNode = document.createTextNode('test');
      const charMap = [
        { node: null, offset: -1, type: 'block-boundary' }, // Boundary marker
        { node: textNode, offset: 0 },
        { node: textNode, offset: 1 },
      ];

      const match = { start: 0, end: 2 }; // Starts at boundary
      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).toBe(null);
    });

    it('should return null if endCharInfo.node is null (boundary marker)', () => {
      const textNode = document.createTextNode('test');
      const charMap = [
        { node: textNode, offset: 0 },
        { node: textNode, offset: 1 },
        { node: null, offset: -1, type: 'block-boundary' }, // Boundary marker
      ];

      const match = { start: 0, end: 3 }; // Ends at boundary
      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).toBe(null);
    });

    it('should handle invalid match gracefully', () => {
      const textNode = document.createTextNode('test');
      const charMap = [
        { node: textNode, offset: 0 },
        { node: textNode, offset: 1 },
      ];

      const match = { start: -1, end: 1 }; // Invalid start
      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).toBe(null);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty charMap', () => {
      const charMap = [];
      const match = { start: 0, end: 1 };
      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).toBe(null);
    });

    it('should handle match at end of text', () => {
      document.body.innerHTML = '<div>Hello</div>';
      const textNode = document.querySelector('div').firstChild;

      const charMap = Array.from({ length: 5 }, (_, i) => ({
        node: textNode,
        offset: i,
      }));

      const match = { start: 4, end: 5 }; // Last character "o"
      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).not.toBe(null);
      expect(range.toString()).toBe('o');
    });

    it('should handle whole text selection', () => {
      document.body.innerHTML = '<div>Hello</div>';
      const textNode = document.querySelector('div').firstChild;

      const charMap = Array.from({ length: 5 }, (_, i) => ({
        node: textNode,
        offset: i,
      }));

      const match = { start: 0, end: 5 }; // Entire text
      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).not.toBe(null);
      expect(range.toString()).toBe('Hello');
    });

    it('should handle whitespace in text', () => {
      document.body.innerHTML = '<div>Hello World</div>';
      const textNode = document.querySelector('div').firstChild;

      const charMap = Array.from({ length: 11 }, (_, i) => ({
        node: textNode,
        offset: i,
      }));

      const match = { start: 5, end: 6 }; // Space character
      const range = createRangeFromVirtualMatch(match, charMap);

      expect(range).not.toBe(null);
      expect(range.toString()).toBe(' ');
    });
  });

  describe('Integration with virtual text layer', () => {
    it('should create correct range when charMap has boundary markers', () => {
      document.body.innerHTML = '<div>AB</div><div>CD</div>';
      const textNode1 = document.querySelectorAll('div')[0].firstChild;
      const textNode2 = document.querySelectorAll('div')[1].firstChild;

      const charMap = [
        { node: textNode1, offset: 0 }, // A
        { node: textNode1, offset: 1 }, // B
        { node: null, offset: -1, type: 'block-boundary' }, // Boundary
        { node: textNode2, offset: 0 }, // C
        { node: textNode2, offset: 1 }, // D
      ];

      // Match only first block
      const match1 = { start: 0, end: 2 }; // "AB"
      const range1 = createRangeFromVirtualMatch(match1, charMap);

      expect(range1).not.toBe(null);
      expect(range1.toString()).toBe('AB');

      // Match only second block
      const match2 = { start: 3, end: 5 }; // "CD"
      const range2 = createRangeFromVirtualMatch(match2, charMap);

      expect(range2).not.toBe(null);
      expect(range2.toString()).toBe('CD');
    });

    it('should allow match crossing boundary in charMap (function only checks start/end)', () => {
      document.body.innerHTML = '<div>AB</div><div>CD</div>';
      const textNode1 = document.querySelectorAll('div')[0].firstChild;
      const textNode2 = document.querySelectorAll('div')[1].firstChild;

      const charMap = [
        { node: textNode1, offset: 0 }, // A
        { node: textNode1, offset: 1 }, // B
        { node: null, offset: -1, type: 'block-boundary' }, // Boundary at index 2
        { node: textNode2, offset: 0 }, // C at index 3
        { node: textNode2, offset: 1 }, // D at index 4
      ];

      // Match: start=1 (B), end=4 (exclusive, so actually index 3 which is C)
      // Function only checks charMap[start] and charMap[end-1], not intermediate values
      // So it won't detect the boundary marker at index 2
      const match = { start: 1, end: 4 }; // "B" to "C" (skipping boundary)
      const range = createRangeFromVirtualMatch(match, charMap);

      // Creates a range from textNode1[1] to textNode2[0]
      // The function doesn't validate that the match crosses a boundary
      expect(range).not.toBe(null);
      expect(range.startContainer).toBe(textNode1);
      expect(range.endContainer).toBe(textNode2);
    });
  });
});
