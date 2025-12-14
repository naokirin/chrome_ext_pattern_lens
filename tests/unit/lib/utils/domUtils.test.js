import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getElementById, getRequiredElementById } from '~/lib/utils/domUtils';
import { cleanupDOM } from '../../../helpers/dom-helpers.js';

describe('domUtils', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('getElementById', () => {
    it('存在する要素を取得できる', () => {
      cleanupDOM();
      const div = document.createElement('div');
      div.id = 'test-element';
      document.body.appendChild(div);

      const result = getElementById('test-element');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-element');
    });

    it('存在しない要素はnullを返す', () => {
      cleanupDOM();
      const result = getElementById('non-existent');

      expect(result).toBeNull();
    });

    it('型アサーションが正しく機能する', () => {
      cleanupDOM();
      const input = document.createElement('input');
      input.id = 'test-input';
      input.type = 'text';
      document.body.appendChild(input);

      const result = getElementById('test-input');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.type).toBe('text');
      }
    });
  });

  describe('getRequiredElementById', () => {
    it('存在する要素を取得できる', () => {
      cleanupDOM();
      const div = document.createElement('div');
      div.id = 'required-element';
      document.body.appendChild(div);

      const result = getRequiredElementById('required-element');

      expect(result).not.toBeNull();
      expect(result.id).toBe('required-element');
    });

    it('存在しない要素はエラーを投げる', () => {
      cleanupDOM();
      expect(() => {
        getRequiredElementById('non-existent');
      }).toThrow('Required element with ID "non-existent" not found');
    });

    it('エラーメッセージにIDが含まれる', () => {
      cleanupDOM();
      const id = 'missing-element';
      expect(() => {
        getRequiredElementById(id);
      }).toThrow(`Required element with ID "${id}" not found`);
    });

    it('型アサーションが正しく機能する', () => {
      cleanupDOM();
      const button = document.createElement('button');
      button.id = 'test-button';
      button.type = 'button';
      document.body.appendChild(button);

      const result = getRequiredElementById('test-button');

      expect(result.type).toBe('button');
    });
  });
});
