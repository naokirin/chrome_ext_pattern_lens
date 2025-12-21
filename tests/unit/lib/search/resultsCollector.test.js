import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  collectElementSearchResults,
  collectTextSearchResults,
} from '~/lib/search/resultsCollector';
import { cleanupDOM } from '../../../helpers/dom-helpers.js';

describe('lib/search/resultsCollector', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('collectTextSearchResults', () => {
    it('空のranges配列に対して空の配列を返す', () => {
      const ranges = [];
      const result = collectTextSearchResults(ranges);

      expect(result).toEqual([]);
    });

    it('単一のRangeから検索結果を収集できる', () => {
      document.body.innerHTML = '<div>This is a test sentence with some text.</div>';
      const textNode = document.body.querySelector('div')?.firstChild;
      if (!textNode) {
        throw new Error('Text node not found');
      }

      const range = document.createRange();
      range.setStart(textNode, 10);
      range.setEnd(textNode, 14); // "test"

      const result = collectTextSearchResults([range], 10);

      expect(result).toHaveLength(1);
      expect(result[0].index).toBe(0);
      expect(result[0].matchedText).toBe('test');
      expect(result[0].contextBefore.length).toBeLessThanOrEqual(10);
      expect(result[0].contextAfter.length).toBeLessThanOrEqual(10);
      expect(result[0].fullText).toContain('test');
    });

    it('複数のRangeから検索結果を収集できる', () => {
      document.body.innerHTML = '<div>This is a test. This is another test.</div>';
      const textNode = document.body.querySelector('div')?.firstChild;
      if (!textNode) {
        throw new Error('Text node not found');
      }

      const range1 = document.createRange();
      range1.setStart(textNode, 10);
      range1.setEnd(textNode, 14); // first "test"

      const range2 = document.createRange();
      range2.setStart(textNode, 32);
      range2.setEnd(textNode, 36); // second "test"

      const result = collectTextSearchResults([range1, range2], 5);

      expect(result).toHaveLength(2);
      expect(result[0].index).toBe(0);
      expect(result[0].matchedText).toBe('test');
      expect(result[1].index).toBe(1);
      expect(result[1].matchedText).toBe('test');
    });

    it('カスタムのcontextLengthを使用できる', () => {
      document.body.innerHTML = '<div>This is a test sentence with some text.</div>';
      const textNode = document.body.querySelector('div')?.firstChild;
      if (!textNode) {
        throw new Error('Text node not found');
      }

      const range = document.createRange();
      range.setStart(textNode, 10);
      range.setEnd(textNode, 14); // "test"

      const result = collectTextSearchResults([range], 5);

      expect(result).toHaveLength(1);
      expect(result[0].contextBefore.length).toBeLessThanOrEqual(5);
      expect(result[0].contextAfter.length).toBeLessThanOrEqual(5);
    });

    it('デフォルトのcontextLengthを使用する', () => {
      document.body.innerHTML = '<div>This is a test sentence.</div>';
      const textNode = document.body.querySelector('div')?.firstChild;
      if (!textNode) {
        throw new Error('Text node not found');
      }

      const range = document.createRange();
      range.setStart(textNode, 10);
      range.setEnd(textNode, 14); // "test"

      const result = collectTextSearchResults([range]);

      expect(result).toHaveLength(1);
      // デフォルトは30文字
      expect(result[0].contextBefore.length).toBeLessThanOrEqual(30);
      expect(result[0].contextAfter.length).toBeLessThanOrEqual(30);
    });

    it('前後文脈を含むfullTextを生成する', () => {
      document.body.innerHTML = '<div>This is a test sentence with some text.</div>';
      const textNode = document.body.querySelector('div')?.firstChild;
      if (!textNode) {
        throw new Error('Text node not found');
      }

      const range = document.createRange();
      range.setStart(textNode, 10);
      range.setEnd(textNode, 14); // "test"

      const result = collectTextSearchResults([range], 5);

      expect(result[0].fullText).toContain(result[0].contextBefore);
      expect(result[0].fullText).toContain(result[0].matchedText);
      expect(result[0].fullText).toContain(result[0].contextAfter);
    });

    it('前の兄弟ノードから文脈を取得できる', () => {
      document.body.innerHTML = '<div>Before test After</div>';
      const textNode = document.body.querySelector('div')?.firstChild;
      if (!textNode) {
        throw new Error('Text node not found');
      }

      const range = document.createRange();
      range.setStart(textNode, 7);
      range.setEnd(textNode, 11); // "test"

      const result = collectTextSearchResults([range], 10);

      expect(result[0].contextBefore).toContain('Before');
      expect(result[0].matchedText).toBe('test');
    });

    it('次の兄弟ノードから文脈を取得できる', () => {
      document.body.innerHTML = '<div>Before test After</div>';
      const textNode = document.body.querySelector('div')?.firstChild;
      if (!textNode) {
        throw new Error('Text node not found');
      }

      const range = document.createRange();
      range.setStart(textNode, 7);
      range.setEnd(textNode, 11); // "test"

      const result = collectTextSearchResults([range], 10);

      expect(result[0].contextAfter).toContain('After');
      expect(result[0].matchedText).toBe('test');
    });

    it('非テキストノードの場合、親要素から文脈を取得できる', () => {
      document.body.innerHTML = '<div><span>This is a test sentence.</span></div>';
      const span = document.body.querySelector('span');
      if (!span) {
        throw new Error('Span not found');
      }

      const range = document.createRange();
      range.selectNodeContents(span);

      const result = collectTextSearchResults([range], 5);

      expect(result[0].matchedText).toBe('This is a test sentence.');
      // 非テキストノードの場合、親要素から文脈を取得する
      expect(result[0].contextBefore.length).toBeLessThanOrEqual(5);
    });

    it('エラーが発生しても処理を続行する', () => {
      document.body.innerHTML = '<div>Test</div>';
      const textNode = document.body.querySelector('div')?.firstChild;
      if (!textNode) {
        throw new Error('Text node not found');
      }

      const range1 = document.createRange();
      range1.setStart(textNode, 0);
      range1.setEnd(textNode, 4);

      // 無効なrangeを作成（エラーを引き起こす）
      const range2 = document.createRange();

      const result = collectTextSearchResults([range1, range2], 5);

      // エラーが発生しても、有効なrangeの結果は返される
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].matchedText).toBe('Test');
    });
  });

  describe('collectElementSearchResults', () => {
    it('空のelements配列に対して空の配列を返す', () => {
      const elements = [];
      const result = collectElementSearchResults(elements);

      expect(result).toEqual([]);
    });

    it('単一のElementから検索結果を収集できる', () => {
      document.body.innerHTML = '<div class="test">Test content</div>';
      const element = document.body.querySelector('.test');
      if (!element) {
        throw new Error('Element not found');
      }

      const result = collectElementSearchResults([element]);

      expect(result).toHaveLength(1);
      expect(result[0].index).toBe(0);
      expect(result[0].matchedText).toContain('Test content');
      expect(result[0].contextBefore).toBe('');
      expect(result[0].contextAfter).toBe('');
      expect(result[0].tagInfo).toBe('<div.test>');
      expect(result[0].fullText).toContain('<div.test>');
    });

    it('id付きのElementのtagInfoを正しく生成する', () => {
      document.body.innerHTML = '<div id="main" class="container header">Content</div>';
      const element = document.body.querySelector('#main');
      if (!element) {
        throw new Error('Element not found');
      }

      const result = collectElementSearchResults([element]);

      expect(result[0].tagInfo).toBe('<div#main.container.header>');
    });

    it('長いテキストをcontextLengthで切り詰める', () => {
      const longText = 'A'.repeat(100);
      document.body.innerHTML = `<div class="test">${longText}</div>`;
      const element = document.body.querySelector('.test');
      if (!element) {
        throw new Error('Element not found');
      }

      const result = collectElementSearchResults([element], 30);

      expect(result[0].matchedText).toBe(`${'A'.repeat(30)}...`);
    });

    it('複数のElementから検索結果を収集できる', () => {
      document.body.innerHTML = `
        <div class="test">First content</div>
        <div class="test">Second content</div>
      `;
      const elements = Array.from(document.body.querySelectorAll('.test'));

      const result = collectElementSearchResults(elements);

      expect(result).toHaveLength(2);
      expect(result[0].index).toBe(0);
      expect(result[0].matchedText).toContain('First');
      expect(result[1].index).toBe(1);
      expect(result[1].matchedText).toContain('Second');
    });

    it('テキストコンテンツがないElementを処理できる', () => {
      document.body.innerHTML = '<div class="test"></div>';
      const element = document.body.querySelector('.test');
      if (!element) {
        throw new Error('Element not found');
      }

      const result = collectElementSearchResults([element]);

      expect(result).toHaveLength(1);
      expect(result[0].matchedText).toBe('');
      expect(result[0].tagInfo).toBe('<div.test>');
    });

    it('エラーが発生しても処理を続行する', () => {
      document.body.innerHTML = '<div class="test">Content</div>';
      const element = document.body.querySelector('.test');
      if (!element) {
        throw new Error('Element not found');
      }

      // textContentのgetterをモックしてエラーを投げる
      const originalTextContent = Object.getOwnPropertyDescriptor(Element.prototype, 'textContent');
      Object.defineProperty(element, 'textContent', {
        get: () => {
          throw new Error('textContent access failed');
        },
        configurable: true,
      });

      const result = collectElementSearchResults([element, element]);

      // エラーが発生しても、結果は返される（エラーが発生した要素はスキップされる）
      expect(result.length).toBeGreaterThanOrEqual(0);

      // 元に戻す
      if (originalTextContent) {
        Object.defineProperty(element, 'textContent', originalTextContent);
      }
    });
  });
});
