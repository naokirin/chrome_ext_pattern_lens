import { describe, expect, it, vi } from 'vitest';
import {
  ErrorSeverity,
  PatternLensError,
  createHighSeverityError,
  createLowSeverityError,
  createMediumSeverityError,
  handleError,
  safeExecute,
  safeExecuteAsync,
} from '~/lib/utils/errorHandler';

describe('errorHandler', () => {
  describe('ErrorSeverity', () => {
    it('LOW, MEDIUM, HIGHの値が定義されている', () => {
      expect(ErrorSeverity.LOW).toBe('low');
      expect(ErrorSeverity.MEDIUM).toBe('medium');
      expect(ErrorSeverity.HIGH).toBe('high');
    });
  });

  describe('PatternLensError', () => {
    it('メッセージとseverityを設定できる', () => {
      const error = new PatternLensError('Test error', ErrorSeverity.MEDIUM);

      expect(error.message).toBe('Test error');
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.name).toBe('PatternLensError');
    });

    it('デフォルトのseverityはMEDIUM', () => {
      const error = new PatternLensError('Test error');

      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('originalErrorを保持できる', () => {
      const originalError = new Error('Original error');
      const error = new PatternLensError('Test error', ErrorSeverity.MEDIUM, originalError);

      expect(error.originalError).toBe(originalError);
    });

    it('スタックトレースを保持する', () => {
      const error = new PatternLensError('Test error');

      expect(error.stack).toBeDefined();
    });
  });

  describe('createLowSeverityError', () => {
    it('LOW severityのエラーを作成できる', () => {
      const error = createLowSeverityError('Low severity error');

      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.message).toBe('Low severity error');
    });

    it('originalErrorを含められる', () => {
      const originalError = new Error('Original');
      const error = createLowSeverityError('Low error', originalError);

      expect(error.originalError).toBe(originalError);
    });
  });

  describe('createMediumSeverityError', () => {
    it('MEDIUM severityのエラーを作成できる', () => {
      const error = createMediumSeverityError('Medium severity error');

      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.message).toBe('Medium severity error');
    });

    it('originalErrorを含められる', () => {
      const originalError = new Error('Original');
      const error = createMediumSeverityError('Medium error', originalError);

      expect(error.originalError).toBe(originalError);
    });
  });

  describe('createHighSeverityError', () => {
    it('HIGH severityのエラーを作成できる', () => {
      const error = createHighSeverityError('High severity error');

      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.message).toBe('High severity error');
    });

    it('originalErrorを含められる', () => {
      const originalError = new Error('Original');
      const error = createHighSeverityError('High error', originalError);

      expect(error.originalError).toBe(originalError);
    });
  });

  describe('handleError', () => {
    let consoleErrorSpy;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('PatternLensErrorをそのまま処理する', () => {
      const error = new PatternLensError('Test error', ErrorSeverity.LOW);

      const result = handleError(error);

      expect(result).toBe(true);
    });

    it('ErrorオブジェクトをPatternLensErrorに変換する', () => {
      const error = new Error('Standard error');

      const result = handleError(error);

      expect(result).toBe(true);
    });

    it('文字列エラーをPatternLensErrorに変換する', () => {
      const result = handleError('String error');

      expect(result).toBe(true);
    });

    it('不明なエラーを処理する', () => {
      const result = handleError(null);

      expect(result).toBe(true);
    });

    it('LOW severityエラーを無視する', () => {
      const error = new PatternLensError('Low error', ErrorSeverity.LOW);

      const result = handleError(error);

      expect(result).toBe(true);
    });

    it('MEDIUM severityエラーをログに記録する', () => {
      const error = new PatternLensError('Medium error', ErrorSeverity.MEDIUM);

      handleError(error, 'Test context');

      // 開発環境ではログに記録される
      // 実際のログ出力は環境に依存するため、エラーが処理されたことを確認
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('HIGH severityエラーでコールバックを呼び出す', () => {
      const error = new PatternLensError('High error', ErrorSeverity.HIGH);
      const onHighSeverity = vi.fn();

      const result = handleError(error, 'Test context', onHighSeverity);

      expect(result).toBe(false);
      expect(onHighSeverity).toHaveBeenCalledWith(error);
    });

    it('HIGH severityエラーでコールバックがない場合はfalseを返す', () => {
      const error = new PatternLensError('High error', ErrorSeverity.HIGH);

      const result = handleError(error, 'Test context');

      expect(result).toBe(false);
    });

    it('コンテキスト情報を含めてログに記録する', () => {
      const error = new PatternLensError('Test error', ErrorSeverity.MEDIUM);

      handleError(error, 'TestContext');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[TestContext]'));
    });

    it('originalErrorを含めてログに記録する', () => {
      const originalError = new Error('Original error');
      const error = new PatternLensError('Test error', ErrorSeverity.MEDIUM, originalError);

      handleError(error, 'TestContext');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext]'),
        originalError
      );
    });
  });

  describe('safeExecute', () => {
    it('正常に実行された関数の結果を返す', () => {
      const fn = () => 'success';

      const result = safeExecute(fn);

      expect(result).toBe('success');
    });

    it('エラーが発生した場合defaultValueを返す', () => {
      const fn = () => {
        throw new Error('Test error');
      };

      const result = safeExecute(fn, 'TestContext', 'default');

      expect(result).toBe('default');
    });

    it('defaultValueがない場合undefinedを返す', () => {
      const fn = () => {
        throw new Error('Test error');
      };

      const result = safeExecute(fn, 'TestContext');

      expect(result).toBeUndefined();
    });

    it('エラーをhandleErrorで処理する', () => {
      const fn = () => {
        throw new Error('Test error');
      };
      const handleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      safeExecute(fn, 'TestContext');

      expect(handleErrorSpy).toHaveBeenCalled();
      handleErrorSpy.mockRestore();
    });

    it('数値を返す関数を実行できる', () => {
      const fn = () => 42;

      const result = safeExecute(fn);

      expect(result).toBe(42);
    });

    it('オブジェクトを返す関数を実行できる', () => {
      const fn = () => ({ key: 'value' });

      const result = safeExecute(fn);

      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('safeExecuteAsync', () => {
    it('正常に実行された非同期関数の結果を返す', async () => {
      const fn = async () => 'success';

      const result = await safeExecuteAsync(fn);

      expect(result).toBe('success');
    });

    it('エラーが発生した場合defaultValueを返す', async () => {
      const fn = async () => {
        throw new Error('Test error');
      };

      const result = await safeExecuteAsync(fn, 'TestContext', 'default');

      expect(result).toBe('default');
    });

    it('defaultValueがない場合undefinedを返す', async () => {
      const fn = async () => {
        throw new Error('Test error');
      };

      const result = await safeExecuteAsync(fn, 'TestContext');

      expect(result).toBeUndefined();
    });

    it('エラーをhandleErrorで処理する', async () => {
      const fn = async () => {
        throw new Error('Test error');
      };
      const handleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await safeExecuteAsync(fn, 'TestContext');

      expect(handleErrorSpy).toHaveBeenCalled();
      handleErrorSpy.mockRestore();
    });

    it('Promiseを返す関数を実行できる', async () => {
      const fn = () => Promise.resolve('success');

      const result = await safeExecuteAsync(fn);

      expect(result).toBe('success');
    });

    it('非同期で数値を返す関数を実行できる', async () => {
      const fn = async () => 42;

      const result = await safeExecuteAsync(fn);

      expect(result).toBe(42);
    });
  });
});
