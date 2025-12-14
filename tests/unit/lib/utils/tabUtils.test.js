import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getActiveTab, isSpecialPage } from '~/lib/utils/tabUtils';

describe('tabUtils', () => {
  beforeEach(() => {
    // Reset chrome.tabs.query mock
    global.chrome = {
      tabs: {
        query: vi.fn(),
      },
    };
  });

  describe('isSpecialPage', () => {
    it('chrome://で始まるURLはtrueを返す', () => {
      expect(isSpecialPage('chrome://settings')).toBe(true);
      expect(isSpecialPage('chrome://extensions')).toBe(true);
    });

    it('chrome-extension://で始まるURLはtrueを返す', () => {
      expect(isSpecialPage('chrome-extension://abc123')).toBe(true);
    });

    it('webstoreのURLはtrueを返す', () => {
      expect(isSpecialPage('https://chrome.google.com/webstore')).toBe(true);
      expect(isSpecialPage('https://chrome.google.com/webstore/detail/test')).toBe(true);
    });

    it('通常のURLはfalseを返す', () => {
      expect(isSpecialPage('https://example.com')).toBe(false);
      expect(isSpecialPage('http://localhost:3000')).toBe(false);
      expect(isSpecialPage('https://github.com')).toBe(false);
    });

    it('undefinedはfalseを返す', () => {
      expect(isSpecialPage(undefined)).toBe(false);
    });

    it('空文字列はfalseを返す', () => {
      expect(isSpecialPage('')).toBe(false);
    });
  });

  describe('getActiveTab', () => {
    it('タブが存在する場合、タブを返す', async () => {
      const mockTab = { id: 1, url: 'https://example.com' };
      global.chrome.tabs.query = vi.fn(() => Promise.resolve([mockTab]));

      const result = await getActiveTab();

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.url).toBe('https://example.com');
    });

    it('タブが存在しない場合、nullを返す', async () => {
      global.chrome.tabs.query = vi.fn(() => Promise.resolve([]));

      const result = await getActiveTab();

      expect(result).toBeNull();
    });

    it('タブにidがない場合、nullを返す', async () => {
      const mockTab = { url: 'https://example.com' }; // idなし
      global.chrome.tabs.query = vi.fn(() => Promise.resolve([mockTab]));

      const result = await getActiveTab();

      expect(result).toBeNull();
    });

    it('タブのidがundefinedの場合、nullを返す', async () => {
      const mockTab = { id: undefined, url: 'https://example.com' };
      global.chrome.tabs.query = vi.fn(() => Promise.resolve([mockTab]));

      const result = await getActiveTab();

      expect(result).toBeNull();
    });

    it('返されたタブはidがnumber型であることを保証', async () => {
      const mockTab = { id: 123, url: 'https://example.com' };
      global.chrome.tabs.query = vi.fn(() => Promise.resolve([mockTab]));

      const result = await getActiveTab();

      expect(result).not.toBeNull();
      if (result) {
        expect(typeof result.id).toBe('number');
        expect(result.id).toBe(123);
      }
    });
  });
});
