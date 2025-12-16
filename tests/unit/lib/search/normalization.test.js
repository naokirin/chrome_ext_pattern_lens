import { describe, expect, it } from 'vitest';
import { convertNormalizedMatchToOriginal, normalizeText } from '~/lib/search/normalization';

describe('normalization', () => {
  describe('normalizeText', () => {
    it('空文字列を正規化する', () => {
      const result = normalizeText('');
      expect(result.normalizedText).toBe('');
      expect(result.mapping.ranges).toEqual([]);
    });

    it('基本的な全角→半角変換（アルファベット）', () => {
      const result = normalizeText('ＡＢＣ');
      expect(result.normalizedText).toBe('abc');
      expect(result.mapping.ranges.length).toBe(3);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 1 });
      expect(result.mapping.ranges[1]).toEqual({ start: 1, end: 2 });
      expect(result.mapping.ranges[2]).toEqual({ start: 2, end: 3 });
    });

    it('基本的な全角→半角変換（数字）', () => {
      const result = normalizeText('１２３');
      expect(result.normalizedText).toBe('123');
      expect(result.mapping.ranges.length).toBe(3);
    });

    it('大文字小文字の正規化', () => {
      const result = normalizeText('ABC');
      expect(result.normalizedText).toBe('abc');
      expect(result.mapping.ranges.length).toBe(3);
    });

    it('濁点結合（か゛ → が）', () => {
      const result = normalizeText('か゛');
      expect(result.normalizedText).toBe('が');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('濁点結合（カ゛ → ガ）', () => {
      const result = normalizeText('カ゛');
      expect(result.normalizedText).toBe('ガ');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('濁点結合（ｶﾞ → ガ）', () => {
      const result = normalizeText('ｶﾞ');
      expect(result.normalizedText).toBe('ガ');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('半濁点結合（は゜ → ぱ）', () => {
      const result = normalizeText('は゜');
      expect(result.normalizedText).toBe('ぱ');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('古い仮名の濁点結合（う゛ → ゔ）', () => {
      const result = normalizeText('う゛');
      expect(result.normalizedText).toBe('ゔ');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('古いカタカナの濁点結合（ウ゛ → ヴ）', () => {
      const result = normalizeText('ウ゛');
      expect(result.normalizedText).toBe('ヴ');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('古いカタカナの濁点結合（ヰ゛ → ヸ）', () => {
      const result = normalizeText('ヰ゛');
      expect(result.normalizedText).toBe('ヸ');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('小書き文字の濁点結合（ぅ゛ → ぅ゙）', () => {
      const result = normalizeText('ぅ゛');
      expect(result.normalizedText).toBe('ぅ゙');
      expect(result.mapping.ranges.length).toBe(1);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 });
    });

    it('複数文字の正規化（か゛は → がは）', () => {
      const result = normalizeText('か゛は');
      expect(result.normalizedText).toBe('がは');
      expect(result.mapping.ranges.length).toBe(2);
      expect(result.mapping.ranges[0]).toEqual({ start: 0, end: 2 }); // が
      expect(result.mapping.ranges[1]).toEqual({ start: 2, end: 3 }); // は
    });

    it('記号の正規化（ー → -）', () => {
      const result = normalizeText('ー');
      expect(result.normalizedText).toBe('-');
      expect(result.mapping.ranges.length).toBe(1);
    });

    it('記号の正規化（／ → /）', () => {
      const result = normalizeText('／');
      expect(result.normalizedText).toBe('/');
      expect(result.mapping.ranges.length).toBe(1);
    });

    it('ブロック境界マーカーはそのまま保持', () => {
      const marker = '\uE000';
      const result = normalizeText(`か${marker}は`);
      expect(result.normalizedText).toBe(`か${marker}は`);
      expect(result.mapping.ranges.length).toBe(3);
    });

    it('複雑な正規化（全角・半角・濁点混在）', () => {
      const result = normalizeText('ＡＢＣか゛１２３');
      expect(result.normalizedText).toBe('abcが123');
      expect(result.mapping.ranges.length).toBe(7);
    });
  });

  describe('convertNormalizedMatchToOriginal', () => {
    it('正規化後の位置を元の位置に変換', () => {
      // "か゛" → "が" (2文字 → 1文字)
      const mapping = {
        ranges: [{ start: 0, end: 2 }], // が
      };
      const normalizedMatch = { start: 0, end: 1 };
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toEqual({ start: 0, end: 2 });
    });

    it('複数文字の正規化後の位置を元の位置に変換', () => {
      // "か゛は" → "がは" (3文字 → 2文字)
      const mapping = {
        ranges: [
          { start: 0, end: 2 }, // が
          { start: 2, end: 3 }, // は
        ],
      };
      const normalizedMatch = { start: 0, end: 2 }; // "がは"
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toEqual({ start: 0, end: 3 });
    });

    it('範囲外の位置の場合はnullを返す', () => {
      const mapping = {
        ranges: [{ start: 0, end: 1 }],
      };
      const normalizedMatch = { start: 10, end: 11 };
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toBeNull();
    });

    it('空のマッピングの場合はnullを返す', () => {
      const mapping = {
        ranges: [],
      };
      const normalizedMatch = { start: 0, end: 1 };
      const result = convertNormalizedMatchToOriginal(normalizedMatch, mapping);
      expect(result).toBeNull();
    });
  });
});
