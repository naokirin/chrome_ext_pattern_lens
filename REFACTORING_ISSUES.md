# リファクタリング必要箇所の洗い出し

## 1. グローバル状態管理の問題 ✅ 完了

### 問題点
- `entrypoints/content.ts`にグローバル変数が多数存在
  - `highlightData`: ハイライト状態を保持
  - `currentMatchIndex`: 現在のマッチインデックス
  - `lastSearchState`: 最後の検索状態
- モジュール間での状態共有が困難
- テストが困難（グローバル状態に依存）
- 複数のcontent scriptインスタンスが存在する場合の状態管理が不明確

### 影響範囲
- `entrypoints/content.ts`全体（786行）

### 実施した改善
- ✅ `lib/state/searchState.ts`に`SearchStateManager`クラスを作成
- ✅ グローバル変数をすべて`SearchStateManager`インスタンスに置き換え
- ✅ 状態の初期化・リセットを明確化（`clear()`メソッド）
- ✅ 状態へのアクセスをメソッド経由に統一（カプセル化）
- ✅ 29箇所のグローバル変数参照を`stateManager`メソッド呼び出しに置き換え

### 変更ファイル
- `lib/state/searchState.ts` (新規作成)
- `entrypoints/content.ts` (リファクタリング)

---

## 2. イベントリスナーの重複登録リスク

### 問題点
- `searchText()`と`searchElements()`で`scroll`/`resize`イベントリスナーを毎回登録
- `clearHighlights()`で削除しているが、複数回検索すると重複登録される可能性
- 現在は`clearHighlights()`が先に呼ばれるため問題は起きていないが、将来的にリスク

### 該当箇所
```typescript
// entrypoints/content.ts:615-616
window.addEventListener('scroll', updateOverlayPositions, { passive: true });
window.addEventListener('resize', updateOverlayPositions, { passive: true });

// entrypoints/content.ts:680-681
window.addEventListener('scroll', updateOverlayPositions, { passive: true });
window.addEventListener('resize', updateOverlayPositions, { passive: true });
```

### 推奨改善
- イベントリスナーの登録状態を追跡
- 登録前に既存リスナーの存在を確認
- または、イベントリスナー管理を専用の関数/クラスに分離

---

## 3. 巨大なファイル（単一責任の原則違反）

### 問題点
- `entrypoints/content.ts`が786行と非常に長い
- 以下の責務が混在：
  - DOM操作（オーバーレイ作成・管理）
  - テキスト検索ロジック
  - 要素検索ロジック
  - ナビゲーション管理
  - ミニマップ管理
  - メッセージハンドリング
  - 仮想テキスト生成

### 推奨改善
- 機能ごとにモジュール分割：
  - `lib/highlight/overlay.ts`: オーバーレイ管理
  - `lib/highlight/minimap.ts`: ミニマップ管理
  - `lib/search/textSearch.ts`: テキスト検索
  - `lib/search/elementSearch.ts`: 要素検索
  - `lib/search/virtualText.ts`: 仮想テキスト生成
  - `lib/navigation/navigator.ts`: ナビゲーション管理
  - `lib/state/searchState.ts`: 検索状態管理

---

## 4. 重複コード

### 4.1 特殊ページチェックの重複

#### 問題点
- `popup/main.ts`で3箇所に同じチェックロジックが存在
```typescript
if (
  tab.url?.startsWith('chrome://') ||
  tab.url?.startsWith('chrome-extension://') ||
  tab.url?.startsWith('https://chrome.google.com/webstore')
) {
  // エラーハンドリング
}
```

#### 該当箇所
- `entrypoints/popup/main.ts:127-133`
- `entrypoints/popup/main.ts:194-200`
- `entrypoints/popup/main.ts:386-391`

#### 推奨改善
- `lib/utils/tabUtils.ts`に共通関数を抽出
```typescript
export function isSpecialPage(url: string | undefined): boolean {
  return (
    url?.startsWith('chrome://') ||
    url?.startsWith('chrome-extension://') ||
    url?.startsWith('https://chrome.google.com/webstore')
  ) ?? false;
}
```

### 4.2 タブ取得ロジックの重複

#### 問題点
- `popup/main.ts`で5箇所に同じタブ取得ロジックが存在
```typescript
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
if (!tab.id) {
  // エラーハンドリング
}
```

#### 該当箇所
- `entrypoints/popup/main.ts:118-123`
- `entrypoints/popup/main.ts:185-190`
- `entrypoints/popup/main.ts:225-229`
- `entrypoints/popup/main.ts:249-253`
- `entrypoints/popup/main.ts:378-382`

#### 推奨改善
- `lib/utils/tabUtils.ts`に共通関数を抽出
```typescript
export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ? tab : null;
}
```

---

## 5. 型安全性の問題

### 問題点
- DOM要素取得時に`as`キャストを多用
- `null`チェックが不十分な箇所がある
- 実行時エラーのリスク

