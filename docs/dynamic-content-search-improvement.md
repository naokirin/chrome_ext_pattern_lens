# 動的要素検索改善計画

## 実装状況

### フェーズ1: 基本実装 ✅ 完了
- DOMObserver クラスの作成 (`lib/observers/domObserver.ts`)
- MutationObserver による DOM 変更監視
- 検索ハンドラーへの統合
- デバウンス機能（500ms）
- レート制限（10回/秒）
- テストの追加

### フェーズ2: 設定UI追加 ✅ 完了
- 設定ページに「動的に追加された要素を自動的に検索する」オプションを追加
- Settings型に autoUpdateSearch フィールドを追加
- content script で設定を読み込み、DOMObserver の有効/無効を制御
- 設定変更時にリアルタイムで反映

### フェーズ3: インクリメンタル検索 ⏸️ 保留
- 変更された領域のみを再検索する機能
- 仮想テキストレイヤーの部分更新が必要で複雑
- 現在の全体再検索で十分な性能が得られているため保留

---

## 現状の問題点

### 1. 検索タイミングの問題
- **問題**: 検索はユーザーが手動で実行するか、入力変更時にのみ実行される
- **影響**: 動的に追加された要素は検索されない
- **例**: SPA（Single Page Application）でコンテンツが非同期に読み込まれる場合

### 2. DOM変更の監視不足
- **問題**: MutationObserver が使用されていない
- **影響**: DOM変更を検知できない
- **例**: 
  - 無限スクロールで新しいコンテンツが追加される
  - タブ切り替えでコンテンツが動的に変更される
  - フォーム送信後に結果が表示される

### 3. 検索結果の更新不足
- **問題**: 一度検索を実行すると、その後のDOM変更が反映されない
- **影響**: 新しいマッチが見つかっても表示されない
- **例**: チャットアプリで新しいメッセージが追加された場合

### 4. パフォーマンスへの懸念
- **問題**: 全DOMを再走査するのは重い処理
- **影響**: 頻繁なDOM変更があるページでパフォーマンスが低下する可能性

## 改善方針

### 方針1: MutationObserver によるDOM変更監視（推奨）

#### 1.1 基本アーキテクチャ

```
検索実行時
  ↓
MutationObserver を設定
  ↓
DOM変更を検知
  ↓
変更された領域のみ再検索（インクリメンタル検索）
  ↓
検索結果を更新
```

#### 1.2 実装の詳細

**ファイル**: `lib/observers/domObserver.ts` (新規作成)

```typescript
/**
 * DOM変更を監視し、検索結果を自動更新
 */
export class DOMSearchObserver {
  private observer: MutationObserver | null = null;
  private stateManager: SearchStateManager;
  private currentSearchQuery: string | null = null;
  private searchOptions: SearchOptions | null = null;
  private debounceTimer: number | null = null;
  
  constructor(stateManager: SearchStateManager) {
    this.stateManager = stateManager;
  }
  
  /**
   * 検索を開始し、DOM変更を監視
   */
  startObserving(
    query: string,
    options: SearchOptions
  ): void {
    this.currentSearchQuery = query;
    this.searchOptions = options;
    
    // 初期検索を実行
    this.performSearch();
    
    // MutationObserver を設定
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });
    
    this.observer.observe(document.body, {
      childList: true,      // 子要素の追加・削除
      subtree: true,       // すべての子孫要素を監視
      characterData: true, // テキストノードの変更
      attributes: false,   // 属性変更は不要（パフォーマンス考慮）
    });
  }
  
  /**
   * DOM変更を処理
   */
  private handleMutations(mutations: MutationRecord[]): void {
    // 変更された要素を収集
    const changedNodes = new Set<Node>();
    
    mutations.forEach((mutation) => {
      // 追加されたノード
      mutation.addedNodes.forEach((node) => {
        changedNodes.add(node);
        // 子孫ノードも追加
        if (node.nodeType === Node.ELEMENT_NODE) {
          const walker = document.createTreeWalker(
            node,
            NodeFilter.SHOW_ALL,
            null
          );
          let current = walker.nextNode();
          while (current) {
            changedNodes.add(current);
            current = walker.nextNode();
          }
        }
      });
      
      // 削除されたノード（既存の検索結果が無効になる可能性）
      mutation.removedNodes.forEach((node) => {
        this.invalidateRangesInNode(node);
      });
      
      // テキストノードの変更
      if (mutation.type === 'characterData') {
        changedNodes.add(mutation.target);
      }
    });
    
    // 変更があった場合、デバウンスして再検索
    if (changedNodes.size > 0) {
      this.debouncedReSearch();
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
    }, 500); // 500ms デバウンス
  }
  
  /**
   * 検索を実行
   */
  private performSearch(): void {
    if (!this.currentSearchQuery || !this.searchOptions) {
      return;
    }
    
    // 既存の検索ロジックを呼び出し
    // searchText() または searchElements() を使用
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
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
```

#### 1.3 インクリメンタル検索の最適化

**方針**: 変更された領域のみを再検索する

