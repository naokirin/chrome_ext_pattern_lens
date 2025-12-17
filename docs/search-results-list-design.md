# 検索結果一覧表示機能 設計計画

## 概要

検索で見つかったすべてのマッチを一覧表示し、各結果の前後文脈を表示する機能を追加します。ユーザーは一覧から選択した結果の位置に直接ジャンプできます。

## 要件

1. **一覧表示**: 検索結果をリスト形式で表示
2. **前後文脈表示**: 各検索結果の前後の文字列も表示（設定可能な文字数）
3. **ジャンプ機能**: 一覧から選択した結果の位置にページをスクロール
4. **要素検索との互換性**: 要素検索モードがONの場合は強制的にOFF（要素検索と検索結果一覧は同時に使用不可）

## アーキテクチャ設計

### 1. データ構造

#### 1.1 検索結果アイテムの型定義

```typescript
// lib/types.ts に追加
export interface SearchResultItem {
  index: number;           // マッチのインデックス（0始まり）
  matchedText: string;     // マッチしたテキスト
  contextBefore: string;   // 前の文脈（設定可能な文字数）
  contextAfter: string;    // 後の文脈（設定可能な文字数）
  fullText: string;        // 前後文脈を含む完全なテキスト（表示用）
}

export interface SearchResultsListResponse {
  success: boolean;
  items?: SearchResultItem[];
  totalMatches?: number;
  error?: string;
}
```

#### 1.2 メッセージ型の拡張

```typescript
// lib/types.ts に追加
export interface SearchMessage {
  action: 'search';
  query: string;
  useRegex: boolean;
  caseSensitive: boolean;
  useElementSearch: boolean;
  elementSearchMode: 'css' | 'xpath';
  useFuzzy: boolean;
  showResultsList?: boolean;  // 新規追加：検索結果一覧を表示するか
}

export interface GetResultsListMessage {
  action: 'get-results-list';
  contextLength?: number;  // 前後文脈の文字数（デフォルト値は定数で定義）
}

export interface JumpToMatchMessage {
  action: 'jump-to-match';
  index: number;  // ジャンプ先のマッチインデックス
}
```

### 2. Content Script側の実装

#### 2.1 検索結果情報の収集

**ファイル**: `lib/search/textSearch.ts` または新規ファイル `lib/search/resultsCollector.ts`

```typescript
/**
 * テキスト検索結果の情報を収集
 * @param ranges 検索で見つかったRangeの配列
 * @param contextLength 前後文脈の文字数
 * @returns 検索結果アイテムの配列
 */
export function collectTextSearchResults(
  ranges: Range[],
  contextLength: number
): SearchResultItem[] {
  // 各Rangeからテキストと前後文脈を抽出
  // - Rangeからテキストを取得
  // - 前後のテキストノードから文脈を取得
  // - contextLengthに基づいて文脈を切り詰め
}
```

**実装の詳細**:
- `Range`から`matchedText`を取得（`range.toString()`）
- `range.startContainer`と`range.endContainer`から前後のテキストノードを取得
- 前後のテキストを`contextLength`文字まで取得（改行やタグは考慮）
- 文脈が長すぎる場合は`...`で省略表示

#### 2.2 要素検索結果の収集

**ファイル**: `lib/search/elementSearch.ts` に追加

```typescript
/**
 * 要素検索結果の情報を収集
 * @param elements 検索で見つかったElementの配列
 * @param contextLength 前後文脈の文字数（要素検索では使用しない可能性あり）
 * @returns 検索結果アイテムの配列
 */
export function collectElementSearchResults(
  elements: Element[],
  contextLength: number
): SearchResultItem[] {
  // 各Elementからテキストを抽出
  // 要素検索の場合は、要素のテキスト内容やセレクタ情報を表示
}
```

#### 2.3 メッセージハンドラーの追加

**ファイル**: `lib/messaging/handlers.ts`

