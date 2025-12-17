# コードレビュー: 発見された問題点

**レビュー日**: 2024年12月18日

## 概要

lint、TypeScript型チェック、テストはすべてパス。重大な問題はなく、以下は軽微な改善点。

---

## 問題一覧

### 1. ~~重複したコード~~ [修正済み]

**ファイル**: `entrypoints/popup/main.ts` 112-113行目

~~重複行を削除。~~

---

### 2. ~~未使用のインポート~~ [修正済み]

**ファイル**: `lib/search/resultsCollector.ts`

~~`MIN_RESULTS_LIST_CONTEXT_LENGTH` を削除。~~

---

### 3. ~~未実装のロジック~~ [修正済み]

**ファイル**: `lib/observers/domObserver.ts` 174-196行目 `invalidateRangesInNode`

~~コメントを明確化（再検索で全て再構築されるため、ここでは何もしない旨を記載）。~~

---

### 4. ~~エラーハンドリングの不足~~ [修正済み]

**ファイル**: `entrypoints/popup/main.ts`

~~`navigateNext` / `navigatePrev` に `chrome.runtime.lastError` チェックを追加。~~

---

### 5. 型安全性の改善余地 [優先度: 低]

**ファイル**: `lib/messaging/handlers.ts` 72-86行目

`searchElements` の戻り値を `result` に代入後、DOM観察用の `searchFunction` 内で同じ関数を再度呼んでいるが、戻り値を使用していない。

**影響**: 動作に問題なし。コードの明確性の問題。

---

### 6. ~~リスナー未解除~~ [対応不要]

**ファイル**: `entrypoints/content.ts`

`chrome.storage.onChanged` と `chrome.runtime.onMessage` のリスナーが登録されているが、アンロード時の解除処理がない。

**結論**: WXTフレームワークを使用しており、以下の理由で対応不要。
- WXTの`defineContentScript`がコンテンツスクリプトのライフサイクルを管理
- ページ遷移時にコンテンツスクリプトは自動的にアンロードされ、リスナーも無効化される
- WXTはSPAでの重複実行を防ぐ仕組みを持つ

---

## テストコードの改善点

### T1. 統合テストでの実装ロジック重複 [優先度: 中]

**ファイル**: `tests/integration/scrollResize.test.js`

テスト内で `updateOverlayPositions` 関数を独自に実装している（122-205行目）。実際の実装（`lib/highlight/overlay.ts`）と乖離するリスクがある。

**影響**: 実装が変更されてもテストが気付かず、カバレッジの意味が薄れる。

**修正方法**: 実際のモジュールをインポートしてテストするか、モック対象を明確に絞る。

---

### T2. ~~未使用変数の存在~~ [修正済み]

**ファイル**: `tests/integration/scrollResize.test.js`

~~未使用変数を削除。~~

---

### T3. ~~テストヘルパーの活用不足~~ [問題なし]

**ファイル**: `tests/helpers/dom-helpers.js`

~~`visualizeBoundaries` は `virtualText.test.js` で使用されていた。問題なし。~~

---

### T4. Chrome API モックの重複定義 [優先度: 中]

**ファイル**: `tests/setup.js` と各統合テストファイル

`tests/setup.js` でグローバルに Chrome API をモックしているが、各統合テスト（例: `scrollResize.test.js`）でも個別にモックを再定義している。

**影響**: モックの一貫性が保証されない。setup.js の変更が反映されない。

**修正方法**: 共通のモックファクトリを作成するか、テストごとに必要な部分のみオーバーライドする。

---

### T5. マジックナンバーの使用 [優先度: 低]

**ファイル**: 複数のテストファイル

```javascript
const longSpacing = 'あ'.repeat(200);  // fuzzySearch.test.js
rect = new DOMRect(0, index * 200 + 100, 100, 20);  // scrollResize.test.js
```

**影響**: テストの意図が不明確。

**修正方法**: 定数として定義し、意図を明確化する。

---

### T6. テストカバレッジのギャップ [優先度: 中]

以下の機能にテストが不足している可能性がある:

1. **`lib/messaging/router.ts`**: エラーケースのテストが限定的
2. **`entrypoints/popup/main.ts`**: E2Eテストがない（UI操作のテスト）
3. **`lib/observers/domObserver.ts`**: `updateOptions` の動的切り替えテストが不十分

---

### T7. 非同期テストのタイムアウト処理 [優先度: 低]

**ファイル**: 統合テスト全般

`setTimeout` を使用した Promise ベースの待機が多いが、タイムアウト時のエラーハンドリングがない。

```javascript
await new Promise((resolve) => {
  chrome.tabs.sendMessage(1, message, () => {
    resolve(null);
  });
});
```

**影響**: テストが無限に待機する可能性（現状問題なし）。

---

## 推奨アクション

### プロダクションコード

- ~~#1 重複コード~~ ✅ 修正済み
- ~~#2 未使用インポート~~ ✅ 修正済み
- ~~#3 未実装ロジック~~ ✅ 修正済み
- ~~#4 エラーハンドリング~~ ✅ 修正済み
- #5 型安全性の改善 → 将来的に検討
- ~~#6 リスナー未解除~~ ✅ 対応不要（WXTが管理）

### テストコード

- ~~T2 未使用変数~~ ✅ 修正済み
- ~~T3 テストヘルパー~~ ✅ 問題なし
- T1 統合テストの実装ロジック重複 → 将来的に検討
- T4 Chrome API モックの共通化 → 将来的に検討
- T5 マジックナンバー → 将来的に検討
- T6 テストカバレッジの拡充 → 将来的に検討
- T7 非同期テストのタイムアウト → 将来的に検討