```typescript
/**
 * 変更された領域のみを再検索
 */
private performIncrementalSearch(changedNodes: Set<Node>): void {
  // 変更されたノードを含む範囲を特定
  const searchRanges: Range[] = [];
  
  changedNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      range.selectNodeContents(node);
      searchRanges.push(range);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // 要素内のテキストノードを取得
      const walker = document.createTreeWalker(
        node,
        NodeFilter.SHOW_TEXT,
        null
      );
      let textNode = walker.nextNode();
      while (textNode) {
        const range = document.createRange();
        range.selectNodeContents(textNode);
        searchRanges.push(range);
        textNode = walker.nextNode();
      }
    }
  });
  
  // 変更された範囲のみを検索
  // 既存の検索結果とマージ
}
```

### 方針2: 手動更新ボタンの追加（簡易実装）

#### 2.1 UI追加

- ポップアップに「再検索」ボタンを追加
- ユーザーが手動で検索を更新できる

#### 2.2 実装

**ファイル**: `entrypoints/popup/main.ts`

```typescript
// 再検索ボタンの追加
const refreshButton = document.getElementById('refresh-search');
refreshButton?.addEventListener('click', () => {
  performSearch();
});
```

**メリット**:
- 実装が簡単
- パフォーマンスへの影響が少ない

**デメリット**:
- ユーザーが手動で更新する必要がある
- 自動更新の利便性がない

### 方針3: ハイブリッドアプローチ（推奨）

#### 3.1 設定可能な自動更新

- デフォルト: MutationObserver による自動更新を有効化
- オプション: ユーザーが自動更新を無効化できる
- パフォーマンスが重要なページでは手動更新に切り替え可能

#### 3.2 実装

**ファイル**: `lib/observers/domObserver.ts`

```typescript
export interface ObserverOptions {
  enabled: boolean;           // 自動更新を有効化するか
  debounceMs: number;         // デバウンス時間（デフォルト: 500ms）
  maxMutationsPerSecond: number; // 1秒あたりの最大変更数（レート制限）
}
```

**ファイル**: `entrypoints/options/main.ts`

```typescript
// 設定に追加
interface Options {
  // ... 既存の設定
  autoUpdateSearch: boolean;  // 自動更新を有効化
  autoUpdateDebounceMs: number; // デバウンス時間
}
```

## 実装計画

### フェーズ1: 基本実装（必須）

1. **DOMObserver クラスの作成**
   - `lib/observers/domObserver.ts` を作成
   - MutationObserver の基本実装
   - 検索実行時に自動的に監視を開始

2. **検索ハンドラーの統合**
   - `lib/messaging/handlers.ts` で DOMObserver を使用
   - 検索開始時に監視を開始
   - 検索クリア時に監視を停止

3. **テストの追加**
   - DOM変更時の検索更新をテスト
   - パフォーマンステスト

### フェーズ2: 最適化（推奨）

1. **インクリメンタル検索の実装**
   - 変更された領域のみを再検索
   - 既存の検索結果とマージ

2. **パフォーマンス最適化**
   - レート制限の実装
   - 大量の変更がある場合の処理

3. **設定UIの追加**
   - 自動更新の有効/無効を切り替え
   - デバウンス時間の調整

### フェーズ3: 高度な機能（オプション）

1. **Shadow DOM サポート**
   - Shadow Root 内の変更も監視

2. **iframe サポート**
   - iframe 内のコンテンツ変更も監視

3. **検索結果の差分更新**
   - 変更前後の検索結果を比較
   - 追加・削除されたマッチを識別

## パフォーマンス考慮事項

### 1. デバウンス
- DOM変更が頻繁に発生する場合、デバウンスで処理を制限
- デフォルト: 500ms

### 2. レート制限
- 1秒あたりの最大変更数を制限
- 超過した場合は、一定時間後に一括処理

### 3. 範囲の最適化
- 変更された領域のみを再検索
- 全DOMを再走査しない

### 4. メモリ管理
- 不要な MutationObserver を適切に破棄
- 検索結果のキャッシュを適切に管理

## テスト計画

### 1. ユニットテスト
- DOMObserver クラスのテスト
- デバウンス機能のテスト
- レート制限のテスト

### 2. 統合テスト
- SPAでの動作テスト
- 無限スクロールでの動作テスト
- チャットアプリでの動作テスト

### 3. パフォーマンステスト
- 大量のDOM変更がある場合のパフォーマンス
- メモリリークの確認

## リスクと対策

### リスク1: パフォーマンスの低下
- **対策**: デバウンスとレート制限を実装
- **対策**: インクリメンタル検索で範囲を限定

### リスク2: 無限ループ
- **対策**: 変更検知の再帰を防止
- **対策**: 変更フラグで制御

### リスク3: メモリリーク
- **対策**: 適切なクリーンアップ処理
- **対策**: WeakMap の使用を検討

## 参考実装

- Chrome DevTools の検索機能
- VS Code の検索機能
- Firefox の検索機能

## 次のステップ

1. **フェーズ1の実装を開始**
   - DOMObserver クラスの基本実装
   - 検索ハンドラーとの統合

2. **テストの作成**
   - 基本的な動作確認
   - パフォーマンステスト

3. **ユーザーフィードバックの収集**
   - 実装後の動作確認
   - 問題点の特定と改善