```typescript
/**
 * 検索結果一覧を取得
 */
export async function handleGetResultsList(
  message: GetResultsListMessage,
  context: MessageHandlerContext
): Promise<SearchResultsListResponse> {
  const contextLength = message.contextLength ?? DEFAULT_CONTEXT_LENGTH;
  
  if (context.stateManager.hasTextMatches()) {
    const items = collectTextSearchResults(
      context.stateManager.ranges,
      contextLength
    );
    return {
      success: true,
      items,
      totalMatches: context.stateManager.totalMatches,
    };
  } else if (context.stateManager.hasElementMatches()) {
    const items = collectElementSearchResults(
      context.stateManager.elements,
      contextLength
    );
    return {
      success: true,
      items,
      totalMatches: context.stateManager.totalMatches,
    };
  }
  
  return {
    success: true,
    items: [],
    totalMatches: 0,
  };
}

/**
 * 指定されたインデックスのマッチにジャンプ
 */
export function handleJumpToMatch(
  message: JumpToMatchMessage,
  context: MessageHandlerContext
): SearchResponse {
  const result = navigateToMatch(message.index, context.stateManager);
  return {
    success: true,
    currentIndex: result.currentIndex,
    totalMatches: result.totalMatches,
  };
}
```

#### 2.4 検索処理の修正

**ファイル**: `lib/messaging/handlers.ts` の `handleSearch`

- `SearchMessage`に`showResultsList`フラグが含まれている場合、検索後に結果一覧を自動的に収集
- ただし、一覧データは明示的に要求された場合のみ送信（パフォーマンス考慮）

### 3. Popup側の実装

#### 3.1 UI構造の追加

**ファイル**: `entrypoints/popup/index.html`

```html
<!-- 検索結果一覧表示のチェックボックス -->
<div class="options-row">
  <label id="resultsListLabel">
    <input type="checkbox" id="resultsListMode">
    検索結果一覧
  </label>
</div>

<!-- 検索結果一覧コンテナ -->
<div class="results-list" id="resultsList" style="display: none;">
  <div class="results-list-header">
    <span class="results-list-title">検索結果一覧</span>
    <span class="results-list-count" id="resultsListCount">0件</span>
  </div>
  <div class="results-list-items" id="resultsListItems">
    <!-- 動的に生成される検索結果アイテム -->
  </div>
</div>
```

#### 3.2 スタイルの追加

**ファイル**: `entrypoints/popup/index.html` の `<style>` セクション

```css
.results-list {
  margin-top: 15px;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #fff;
}

.results-list-header {
  padding: 10px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 1;
}

.results-list-title {
  font-weight: 500;
  font-size: 14px;
}

.results-list-count {
  font-size: 12px;
  color: #666;
}

.results-list-items {
  padding: 5px;
}

.results-list-item {
  padding: 8px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.results-list-item:hover {
  background-color: #f9f9f9;
}

.results-list-item.current {
  background-color: #fff3cd;
  border-left: 3px solid #ffc107;
}

.results-list-item-index {
  font-size: 11px;
  color: #666;
  margin-bottom: 4px;
}

.results-list-item-text {
  font-size: 13px;
  line-height: 1.4;
  color: #333;
}

.results-list-item-matched {
  background-color: #fff9c4;
  font-weight: 500;
  padding: 0 2px;
}
```

#### 3.3 ロジックの実装

**ファイル**: `entrypoints/popup/main.ts`

