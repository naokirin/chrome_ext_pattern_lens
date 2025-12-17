# コードレビュー: 発見された問題点

**レビュー日**: 2024年12月18日

## 概要

lint、TypeScript型チェック、テストはすべてパス。重大な問題はなく、以下は軽微な改善点。

---

## 問題一覧

### 1. 重複したコード [優先度: 低]

**ファイル**: `entrypoints/popup/main.ts` 112-113行目

```typescript
document.body.classList.remove('has-results-list');
document.body.classList.remove('has-results-list'); // 重複
```

**影響**: 動作に影響なし。コードの冗長性のみ。

**修正方法**: 重複行を削除。

---

### 2. 未使用のインポート [優先度: 低]

**ファイル**: `lib/search/resultsCollector.ts`

`MIN_RESULTS_LIST_CONTEXT_LENGTH` がインポートされているが、関数内で使用されていない。

**影響**: バンドルサイズへの微小な影響のみ。

**修正方法**: 未使用インポートを削除するか、バリデーションに使用する。

---

### 3. 未実装のロジック [優先度: 中]

**ファイル**: `lib/observers/domObserver.ts` 174-196行目 `invalidateRangesInNode`

```typescript
// 無効な範囲を削除
if (invalidRanges.length > 0) {
  // 範囲を再作成する必要があるため、再検索を実行
  // ここではフラグを設定するだけ
}
```

無効な範囲を検出しても実際には何も処理していない。コメントではフラグ設定と書かれているが未実装。

**影響**: DOM要素削除時に古い範囲が残る可能性があるが、再検索で上書きされるため実害は少ない。

**修正方法**: コメントを削除するか、実際にフラグを実装する。

---

### 4. エラーハンドリングの不足 [優先度: 低]

**ファイル**: `entrypoints/popup/main.ts` 315行目、340行目

`navigateNext` / `navigatePrev` のコールバックで `chrome.runtime.lastError` をチェックしていない。

**影響**: ナビゲーションエラーがサイレントに失敗する可能性。

**修正方法**: lastError チェックを追加（ただし非重要な操作のため優先度低）。

---

### 5. 型安全性の改善余地 [優先度: 低]

**ファイル**: `lib/messaging/handlers.ts` 72-86行目

`searchElements` の戻り値を `result` に代入後、DOM観察用の `searchFunction` 内で同じ関数を再度呼んでいるが、戻り値を使用していない。

**影響**: 動作に問題なし。コードの明確性の問題。

---

### 6. リスナー未解除 [優先度: 低]

**ファイル**: `entrypoints/content.ts`

`chrome.storage.onChanged` と `chrome.runtime.onMessage` のリスナーが登録されているが、アンロード時の解除処理がない。

**影響**: 通常のページ遷移では問題なし。SPAで複数回スクリプトが実行される場合に注意。

---

## テストコードの改善点

### T1. 統合テストでの実装ロジック重複 [優先度: 中]

**ファイル**: `tests/integration/scrollResize.test.js`

テスト内で `updateOverlayPositions` 関数を独自に実装している（122-205行目）。実際の実装（`lib/highlight/overlay.ts`）と乖離するリスクがある。

**影響**: 実装が変更されてもテストが気付かず、カバレッジの意味が薄れる。

**修正方法**: 実際のモジュールをインポートしてテストするか、モック対象を明確に絞る。

---

### T2. 未使用変数の存在 [優先度: 低]

**ファイル**: `tests/integration/scrollResize.test.js`

```javascript
const _initialTop = Number.parseInt(firstOverlay.style.top) || 0;
const _initialScrollY = window.scrollY || window.pageYOffset;
const _newTop = Number.parseInt(newOverlay.style.top) || 0;
const _initialLeft = Number.parseInt(firstOverlay.style.left) || 0;
```

`_` プレフィックスで未使用変数を示しているが、実際にアサーションで使用されていない。

**影響**: テストの意図が不明確。

**修正方法**: 不要な変数を削除するか、実際にアサーションに使用する。

---

### T3. テストヘルパーの活用不足 [優先度: 低]

**ファイル**: `tests/helpers/dom-helpers.js`

`visualizeBoundaries` 関数が定義されているが、テスト内で使用されていない。

**影響**: 軽微。デバッグ用と思われる。

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

1. **即座に修正**: #1 重複コード
2. **検討**: #3 未実装ロジックの整理（コメント削除 or 実装）
3. **将来的に検討**: その他

### テストコード

1. **検討**: T1 統合テストの実装ロジック重複を解消
2. **検討**: T4 Chrome API モックの共通化
3. **将来的に検討**: T6 テストカバレッジの拡充
