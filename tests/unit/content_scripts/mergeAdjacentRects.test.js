import { describe, expect, it } from 'vitest';

// Helper function extracted from main.js for testing
function mergeAdjacentRects(rectList, tolerance = 1) {
  if (!rectList || rectList.length === 0) {
    return [];
  }

  const rects = Array.from(rectList);

  // 1. Group rectangles by line (using rounded y coordinate)
  const lines = new Map();
  rects.forEach((rect) => {
    // Round y coordinate to absorb small pixel differences
    const lineY = Math.round(rect.y);
    if (!lines.has(lineY)) {
      lines.set(lineY, []);
    }
    lines.get(lineY).push(rect);
  });

  const mergedRects = [];

  for (const line of lines.values()) {
    // 2. Sort rectangles in each line by x coordinate (left to right)
    line.sort((a, b) => a.left - b.left);

    // 3. Merge adjacent rectangles
    let currentRect = line[0];
    for (let i = 1; i < line.length; i++) {
      const nextRect = line[i];
      // If the gap between current rect's right edge and next rect's left edge is within tolerance, merge them
      if (nextRect.left - currentRect.right <= tolerance) {
        // Create new merged rectangle
        const top = Math.min(currentRect.top, nextRect.top);
        const bottom = Math.max(currentRect.bottom, nextRect.bottom);
        currentRect = new DOMRect(
          currentRect.left,
          top,
          nextRect.right - currentRect.left, // width
          bottom - top // height
        );
      } else {
        // Not adjacent, add current rect to results and move to next
        mergedRects.push(currentRect);
        currentRect = nextRect;
      }
    }
    // Add the last rectangle
    mergedRects.push(currentRect);
  }

  return mergedRects;
}

