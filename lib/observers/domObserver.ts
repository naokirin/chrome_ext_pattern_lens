/**
 * DOM変更を監視し、検索結果を自動更新
 */
import type { SearchStateManager } from '~/lib/state/searchState';
import type { SearchState } from '~/lib/types';
import { handleError } from '~/lib/utils/errorHandler';

/**
 * DOM変更監視のオプション
 */
export interface ObserverOptions {
  enabled: boolean; // 自動更新を有効化するか
  debounceMs: number; // デバウンス時間（ミリ秒）
}

/**
 * デフォルトのオプション
 */
const DEFAULT_OPTIONS: ObserverOptions = {
  enabled: true,
  debounceMs: 100,
};

/**
 * 検索実行関数の型
 */
export type SearchFunction = (
  query: string,
  options: SearchState,
  stateManager: SearchStateManager,
  updateCallback?: (() => void) | null,
  skipNavigation?: boolean
) => void;

/**
 * DOM変更を監視し、検索結果を自動更新するクラス
 */
export class DOMSearchObserver {
  private observer: MutationObserver | null = null;
  private stateManager: SearchStateManager;
  private currentSearchQuery: string | null = null;
  private searchOptions: SearchState | null = null;
  private searchFunction: SearchFunction | null = null;
  private updateCallback: (() => void) | null = null;
  private options: ObserverOptions;
  private debounceTimer: number | null = null;
  private isSearching = false;

  constructor(stateManager: SearchStateManager, options?: Partial<ObserverOptions>) {
    this.stateManager = stateManager;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 検索を開始し、DOM変更を監視
   */
  startObserving(
    query: string,
    searchOptions: SearchState,
    searchFunction: SearchFunction,
    updateCallback?: (() => void) | null
  ): void {
    // 既存の監視を停止
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // 検索情報を保存（enabled が false でも保存しておく）
    this.currentSearchQuery = query;
    this.searchOptions = searchOptions;
    this.searchFunction = searchFunction;
    this.updateCallback = updateCallback || null;

    if (!this.options.enabled) {
      return;
    }

    // MutationObserver を設定
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(document.body, {
      childList: true, // 子要素の追加・削除
      subtree: true, // すべての子孫要素を監視
      characterData: true, // テキストノードの変更
      attributes: false, // 属性変更は不要（パフォーマンス考慮）
    });
  }

  /**
   * DOM変更を処理
   */
  private handleMutations(mutations: MutationRecord[]): void {
    if (!this.currentSearchQuery || !this.searchOptions || !this.searchFunction) {
      return;
    }

    // 変更された要素を収集
    const hasRelevantChanges = this.collectChangedNodes(mutations);

    if (hasRelevantChanges) {
      // 変更があった場合、デバウンスして再検索
      // （デバウンスにより自動的にレート制限される）
      this.debouncedReSearch();
    }
  }

  /**
   * 変更されたノードを収集し、関連する変更があるかチェック
   */
  private collectChangedNodes(mutations: MutationRecord[]): boolean {
    let hasRelevantChanges = false;

    mutations.forEach((mutation) => {
      // 追加されたノード
      mutation.addedNodes.forEach((node) => {
        if (this.isRelevantNode(node)) {
          hasRelevantChanges = true;
        }
      });

      // 削除されたノード（既存の検索結果が無効になる可能性）
      mutation.removedNodes.forEach((node) => {
        if (this.isRelevantNode(node)) {
          hasRelevantChanges = true;
          this.invalidateRangesInNode(node);
        }
      });

      // テキストノードの変更
      if (mutation.type === 'characterData') {
        if (this.isRelevantNode(mutation.target)) {
          hasRelevantChanges = true;
        }
      }
    });

    return hasRelevantChanges;
  }

  /**
   * ノードが検索に関連するかチェック
   */
  private isRelevantNode(node: Node): boolean {
    // テキストノードは常に関連
    if (node.nodeType === Node.TEXT_NODE) {
      return true;
    }

    // 要素ノードの場合、テキストコンテンツがあるかチェック
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      // script, style, overlay container は除外
      if (
        element.tagName === 'SCRIPT' ||
        element.tagName === 'STYLE' ||
        element.id === 'pattern-lens-overlay-container' ||
        element.closest('#pattern-lens-overlay-container')
      ) {
        return false;
      }
      // テキストコンテンツがあるかチェック
      return element.textContent !== null && element.textContent.trim().length > 0;
    }

    return false;
  }

  /**
   * ノード内の範囲を無効化
   */
  private invalidateRangesInNode(node: Node): void {
    // 削除されたノード内に含まれる範囲を無効化
    const ranges = this.stateManager.ranges;
    const invalidRanges: Range[] = [];

    ranges.forEach((range) => {
      try {
        // 範囲の開始/終了ノードが削除されたノードの子孫かチェック
        if (node.contains(range.startContainer) || node.contains(range.endContainer)) {
          invalidRanges.push(range);
        }
      } catch {
        // 範囲が無効になった場合（ノードが削除されたなど）
        invalidRanges.push(range);
      }
    });

    // 無効な範囲を削除
    if (invalidRanges.length > 0) {
      // 範囲を再作成する必要があるため、再検索を実行
      // ここではフラグを設定するだけ
    }
  }

  /**
   * デバウンス付き再検索
   */
  private debouncedReSearch(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.performSearch();
      this.debounceTimer = null;
    }, this.options.debounceMs);
  }

  /**
   * 検索を実行
   */
  private performSearch(): void {
    if (
      !this.currentSearchQuery ||
      !this.searchOptions ||
      !this.searchFunction ||
      this.isSearching
    ) {
      return;
    }

    try {
      this.isSearching = true;

      // 既存の検索ロジックを呼び出し（スクロール位置を変えないため skipNavigation=true）
      this.searchFunction(
        this.currentSearchQuery,
        this.searchOptions,
        this.stateManager,
        this.updateCallback,
        true // skipNavigation
      );

      // ポップアップに検索結果の更新を通知
      this.notifyPopup();
    } catch (error) {
      handleError(error, 'DOMSearchObserver: Search failed', undefined);
    } finally {
      this.isSearching = false;
    }
  }

  /**
   * ポップアップに検索結果の更新を通知
   */
  private notifyPopup(): void {
    try {
      chrome.runtime.sendMessage({
        action: 'searchUpdated',
        totalMatches: this.stateManager.totalMatches,
        currentIndex: this.stateManager.currentIndex,
      });
    } catch {
      // ポップアップが閉じている場合は無視
    }
  }

  /**
   * 監視を停止
   */
  stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.currentSearchQuery = null;
    this.searchOptions = null;
    this.searchFunction = null;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isSearching = false;
  }

  /**
   * オプションを更新
   */
  updateOptions(options: Partial<ObserverOptions>): void {
    const wasEnabled = this.options.enabled;
    this.options = { ...this.options, ...options };

    // enabled が true に変わり、検索情報がある場合は監視を開始
    if (!wasEnabled && this.options.enabled && this.currentSearchQuery && this.searchFunction) {
      this.observer = new MutationObserver((mutations) => {
        this.handleMutations(mutations);
      });
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: false,
      });
    }
    // enabled が false に変わった場合は監視を停止（検索情報は保持）
    else if (wasEnabled && !this.options.enabled && this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * 監視中かどうか
   */
  get isObserving(): boolean {
    return this.observer !== null;
  }
}