```typescript
// DOM要素の取得
const resultsListMode = getRequiredElementById<HTMLInputElement>('resultsListMode');
const resultsListLabel = getRequiredElementById<HTMLLabelElement>('resultsListLabel');
const resultsList = getRequiredElementById<HTMLDivElement>('resultsList');
const resultsListCount = getRequiredElementById<HTMLSpanElement>('resultsListCount');
const resultsListItems = getRequiredElementById<HTMLDivElement>('resultsListItems');

// 設定から前後文脈の文字数を読み込み（デフォルト: 30文字）
let contextLength = 30;

/**
 * 検索結果一覧を取得して表示
 */
async function fetchAndDisplayResultsList(): Promise<void> {
  if (!resultsListMode.checked) {
    resultsList.style.display = 'none';
    return;
  }

  try {
    const tab = await getActiveTab();
    if (!tab || isSpecialPage(tab.url)) {
      return;
    }

    const message: GetResultsListMessage = {
      action: 'get-results-list',
      contextLength,
    };

    chrome.tabs.sendMessage(
      tab.id,
      message,
      (response: SearchResultsListResponse | undefined) => {
        if (chrome.runtime.lastError || !response?.success) {
          return;
        }

        displayResultsList(response.items || [], response.totalMatches || 0);
      }
    );
  } catch (error) {
    handleError(error, 'fetchAndDisplayResultsList: Exception', undefined);
  }
}

/**
 * 検索結果一覧を表示
 */
function displayResultsList(
  items: SearchResultItem[],
  totalMatches: number
): void {
  resultsListCount.textContent = `${totalMatches}件`;
  resultsListItems.innerHTML = '';

  if (items.length === 0) {
    resultsList.style.display = 'none';
    return;
  }

  resultsList.style.display = 'block';

  items.forEach((item) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'results-list-item';
    itemElement.dataset.index = item.index.toString();

    // インデックス表示
    const indexElement = document.createElement('div');
    indexElement.className = 'results-list-item-index';
    indexElement.textContent = `#${item.index + 1}`;
    itemElement.appendChild(indexElement);

    // テキスト表示（マッチ部分をハイライト）
    const textElement = document.createElement('div');
    textElement.className = 'results-list-item-text';
    
    // 前文脈 + マッチ + 後文脈を構築
    const beforeSpan = document.createElement('span');
    beforeSpan.textContent = item.contextBefore;
    
    const matchedSpan = document.createElement('span');
    matchedSpan.className = 'results-list-item-matched';
    matchedSpan.textContent = item.matchedText;
    
    const afterSpan = document.createElement('span');
    afterSpan.textContent = item.contextAfter;
    
    textElement.appendChild(beforeSpan);
    textElement.appendChild(matchedSpan);
    textElement.appendChild(afterSpan);
    
    itemElement.appendChild(textElement);

    // クリックイベント: 該当位置にジャンプ
    itemElement.addEventListener('click', () => {
      jumpToMatch(item.index);
    });

    resultsListItems.appendChild(itemElement);
  });
}

/**
 * 指定されたインデックスのマッチにジャンプ
 */
async function jumpToMatch(index: number): Promise<void> {
  try {
    const tab = await getActiveTab();
    if (!tab || isSpecialPage(tab.url)) {
      return;
    }

    const message: JumpToMatchMessage = {
      action: 'jump-to-match',
      index,
    };

    chrome.tabs.sendMessage(
      tab.id,
      message,
      (response: SearchResponse | undefined) => {
        if (response?.success) {
          // ナビゲーションUIを更新
          if (response.totalMatches !== undefined && response.currentIndex !== undefined) {
            updateNavigation(response.currentIndex, response.totalMatches);
          }
          // 一覧の現在のマッチをハイライト
          updateResultsListHighlight(response.currentIndex ?? -1);
          // 一覧を再取得（現在のマッチを強調表示するため）
          fetchAndDisplayResultsList();
        }
      }
    );
  } catch (error) {
    handleError(error, 'jumpToMatch: Exception', undefined);
  }
}

/**
 * 検索結果一覧の現在のマッチをハイライト
 */
function updateResultsListHighlight(currentIndex: number): void {
  const items = resultsListItems.querySelectorAll('.results-list-item');
  items.forEach((item, index) => {
    if (index === currentIndex) {
      item.classList.add('current');
    } else {
      item.classList.remove('current');
    }
  });
}

// 検索結果一覧モードの変更時
resultsListMode.addEventListener('change', () => {
  updateSearchModeVisibility();
  if (resultsListMode.checked) {
    fetchAndDisplayResultsList();
  } else {
    resultsList.style.display = 'none';
  }
});