#### 該当例
```typescript
// entrypoints/popup/main.ts:14-27
const searchInput = document.getElementById('searchInput') as HTMLInputElement;
// nullチェックなし

// entrypoints/content.ts:44
let container = document.getElementById(HIGHLIGHT_OVERLAY_ID) as HTMLDivElement;
// nullチェックは後で行っているが、型安全性が低い
```

### 推奨改善
- ヘルパー関数で安全に要素を取得
- 早期リターンでnullチェックを明確化
- オプショナルチェーンを活用

---

## 6. エラーハンドリングの一貫性の欠如

### 問題点
- 一部のエラーは無視（`catch (_error) { /* silently ignore */ }`）
- 一部のエラーはエラーメッセージを返す
- エラーハンドリングのパターンが統一されていない

#### 該当例
```typescript
// エラーを無視
catch (_error) {
  // Failed to scroll to match, silently ignore
}

// エラーメッセージを返す
catch (error) {
  const err = error as Error;
  sendResponse({ success: false, error: err.message } as SearchResponse);
}
```

### 推奨改善
- エラーハンドリングの戦略を統一
- エラーログの記録（開発時）
- ユーザー向けエラーメッセージの統一

---

## 7. 定数・マジックナンバーの管理

### 問題点
- マジックナンバーが散在
- 文字列リテラルが直接使用されている箇所がある

#### 該当例
```typescript
// entrypoints/content.ts:75
const padding = 2;
const borderWidth = 1;

// entrypoints/popup/main.ts:300
}, 300); // 300ms delay
```

### 推奨改善
- 定数を`lib/constants.ts`に集約
- 意味のある名前を付与

---

## 8. 関数の責務が大きすぎる

### 問題点
- 一部の関数が複数の責務を持っている

#### 該当例
- `searchText()`: 仮想テキスト生成、検索、オーバーレイ作成、イベントリスナー登録をすべて実行
- `navigateToMatch()`: インデックス正規化、オーバーレイ更新、ミニマップ更新、スクロールをすべて実行

### 推奨改善
- 関数を小さな単位に分割
- 単一責任の原則に従う

---

## 9. テストしにくい設計

### 問題点
- グローバル状態に依存
- 関数が密結合
- DOM操作が直接実装されている

### 推奨改善
- 依存性注入の導入
- インターフェースの定義
- モック可能な設計

---

## 10. メッセージハンドリングの複雑さ

### 問題点
- `content.ts`のメッセージハンドラーが巨大なif-elseチェーン
- 新しいアクション追加時に拡張性が低い

#### 該当箇所
```typescript
// entrypoints/content.ts:705-780
if (request.action === 'search') {
  // ...
} else if (request.action === 'clear') {
  // ...
} else if (request.action === 'navigate-next') {
  // ...
} else if (request.action === 'navigate-prev') {
  // ...
} else if (request.action === 'get-state') {
  // ...
}
```

### 推奨改善
- アクションごとにハンドラーを分離
- ハンドラーマップを使用
- 型安全なルーティング

---

## 11. 仮想テキスト生成の複雑さ

### 問題点
- `createVirtualTextAndMap()`が複雑なロジックを含む
- ブロック境界マーカーの処理が理解しにくい
- 正規表現での特殊文字処理が複雑

#### 該当箇所
- `entrypoints/content.ts:348-411` (createVirtualTextAndMap)
- `entrypoints/content.ts:414-484` (searchInVirtualText)

### 推奨改善
- 仮想テキスト生成ロジックを別モジュールに分離
- ブロック境界処理を明確化
- 正規表現処理のロジックを分離

---

## 12. オーバーレイ位置更新の非効率性

### 問題点
- `updateOverlayPositions()`がすべてのオーバーレイを再作成
- スクロール/リサイズのたびに全DOM操作が発生

#### 該当箇所
- `entrypoints/content.ts:98-130`

### 推奨改善
- 差分更新の検討
- デバウンス/スロットルの導入
- パフォーマンス最適化

---

## 優先度の高い改善項目

### 高優先度
1. **イベントリスナーの重複登録リスク** (#2)
   - バグのリスクが高い
2. **重複コードの削減** (#4)
   - 保守性の向上
3. **型安全性の向上** (#5)
   - 実行時エラーの防止

### 中優先度
4. **巨大ファイルの分割** (#3)
   - 可読性・保守性の向上
5. **グローバル状態管理の改善** (#1)
   - テスト容易性の向上
6. **エラーハンドリングの統一** (#6)
   - 一貫性の向上

### 低優先度
7. **定数の集約** (#7)
   - コード品質の向上
8. **メッセージハンドリングの改善** (#10)
   - 拡張性の向上
9. **パフォーマンス最適化** (#12)
   - ユーザー体験の向上

---

## リファクタリング時の注意点

1. **既存のテストを壊さない**
   - リファクタリング前にテストを実行
   - 段階的にリファクタリング

2. **機能の動作を維持**
   - リファクタリング後も同じ動作を保証

3. **型安全性の向上**
   - `as`キャストの削減
   - より厳密な型定義

4. **ドキュメントの更新**
   - 新しいモジュール構造の説明
   - APIの変更点の記録
