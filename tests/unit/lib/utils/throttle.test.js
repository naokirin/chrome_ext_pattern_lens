import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce, throttle, throttleAnimationFrame } from '~/lib/utils/throttle';

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('throttle', () => {
    it('指定時間内に複数回呼び出された場合、最初の呼び出しのみ即座に実行される', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('arg1');
      throttled('arg2');
      throttled('arg3');

      // 最初の呼び出しは即座に実行される
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg1');

      // 時間を進めても、まだスロットル中なので実行されない
      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);

      // 残りの時間を進めると、最後の呼び出しが実行される
      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('arg3');
    });

    it('指定時間経過後は即座に実行される', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('first');
      expect(fn).toHaveBeenCalledTimes(1);

      // 時間を進める
      vi.advanceTimersByTime(100);

      // 次の呼び出しは即座に実行される
      throttled('second');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('second');
    });

    it('複数の引数を正しく受け渡す', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('arg1', 'arg2', 123);
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('連続して呼び出された場合、最後の引数で実行される', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('first');
      throttled('second');
      throttled('third');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('first');

      // 残りの時間を進めると、最後の呼び出しが実行される
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('third');
    });

    it('複数回のスロットルサイクルで正しく動作する', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      // 1回目のサイクル
      throttled('cycle1-1');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('cycle1-1');

      throttled('cycle1-2');
      // cycle1-2はスロットルされる（まだ実行されない）
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledWith('cycle1-2');

      // 2回目のサイクル
      // 注意: vi.useFakeTimers()では、setTimeout内でDate.now()が呼ばれるため、
      // lastCallTimeはsetTimeoutが実行された時点の時刻になる
      // vi.advanceTimersByTime(100)の後、Date.now()は100ms進んでいるが、
      // lastCallTimeも同じ時刻（100ms）になっている
      // そのため、cycle2-1を呼び出した時点では、Date.now()とlastCallTimeの差が0になる
      // つまり、cycle2-1はスロットルされる（即座に実行されない）
      throttled('cycle2-1');
      // cycle2-1はスロットルされる（前回の実行から時間が経過していないため）
      expect(fn).toHaveBeenCalledTimes(2);

      throttled('cycle2-2');
      // cycle2-2もスロットルされる（まだ実行されない）
      expect(fn).toHaveBeenCalledTimes(2);

      // 100ms進めると、最後の呼び出し（cycle2-2）が実行される
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(3);
      expect(fn).toHaveBeenLastCalledWith('cycle2-2');
    });
  });

  describe('debounce', () => {
    it('連続して呼び出された場合、最後の呼び出しのみ実行される', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('first');
      debounced('second');
      debounced('third');

      // まだ実行されない
      expect(fn).not.toHaveBeenCalled();

      // 時間を進める
      vi.advanceTimersByTime(100);

      // 最後の呼び出しのみ実行される
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('third');
    });

    it('指定時間内に再度呼び出されると、タイマーがリセットされる', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('first');
      vi.advanceTimersByTime(50);

      // 再度呼び出し
      debounced('second');
      vi.advanceTimersByTime(50);

      // まだ実行されない（タイマーがリセットされたため）
      expect(fn).not.toHaveBeenCalled();

      // さらに時間を進める
      vi.advanceTimersByTime(50);

      // 最後の呼び出しが実行される
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('second');
    });

    it('複数の引数を正しく受け渡す', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('arg1', 'arg2', 123);
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('複数回のデバウンスサイクルで正しく動作する', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      // 1回目のサイクル
      debounced('cycle1');
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('cycle1');

      // 2回目のサイクル
      debounced('cycle2');
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledWith('cycle2');
    });

    it('呼び出しがない場合、実行されない', () => {
      const fn = vi.fn();
      debounce(fn, 100);

      vi.advanceTimersByTime(1000);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('throttleAnimationFrame', () => {
    beforeEach(() => {
      // requestAnimationFrameをモック
      global.requestAnimationFrame = vi.fn((callback) => {
        return setTimeout(callback, 16); // 約60fps
      });
      global.cancelAnimationFrame = vi.fn((id) => {
        clearTimeout(id);
      });
    });

    it('requestAnimationFrameを使用して関数を実行する', () => {
      const fn = vi.fn();
      const throttled = throttleAnimationFrame(fn);

      throttled('arg1');

      expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
      expect(fn).not.toHaveBeenCalled();

      // アニメーションフレームを進める
      vi.advanceTimersByTime(16);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg1');
    });

    it('連続して呼び出された場合、最初の呼び出しのみrequestAnimationFrameをスケジュールする', () => {
      const fn = vi.fn();
      const throttled = throttleAnimationFrame(fn);

      throttled('first');
      throttled('second');
      throttled('third');

      // requestAnimationFrameは1回のみ呼ばれる
      expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
      expect(fn).not.toHaveBeenCalled();

      // アニメーションフレームを進める
      vi.advanceTimersByTime(16);

      // 最後の引数で実行される
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('third');
    });

    it('複数の引数を正しく受け渡す', () => {
      const fn = vi.fn();
      const throttled = throttleAnimationFrame(fn);

      throttled('arg1', 'arg2', 123);
      vi.advanceTimersByTime(16);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('複数回のアニメーションフレームサイクルで正しく動作する', () => {
      const fn = vi.fn();
      const throttled = throttleAnimationFrame(fn);

      // 1回目のサイクル
      throttled('cycle1');
      vi.advanceTimersByTime(16);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('cycle1');

      // 2回目のサイクル
      throttled('cycle2');
      expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(16);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledWith('cycle2');
    });

    it('連続呼び出し後に新しい呼び出しができる', () => {
      const fn = vi.fn();
      const throttled = throttleAnimationFrame(fn);

      // 最初のバッチ
      throttled('batch1-1');
      throttled('batch1-2');

      // アニメーションフレームを進める
      vi.advanceTimersByTime(16);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('batch1-2');

      // 次のバッチ
      throttled('batch2-1');
      throttled('batch2-2');
      expect(requestAnimationFrame).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(16);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledWith('batch2-2');
    });
  });
});