// 検索実行後に一覧を更新
// performSearch() の成功時に fetchAndDisplayResultsList() を呼び出す
```

#### 3.4 要素検索との互換性

**ファイル**: `entrypoints/popup/main.ts` の `updateSearchModeVisibility()`

```typescript
function updateSearchModeVisibility(): void {
  const isElementMode = elementMode.checked;
  const isFuzzyMode = fuzzyMode.checked && !elementMode.checked;
  const isResultsListMode = resultsListMode.checked;

  // 要素検索がONの場合は検索結果一覧を強制的にOFF
  if (isElementMode) {
    resultsListMode.checked = false;
    resultsListMode.disabled = true;
    resultsListLabel.classList.add('disabled');
    resultsList.style.display = 'none';
  } else {
    resultsListMode.disabled = false;
    resultsListLabel.classList.remove('disabled');
  }

  // 既存のロジック...
}
```

### 4. 設定の追加

#### 4.1 前後文脈の文字数設定

**ファイル**: `entrypoints/options/index.html` と `entrypoints/options/main.ts`

- オプションページに「前後文脈の文字数」設定を追加
- デフォルト値: 30文字
- 範囲: 10〜100文字

#### 4.2 デフォルト設定

**ファイル**: `lib/constants.ts`

```typescript
/** 検索結果一覧の前後文脈のデフォルト文字数 */
export const DEFAULT_RESULTS_LIST_CONTEXT_LENGTH = 30;

/** 検索結果一覧の前後文脈の最小文字数 */
export const MIN_RESULTS_LIST_CONTEXT_LENGTH = 10;

/** 検索結果一覧の前後文脈の最大文字数 */
export const MAX_RESULTS_LIST_CONTEXT_LENGTH = 100;
```

### 5. 型定義の更新

**ファイル**: `lib/types.ts`

- `SearchResultItem` インターフェースを追加
- `SearchResultsListResponse` インターフェースを追加
- `GetResultsListMessage` インターフェースを追加
- `JumpToMatchMessage` インターフェースを追加
- `SearchMessage` に `showResultsList?: boolean` を追加
- `Message` 型に新しいメッセージ型を追加

### 6. メッセージルーターの更新

**ファイル**: `lib/messaging/router.ts`

```typescript
export async function routeMessage(
  message: Message,
  context: MessageHandlerContext
): Promise<Response> {
  switch (message.action) {
    case 'search':
      return handleSearch(message, context);
    case 'clear':
      return handleClear(message, context);
    case 'navigate-next':
      return handleNavigateNext(message, context);
    case 'navigate-prev':
      return handleNavigatePrev(message, context);
    case 'get-state':
      return handleGetState(message, context);
    case 'get-results-list':  // 新規追加
      return handleGetResultsList(message, context);
    case 'jump-to-match':  // 新規追加
      return handleJumpToMatch(message, context);
    default:
      return { success: false, error: 'Unknown action' };
  }
}
```

## 実装の優先順位

1. **Phase 1: 基本機能**
   - 型定義の追加
   - テキスト検索結果の収集機能
   - メッセージハンドラーの追加
   - Popup UIの基本構造

2. **Phase 2: UI実装**
   - 検索結果一覧の表示
   - ジャンプ機能
   - 現在のマッチのハイライト

3. **Phase 3: 設定と最適化**
   - 前後文脈の文字数設定
   - パフォーマンス最適化
   - 要素検索との互換性処理

4. **Phase 4: テストとドキュメント**
   - ユニットテスト
   - 統合テスト
   - ドキュメント更新

## 技術的な考慮事項

### パフォーマンス

- 大量の検索結果がある場合、一覧表示は遅延読み込みを検討
- 前後文脈の取得は必要最小限のDOM操作に留める
- 検索結果一覧は明示的に要求された場合のみ収集・送信

### メモリ使用量

- 検索結果一覧のデータは必要に応じてのみ保持
- 大量の結果がある場合は、表示する項目数を制限する可能性を検討

### ユーザビリティ

- 一覧のスクロール位置を保持
- 現在のマッチが常に視認できるように自動スクロール
- キーボードショートカット（一覧内の移動）は将来の拡張として検討

## 既存機能との統合

- 検索結果一覧は既存のナビゲーション機能（前へ/次へボタン）と連携
- 一覧からジャンプした際も、ナビゲーションUIのカウンターが更新される
- 検索をクリアした際は、一覧も非表示になる
