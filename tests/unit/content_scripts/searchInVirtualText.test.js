import { describe, expect, it } from 'vitest';

const BLOCK_BOUNDARY_MARKER = '\uE000';

// Helper function extracted from main.js for testing
function searchInVirtualText(query, virtualText, useRegex, caseSensitive) {
  const matches = [];

  if (useRegex) {
    // Use user's regex pattern with dotAll flag for multiline matching
    // Replace '.' with pattern that excludes block boundary marker
    try {
      // Replace . with [^\uE000] to prevent matching across block boundaries
      // Handle escaped dots (\.) separately - they should match literal dots
      const ESCAPED_DOT_PLACEHOLDER = '\uE001ESCAPED_DOT\uE001';
      const modifiedQuery = query
        .replace(/\\\./g, ESCAPED_DOT_PLACEHOLDER) // Temporarily replace \. (literal dot)
        .replace(/\./g, `[^${BLOCK_BOUNDARY_MARKER}\n]`) // Replace . with [^boundary] (excluding newlines too)
        .replace(
          new RegExp(ESCAPED_DOT_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          '\\.'
        ); // Restore \.

      // Use 'g' or 'gi' flags based on case-sensitivity (not 's') so that . does not match newlines
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(modifiedQuery, flags);
      let match = regex.exec(virtualText);
      while (match !== null) {
        // Filter out matches that cross block boundaries
        const matchedText = match[0];
        const hasBoundary = matchedText.includes(BLOCK_BOUNDARY_MARKER);

        if (!hasBoundary) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
          });
        }
        // Prevent infinite loop on zero-length matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
        match = regex.exec(virtualText);
      }
    } catch (error) {
      console.warn('Invalid regex pattern:', error);
      return matches;
    }
  } else {
    // Normal search: escape regex special characters, then convert spaces to \s+ for flexible matching
    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalizedQuery = escapedQuery.replace(/\s+/g, '\\s+');
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(normalizedQuery, flags);
    let match = regex.exec(virtualText);
    while (match !== null) {
      // Filter out matches that cross block boundaries
      const matchedText = match[0];
      if (!matchedText.includes(BLOCK_BOUNDARY_MARKER)) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
        });
      }
      match = regex.exec(virtualText);
    }
  }

  return matches;
}

