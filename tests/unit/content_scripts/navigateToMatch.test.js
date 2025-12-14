import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupDOM } from '../../helpers/dom-helpers.js';

// Mock state and functions that navigateToMatch depends on
let highlightData = { ranges: [], elements: [] };
let currentMatchIndex = -1;
let updateOverlayPositionsCalled = false;
let updateMinimapCalled = false;
let scrollIntoViewCalls = [];

function updateOverlayPositions() {
  updateOverlayPositionsCalled = true;
}

function updateMinimap() {
  updateMinimapCalled = true;
}

// Helper function extracted from main.js for testing
function navigateToMatch(index) {
  // Support both text search (ranges) and element search (elements)
  const totalMatches = highlightData.ranges.length || highlightData.elements.length;

  if (totalMatches === 0) {
    return { currentIndex: -1, totalMatches: 0 };
  }

  // Normalize index (wrap around)
  let normalizedIndex = index;
  if (normalizedIndex < 0) {
    normalizedIndex = totalMatches - 1;
  } else if (normalizedIndex >= totalMatches) {
    normalizedIndex = 0;
  }

  currentMatchIndex = normalizedIndex;

  // Update overlay colors (for text search)
  if (highlightData.ranges.length > 0) {
    updateOverlayPositions();
    updateMinimap();
  }

  // Scroll to the current match
  if (highlightData.ranges.length > 0) {
    // Text search: scroll to range
    const currentRange = highlightData.ranges[currentMatchIndex];
    if (currentRange) {
      try {
        const element = currentRange.startContainer.parentElement;
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch (error) {
        console.warn('[Pattern Lens] Failed to scroll to match:', error);
      }
    }
  } else if (highlightData.elements.length > 0) {
    // Element search: scroll to element
    const currentElement = highlightData.elements[currentMatchIndex];
    if (currentElement) {
      try {
        currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (error) {
        console.warn('[Pattern Lens] Failed to scroll to element:', error);
      }
    }
  }

  return { currentIndex: currentMatchIndex, totalMatches: totalMatches };
}

describe('navigateToMatch', () => {
  beforeEach(() => {
    cleanupDOM();
    // Reset state before each test
    highlightData = { ranges: [], elements: [] };
    currentMatchIndex = -1;
    updateOverlayPositionsCalled = false;
    updateMinimapCalled = false;
    scrollIntoViewCalls = [];

    // Mock scrollIntoView (not available in jsdom)
    Element.prototype.scrollIntoView = vi.fn(function (_options) {
      // Track the call for testing
      scrollIntoViewCalls.push({ type: 'mock', element: this });
    });
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('No matches', () => {
    it('should return -1 index and 0 total when no matches', () => {
      const result = navigateToMatch(0);

      expect(result.currentIndex).toBe(-1);
      expect(result.totalMatches).toBe(0);
    });

    it('should not call update functions when no matches', () => {
      navigateToMatch(0);

      expect(updateOverlayPositionsCalled).toBe(false);
      expect(updateMinimapCalled).toBe(false);
      expect(scrollIntoViewCalls.length).toBe(0);
    });
  });

  describe('Text search navigation (ranges)', () => {
    beforeEach(() => {
      // Create mock ranges with text nodes
      document.body.innerHTML = '<div>Match 1</div><div>Match 2</div><div>Match 3</div>';
      const divs = document.querySelectorAll('div');

      highlightData.ranges = Array.from(divs).map((div) => {
        const range = document.createRange();
        range.selectNodeContents(div.firstChild);
        return range;
      });
    });

    it('should navigate to first match (index 0)', () => {
      const result = navigateToMatch(0);

      expect(result.currentIndex).toBe(0);
      expect(result.totalMatches).toBe(3);
      expect(currentMatchIndex).toBe(0);
    });

    it('should navigate to middle match (index 1)', () => {
      const result = navigateToMatch(1);

      expect(result.currentIndex).toBe(1);
      expect(result.totalMatches).toBe(3);
    });

    it('should navigate to last match (index 2)', () => {
      const result = navigateToMatch(2);

      expect(result.currentIndex).toBe(2);
      expect(result.totalMatches).toBe(3);
    });

    it('should wrap around to last match when index is -1', () => {
      const result = navigateToMatch(-1);

      expect(result.currentIndex).toBe(2); // Last match
      expect(result.totalMatches).toBe(3);
    });

    it('should wrap around to first match when index exceeds total', () => {
      const result = navigateToMatch(3); // Index beyond array

      expect(result.currentIndex).toBe(0); // Wraps to first
      expect(result.totalMatches).toBe(3);
    });

    it('should wrap to 0 when index exceeds total (index = 5)', () => {
      const result = navigateToMatch(5);

      // Function wraps any index >= totalMatches to 0
      expect(result.currentIndex).toBe(0);
    });

    it('should call updateOverlayPositions and updateMinimap for text search', () => {
      navigateToMatch(0);

      expect(updateOverlayPositionsCalled).toBe(true);
      expect(updateMinimapCalled).toBe(true);
    });

    it('should scroll to range element', () => {
      navigateToMatch(1);

      expect(scrollIntoViewCalls.length).toBe(1);
      expect(scrollIntoViewCalls[0].type).toBe('mock');
      expect(scrollIntoViewCalls[0].element.tagName).toBe('DIV');
    });

    it('should handle consecutive navigations', () => {
      navigateToMatch(0);
      expect(currentMatchIndex).toBe(0);

      navigateToMatch(1);
      expect(currentMatchIndex).toBe(1);

      navigateToMatch(2);
      expect(currentMatchIndex).toBe(2);
    });
  });

  describe('Element search navigation', () => {
    beforeEach(() => {
      document.body.innerHTML =
        '<div class="match">Elem 1</div><div class="match">Elem 2</div><div class="match">Elem 3</div>';
      highlightData.elements = Array.from(document.querySelectorAll('.match'));
    });

    it('should navigate to element at index 0', () => {
      const result = navigateToMatch(0);

      expect(result.currentIndex).toBe(0);
      expect(result.totalMatches).toBe(3);
    });

    it('should wrap around for element search', () => {
      const result = navigateToMatch(-1);

      expect(result.currentIndex).toBe(2);
    });

    it('should NOT call updateOverlayPositions/updateMinimap for element search', () => {
      navigateToMatch(0);

      expect(updateOverlayPositionsCalled).toBe(false);
      expect(updateMinimapCalled).toBe(false);
    });

    it('should scroll to element', () => {
      navigateToMatch(1);

      expect(scrollIntoViewCalls.length).toBe(1);
      expect(scrollIntoViewCalls[0].type).toBe('mock');
      expect(scrollIntoViewCalls[0].element.className).toBe('match');
    });

    it('should handle navigation to last element', () => {
      navigateToMatch(2);

      expect(currentMatchIndex).toBe(2);
      expect(scrollIntoViewCalls.length).toBe(1);
      expect(scrollIntoViewCalls[0].element.textContent).toBe('Elem 3');
    });
  });

  describe('Index normalization', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div>1</div><div>2</div><div>3</div><div>4</div><div>5</div>';
      const divs = document.querySelectorAll('div');
      highlightData.ranges = Array.from(divs).map((div) => {
        const range = document.createRange();
        range.selectNodeContents(div.firstChild);
        return range;
      });
    });

    it('should handle negative indices correctly (-1 = last)', () => {
      expect(navigateToMatch(-1).currentIndex).toBe(4);
    });

    it('should handle negative indices (-2 = second to last)', () => {
      expect(navigateToMatch(-2).currentIndex).toBe(4); // Still wraps to last
    });

    it('should wrap large positive indices to 0', () => {
      // Any index >= totalMatches wraps to 0
      expect(navigateToMatch(7).currentIndex).toBe(0);
    });

    it('should handle zero index', () => {
      expect(navigateToMatch(0).currentIndex).toBe(0);
    });

    it('should handle exact boundary (totalMatches)', () => {
      expect(navigateToMatch(5).currentIndex).toBe(0); // Wraps to first
    });
  });

  describe('Edge cases', () => {
    it('should handle single match', () => {
      document.body.innerHTML = '<div>Only match</div>';
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('div').firstChild);
      highlightData.ranges = [range];

      const result1 = navigateToMatch(0);
      expect(result1.currentIndex).toBe(0);

      const result2 = navigateToMatch(1); // Should wrap to 0
      expect(result2.currentIndex).toBe(0);

      const result3 = navigateToMatch(-1); // Should wrap to 0
      expect(result3.currentIndex).toBe(0);
    });

    it('should handle switching between text and element search', () => {
      // Start with text search
      document.body.innerHTML = '<div>Text 1</div><div>Text 2</div>';
      const divs = document.querySelectorAll('div');
      highlightData.ranges = Array.from(divs).map((div) => {
        const range = document.createRange();
        range.selectNodeContents(div.firstChild);
        return range;
      });

      navigateToMatch(0);
      expect(updateOverlayPositionsCalled).toBe(true);

      // Clear and switch to element search
      highlightData.ranges = [];
      updateOverlayPositionsCalled = false;
      updateMinimapCalled = false;
      scrollIntoViewCalls = [];

      document.body.innerHTML = '<span>Elem 1</span><span>Elem 2</span>';
      highlightData.elements = Array.from(document.querySelectorAll('span'));

      navigateToMatch(0);
      expect(updateOverlayPositionsCalled).toBe(false);
      expect(updateMinimapCalled).toBe(false);
      expect(scrollIntoViewCalls.length).toBe(1);
      expect(scrollIntoViewCalls[0].type).toBe('mock');
    });

    it('should handle empty range gracefully', () => {
      document.body.innerHTML = '<div>Test</div>';
      const range = document.createRange();
      // Create valid but empty range
      const div = document.querySelector('div');
      range.setStart(div.firstChild, 0);
      range.setEnd(div.firstChild, 0);
      highlightData.ranges = [range];

      const result = navigateToMatch(0);
      expect(result.currentIndex).toBe(0);
      expect(scrollIntoViewCalls.length).toBe(1);
    });
  });

  describe('Return value validation', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div>1</div><div>2</div><div>3</div>';
      const divs = document.querySelectorAll('div');
      highlightData.ranges = Array.from(divs).map((div) => {
        const range = document.createRange();
        range.selectNodeContents(div.firstChild);
        return range;
      });
    });

    it('should return object with currentIndex and totalMatches', () => {
      const result = navigateToMatch(1);

      expect(result).toHaveProperty('currentIndex');
      expect(result).toHaveProperty('totalMatches');
    });

    it('should return correct values for various indices', () => {
      expect(navigateToMatch(0)).toEqual({ currentIndex: 0, totalMatches: 3 });
      expect(navigateToMatch(1)).toEqual({ currentIndex: 1, totalMatches: 3 });
      expect(navigateToMatch(2)).toEqual({ currentIndex: 2, totalMatches: 3 });
      expect(navigateToMatch(3)).toEqual({ currentIndex: 0, totalMatches: 3 }); // Wrap
      expect(navigateToMatch(-1)).toEqual({ currentIndex: 2, totalMatches: 3 }); // Wrap
    });
  });
});