describe('mergeAdjacentRects', () => {
  describe('Basic merging', () => {
    it('should return empty array for empty input', () => {
      const result = mergeAdjacentRects([]);
      expect(result).toEqual([]);
    });

    it('should return empty array for null input', () => {
      const result = mergeAdjacentRects(null);
      expect(result).toEqual([]);
    });

    it('should return single rect unchanged', () => {
      const rect = new DOMRect(10, 20, 100, 30);
      const result = mergeAdjacentRects([rect]);

      expect(result.length).toBe(1);
      expect(result[0].left).toBe(10);
      expect(result[0].top).toBe(20);
      expect(result[0].width).toBe(100);
      expect(result[0].height).toBe(30);
    });

    it('should merge two adjacent rects on same line', () => {
      const rect1 = new DOMRect(10, 20, 50, 30); // left:10, right:60
      const rect2 = new DOMRect(60, 20, 40, 30); // left:60, right:100

      const result = mergeAdjacentRects([rect1, rect2]);

      expect(result.length).toBe(1);
      expect(result[0].left).toBe(10);
      expect(result[0].top).toBe(20);
      expect(result[0].width).toBe(90); // 100 - 10
      expect(result[0].height).toBe(30);
    });

    it('should NOT merge non-adjacent rects', () => {
      const rect1 = new DOMRect(10, 20, 50, 30); // left:10, right:60
      const rect2 = new DOMRect(70, 20, 40, 30); // left:70, right:110 (gap of 10px)

      const result = mergeAdjacentRects([rect1, rect2]);

      expect(result.length).toBe(2);
      expect(result[0].left).toBe(10);
      expect(result[1].left).toBe(70);
    });
  });

  describe('Tolerance parameter', () => {
    it('should merge rects within tolerance', () => {
      const rect1 = new DOMRect(10, 20, 50, 30); // right:60
      const rect2 = new DOMRect(61, 20, 40, 30); // left:61 (gap of 1px)

      const result = mergeAdjacentRects([rect1, rect2], 1);

      expect(result.length).toBe(1);
      expect(result[0].width).toBe(91); // 101 - 10
    });

    it('should NOT merge rects beyond tolerance', () => {
      const rect1 = new DOMRect(10, 20, 50, 30); // right:60
      const rect2 = new DOMRect(62, 20, 40, 30); // left:62 (gap of 2px)

      const result = mergeAdjacentRects([rect1, rect2], 1);

      expect(result.length).toBe(2);
    });

    it('should use custom tolerance value', () => {
      const rect1 = new DOMRect(10, 20, 50, 30); // right:60
      const rect2 = new DOMRect(65, 20, 40, 30); // left:65 (gap of 5px)

      const result = mergeAdjacentRects([rect1, rect2], 5);

      expect(result.length).toBe(1);
    });
  });

  describe('Multiple lines', () => {
    it('should keep rects on different lines separate', () => {
      const rect1 = new DOMRect(10, 20, 100, 30); // line y=20
      const rect2 = new DOMRect(10, 60, 100, 30); // line y=60

      const result = mergeAdjacentRects([rect1, rect2]);

      expect(result.length).toBe(2);
    });

    it('should merge rects on same line but keep different lines separate', () => {
      const line1rect1 = new DOMRect(10, 20, 50, 30); // line y=20
      const line1rect2 = new DOMRect(60, 20, 40, 30); // line y=20
      const line2rect1 = new DOMRect(10, 60, 50, 30); // line y=60
      const line2rect2 = new DOMRect(60, 60, 40, 30); // line y=60

      const result = mergeAdjacentRects([line1rect1, line1rect2, line2rect1, line2rect2]);

      expect(result.length).toBe(2); // One merged rect per line
      // Both lines should have merged rects
      const sortedByY = result.sort((a, b) => a.y - b.y);
      expect(sortedByY[0].y).toBe(20);
      expect(sortedByY[0].width).toBe(90);
      expect(sortedByY[1].y).toBe(60);
      expect(sortedByY[1].width).toBe(90);
    });

    it('should handle small y-coordinate differences (rounding)', () => {
      const rect1 = new DOMRect(10, 20.2, 50, 30);
      const rect2 = new DOMRect(60, 20.4, 40, 30);

      const result = mergeAdjacentRects([rect1, rect2]);

      // Should be treated as same line due to rounding
      expect(result.length).toBe(1);
    });
  });

  describe('Complex scenarios', () => {
    it('should merge multiple adjacent rects in sequence', () => {
      const rect1 = new DOMRect(10, 20, 30, 30); // right:40
      const rect2 = new DOMRect(40, 20, 30, 30); // left:40, right:70
      const rect3 = new DOMRect(70, 20, 30, 30); // left:70, right:100

      const result = mergeAdjacentRects([rect1, rect2, rect3]);

      expect(result.length).toBe(1);
      expect(result[0].left).toBe(10);
      expect(result[0].width).toBe(90);
    });

    it('should handle rects provided in wrong order', () => {
      const rect1 = new DOMRect(70, 20, 30, 30); // Will be sorted
      const rect2 = new DOMRect(10, 20, 30, 30);
      const rect3 = new DOMRect(40, 20, 30, 30);

      const result = mergeAdjacentRects([rect1, rect2, rect3]);

      // Should sort and merge correctly
      expect(result.length).toBe(1);
      expect(result[0].left).toBe(10);
    });

    it('should merge some rects but not others', () => {
      const rect1 = new DOMRect(10, 20, 30, 30); // right:40
      const rect2 = new DOMRect(40, 20, 30, 30); // left:40, right:70
      const rect3 = new DOMRect(80, 20, 30, 30); // left:80 (gap from rect2)

      const result = mergeAdjacentRects([rect1, rect2, rect3]);

      expect(result.length).toBe(2);
      expect(result[0].width).toBe(60); // rect1 + rect2
      expect(result[1].left).toBe(80); // rect3 alone
    });

    it('should handle different heights on same line (use max)', () => {
      const rect1 = new DOMRect(10, 20, 50, 25); // height:25, top:20, bottom:45
      const rect2 = new DOMRect(60, 20, 40, 30); // height:30, top:20, bottom:50

      const result = mergeAdjacentRects([rect1, rect2]);

      expect(result.length).toBe(1);
      // Should use min top and max bottom
      expect(result[0].top).toBe(20);
      expect(result[0].height).toBe(30); // max(45, 50) - 20 = 30
    });

    it('should handle multi-line text wrapping scenario', () => {
      // Simulate text that wraps across 3 lines
      const line1 = [new DOMRect(10, 20, 40, 20), new DOMRect(50, 20, 40, 20)];
      const line2 = [new DOMRect(10, 50, 40, 20), new DOMRect(50, 50, 40, 20)];
      const line3 = [new DOMRect(10, 80, 30, 20)];

      const allRects = [...line1, ...line2, ...line3];
      const result = mergeAdjacentRects(allRects);

      expect(result.length).toBe(3); // One merged rect per line
    });
  });

  describe('Edge cases', () => {
    it('should handle overlapping rects', () => {
      const rect1 = new DOMRect(10, 20, 60, 30); // right:70
      const rect2 = new DOMRect(50, 20, 60, 30); // left:50, right:110 (overlaps)

      const result = mergeAdjacentRects([rect1, rect2]);

      // Overlapping rects should be merged
      expect(result.length).toBe(1);
      expect(result[0].left).toBe(10);
      expect(result[0].width).toBe(100); // 110 - 10
    });

    it('should handle rects with zero width', () => {
      const rect1 = new DOMRect(10, 20, 0, 30);
      const rect2 = new DOMRect(10, 20, 50, 30);

      const result = mergeAdjacentRects([rect1, rect2]);

      expect(result.length).toBe(1);
    });

    it('should handle very large number of rects', () => {
      // Create 100 adjacent rects
      const rects = [];
      for (let i = 0; i < 100; i++) {
        rects.push(new DOMRect(i * 10, 20, 10, 30));
      }

      const result = mergeAdjacentRects(rects);

      // All should merge into one
      expect(result.length).toBe(1);
      expect(result[0].width).toBe(1000);
    });
  });
});