describe('searchInVirtualText', () => {
  describe('Normal text search', () => {
    it('should find simple text match', () => {
      const virtualText = 'Hello World';
      const matches = searchInVirtualText('World', virtualText, false, false);

      expect(matches.length).toBe(1);
      expect(matches[0].start).toBe(6);
      expect(matches[0].end).toBe(11);
    });

    it('should find multiple matches', () => {
      const virtualText = 'apple banana apple cherry apple';
      const matches = searchInVirtualText('apple', virtualText, false, false);

      expect(matches.length).toBe(3);
      expect(matches[0].start).toBe(0);
      expect(matches[1].start).toBe(13);
      expect(matches[2].start).toBe(26);
    });

    it('should be case-insensitive by default', () => {
      const virtualText = 'Hello WORLD';
      const matches = searchInVirtualText('world', virtualText, false, false);

      expect(matches.length).toBe(1);
      expect(matches[0].start).toBe(6);
    });

    it('should respect case-sensitive flag', () => {
      const virtualText = 'Hello WORLD world';
      const matches = searchInVirtualText('world', virtualText, false, true);

      expect(matches.length).toBe(1);
      expect(matches[0].start).toBe(12);
    });

    it('should handle special regex characters in query', () => {
      const virtualText = 'Price: $10.99 (sale)';
      const matches = searchInVirtualText('$10.99', virtualText, false, false);

      expect(matches.length).toBe(1);
      expect(matches[0].start).toBe(7);
    });

    it('should match text with flexible whitespace', () => {
      const virtualText = 'Hello   World';
      const matches = searchInVirtualText('Hello World', virtualText, false, false);

      expect(matches.length).toBe(1);
      expect(matches[0].start).toBe(0);
      expect(matches[0].end).toBe(13);
    });

    it('should NOT match across block boundaries', () => {
      const virtualText = `Hello${BLOCK_BOUNDARY_MARKER}World`;
      const matches = searchInVirtualText('Hello World', virtualText, false, false);

      // Should find no matches because boundary marker breaks the text
      expect(matches.length).toBe(0);
    });

    it('should find matches within same block when boundary exists elsewhere', () => {
      const virtualText = `First Block${BLOCK_BOUNDARY_MARKER}Second Block`;
      const matches = searchInVirtualText('Second Block', virtualText, false, false);

      expect(matches.length).toBe(1);
      expect(matches[0].start).toBe(12); // After boundary marker
    });
  });

  describe('Regex search', () => {
    it('should match simple regex pattern', () => {
      const virtualText = 'test123 test456';
      const matches = searchInVirtualText('test\\d+', virtualText, true, false);

      expect(matches.length).toBe(2);
      expect(virtualText.substring(matches[0].start, matches[0].end)).toBe('test123');
      expect(virtualText.substring(matches[1].start, matches[1].end)).toBe('test456');
    });

    it('should match pattern with character class', () => {
      const virtualText = 'abc123def456';
      const matches = searchInVirtualText('[a-z]{3}\\d{3}', virtualText, true, false);

      expect(matches.length).toBe(2);
      expect(virtualText.substring(matches[0].start, matches[0].end)).toBe('abc123');
      expect(virtualText.substring(matches[1].start, matches[1].end)).toBe('def456');
    });

    it('should handle dot (.) metacharacter without matching boundary', () => {
      const virtualText = `Hello${BLOCK_BOUNDARY_MARKER}World`;
      const matches = searchInVirtualText('H.llo', virtualText, true, false);

      // Should match 'Hello' but not cross boundary
      expect(matches.length).toBe(1);
      expect(virtualText.substring(matches[0].start, matches[0].end)).toBe('Hello');
    });

    it('should NOT match dot (.) across block boundary', () => {
      const virtualText = `AB${BLOCK_BOUNDARY_MARKER}CD`;
      const matches = searchInVirtualText('B.C', virtualText, true, false);

      // Should not match across boundary
      expect(matches.length).toBe(0);
    });

    it('should handle escaped dot (\\.) as literal', () => {
      const virtualText = 'example.com test.org';
      const matches = searchInVirtualText('\\w+\\.\\w+', virtualText, true, false);

      expect(matches.length).toBe(2);
      expect(virtualText.substring(matches[0].start, matches[0].end)).toBe('example.com');
      expect(virtualText.substring(matches[1].start, matches[1].end)).toBe('test.org');
    });

    it('should be case-insensitive by default in regex mode', () => {
      const virtualText = 'Hello HELLO hello';
      const matches = searchInVirtualText('hello', virtualText, true, false);

      expect(matches.length).toBe(3);
    });

    it('should respect case-sensitive flag in regex mode', () => {
      const virtualText = 'Hello HELLO hello';
      const matches = searchInVirtualText('hello', virtualText, true, true);

      expect(matches.length).toBe(1);
      expect(virtualText.substring(matches[0].start, matches[0].end)).toBe('hello');
    });

    it('should handle email pattern without crossing boundary', () => {
      const virtualText = `email:${BLOCK_BOUNDARY_MARKER}user@example.com`;
      const matches = searchInVirtualText('\\w+@\\w+\\.\\w+', virtualText, true, false);

      expect(matches.length).toBe(1);
      expect(virtualText.substring(matches[0].start, matches[0].end)).toBe('user@example.com');
    });

    it('should handle invalid regex gracefully', () => {
      const virtualText = 'test text';
      const matches = searchInVirtualText('[invalid(regex', virtualText, true, false);

      // Should return empty array on invalid regex
      expect(matches).toEqual([]);
    });
  });

  describe('Boundary marker filtering', () => {
    it('should filter out matches that contain boundary marker', () => {
      const virtualText = `Lorem ipsum${BLOCK_BOUNDARY_MARKER}dolor sit`;
      const matches = searchInVirtualText('ipsum dolor', virtualText, false, false);

      // Should not match because it would cross the boundary
      expect(matches.length).toBe(0);
    });

    it('should find matches on either side of boundary', () => {
      const virtualText = `Lorem ipsum${BLOCK_BOUNDARY_MARKER}dolor sit`;

      const matches1 = searchInVirtualText('Lorem ipsum', virtualText, false, false);
      expect(matches1.length).toBe(1);

      const matches2 = searchInVirtualText('dolor sit', virtualText, false, false);
      expect(matches2.length).toBe(1);
    });

    it('should handle multiple boundaries correctly', () => {
      const virtualText = `First${BLOCK_BOUNDARY_MARKER}Second${BLOCK_BOUNDARY_MARKER}Third`;

      const matches = searchInVirtualText('Second', virtualText, false, false);
      expect(matches.length).toBe(1);
      expect(virtualText.substring(matches[0].start, matches[0].end)).toBe('Second');
    });

    it('should work with regex and boundary filtering', () => {
      const virtualText = `test123${BLOCK_BOUNDARY_MARKER}test456`;
      const matches = searchInVirtualText('test\\d+', virtualText, true, false);

      // Should find both matches, one in each block
      expect(matches.length).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle query longer than text', () => {
      const virtualText = 'Hi';
      const matches = searchInVirtualText('Hello World', virtualText, false, false);

      expect(matches.length).toBe(0);
    });

    it('should handle text with only boundary markers', () => {
      const virtualText = `${BLOCK_BOUNDARY_MARKER}${BLOCK_BOUNDARY_MARKER}`;
      const matches = searchInVirtualText('test', virtualText, false, false);

      expect(matches.length).toBe(0);
    });

    it('should find non-overlapping matches', () => {
      const virtualText = 'aaaa';
      const matches = searchInVirtualText('aa', virtualText, false, false);

      // Regex exec() finds non-overlapping matches by default
      expect(matches.length).toBe(2);
      expect(matches[0].start).toBe(0);
      expect(matches[1].start).toBe(2);
    });
  });
});
