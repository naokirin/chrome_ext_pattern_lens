# あいまい検索の位置追跡設計

## 問題点

あいまい検索では、テキストを正規化してから検索する必要があります。しかし、正規化により文字数が変わるため、正規化後のマッチ位置を元のテキストの位置に正確に変換する必要があります。

例：
- 元のテキスト: "か゛" (2文字)
- 正規化後: "が" (1文字)
- 検索: "が" でマッチした場合、元のテキストの位置 0-2 をハイライトする必要がある

## 設計方針

### 1. 正規化マッピングの構造

正規化後の各文字位置が、元の仮想テキストのどの範囲に対応するかを記録します。

```typescript
interface NormalizationMapping {
  // 正規化後のインデックス i が元の仮想テキストの [ranges[i].start, ranges[i].end) に対応
  ranges: Array<{ start: number; end: number }>;
}
```

### 2. 正規化関数の設計

```typescript
interface NormalizationResult {
  normalizedText: string;  // 正規化後のテキスト
  mapping: NormalizationMapping;  // 位置マッピング
}

function normalizeText(originalText: string): NormalizationResult
```

正規化処理の流れ：
1. 元のテキストを1文字ずつ処理
2. 正規化ルールを適用（全角→半角、濁点結合など）
3. 正規化後の各文字が元のどの範囲に対応するかを記録

### 3. 位置変換の設計

正規化後のマッチ位置を元の仮想テキストの位置に変換します。

```typescript
function convertNormalizedMatchToOriginal(
  normalizedMatch: VirtualMatch,
  mapping: NormalizationMapping
): VirtualMatch
```

変換ロジック：
- 正規化後の start 位置 → 元の start 位置: `mapping.ranges[normalizedMatch.start].start`
- 正規化後の end 位置 → 元の end 位置: `mapping.ranges[normalizedMatch.end - 1].end`

### 4. 複数キーワード検索の設計

複数キーワード検索では、空白で区切られた複数のキーワードが一定範囲内に存在する場合にマッチし、**全キーワードを含む最小の範囲**をハイライトします。

```typescript
interface MultiKeywordMatch {
  keywords: string[];  // 検索キーワードの配列
  matches: VirtualMatch[];  // 各キーワードのマッチ位置（正規化後）
  minRange: VirtualMatch;  // 全キーワードを含む最小範囲（正規化後）
}

function findMultiKeywordMatches(
  keywords: string[],
  normalizedText: string,
  maxDistance: number  // キーワード間の最大距離
): MultiKeywordMatch[]
```

最小範囲の計算：
1. 各キーワードを正規化して検索
2. 各キーワードのマッチ位置を取得
3. 一定範囲内（`maxDistance`）に全キーワードが存在する組み合わせを探す
4. 各組み合わせについて、全キーワードを含む最小範囲を計算：
   - `minStart = min(各キーワードのマッチ開始位置)`
   - `maxEnd = max(各キーワードのマッチ終了位置)`

### 5. 検索フローの統合

既存の検索フローに正規化処理を組み込みます：

**単一キーワードの場合：**
```
1. createVirtualTextAndMap() → 仮想テキスト + CharMap
2. normalizeText(virtualText) → 正規化テキスト + 正規化マッピング
3. normalizeText(query) → 正規化クエリ
4. searchInVirtualText(normalizedQuery, normalizedText) → 正規化後のマッチ
5. convertNormalizedMatchToOriginal() → 元の仮想テキストのマッチ
6. createRangeFromVirtualMatch() → DOM Range（既存の関数を使用）
```

**複数キーワードの場合：**
```
1. createVirtualTextAndMap() → 仮想テキスト + CharMap
2. normalizeText(virtualText) → 正規化テキスト + 正規化マッピング
3. クエリを空白で分割 → キーワード配列
4. 各キーワードを正規化
5. findMultiKeywordMatches() → 各キーワードのマッチと最小範囲（正規化後）
6. convertNormalizedMatchToOriginal() → 元の仮想テキストの最小範囲
7. createRangeFromVirtualMatch() → DOM Range（既存の関数を使用）
```

## 実装の詳細

### 正規化マッピングの生成例

```typescript
// 例: "か゛" → "が"
// 元のテキスト: "か゛" (インデックス 0, 1)
// 正規化後: "が" (インデックス 0)
// マッピング: ranges[0] = { start: 0, end: 2 }

// 例: "ABC" → "abc" (大文字小文字の正規化、文字数は変わらない)
// 元のテキスト: "ABC" (インデックス 0, 1, 2)
// 正規化後: "abc" (インデックス 0, 1, 2)
// マッピング: 
//   ranges[0] = { start: 0, end: 1 }
//   ranges[1] = { start: 1, end: 2 }
//   ranges[2] = { start: 2, end: 3 }

// 例: "2024/01/01" → "2024-01-01" (スラッシュをハイフンに、文字数は変わらない)
// 元のテキスト: "2024/01/01" (インデックス 0-10)
// 正規化後: "2024-01-01" (インデックス 0-10)
// マッピング: 各文字が1対1で対応
```

### 複数文字の正規化

濁点結合など、複数文字が1文字になる場合：

```typescript
// 元のテキスト: "か゛は" (インデックス 0, 1, 2)
// 正規化後: "がは" (インデックス 0, 1)
// マッピング:
//   ranges[0] = { start: 0, end: 2 }  // "が" は元の "か゛" に対応
//   ranges[1] = { start: 2, end: 3 }  // "は" は元の "は" に対応
```

### 位置変換の実装

```typescript
function convertNormalizedMatchToOriginal(
  normalizedMatch: VirtualMatch,
  mapping: NormalizationMapping
): VirtualMatch {
  const startRange = mapping.ranges[normalizedMatch.start];
  const endRange = mapping.ranges[normalizedMatch.end - 1];
  
  return {
    start: startRange.start,
    end: endRange.end,
  };
}
```

### 複数キーワードの最小範囲計算

複数キーワード検索では、正規化後の位置で最小範囲を計算してから、元の位置に変換します。

```typescript
function calculateMinRange(
  keywordMatches: Array<{ keyword: string; matches: VirtualMatch[] }>
): VirtualMatch | null {
  // 各キーワードのマッチ位置から、全キーワードを含む最小範囲を計算
  // 一定範囲内に全キーワードが存在する組み合わせを探す
  
  // 例: キーワードAが位置[10, 20, 30]にマッチ、キーワードBが位置[15, 25]にマッチ
  // → 位置10-25の範囲が最小範囲（両方のキーワードを含む）
  
  let minStart = Infinity;
  let maxEnd = -1;
  
  // 各キーワードのマッチ位置から、重複する範囲を探す
  // （実装詳細は後述）
  
  if (minStart === Infinity || maxEnd === -1) {
    return null;  // マッチなし
  }
  
  return { start: minStart, end: maxEnd };
}

// 複数キーワードの場合の位置変換
function convertMultiKeywordMatchToOriginal(
  multiKeywordMatch: MultiKeywordMatch,
  mapping: NormalizationMapping
): VirtualMatch {
  // 正規化後の最小範囲を元の位置に変換
  return convertNormalizedMatchToOriginal(multiKeywordMatch.minRange, mapping);
}
```

## 考慮事項

### 1. ブロック境界マーカーの扱い

ブロック境界マーカー（`BLOCK_BOUNDARY_MARKER`）は正規化の対象外とします。
- マーカーはそのまま保持
- マーカーの位置はマッピングに含めない（または1対1でマッピング）

### 2. パフォーマンス

- 正規化マッピングは配列で保持（O(1)アクセス）
- 大量のテキストでも効率的に処理できるよう、文字単位の処理を最適化

### 3. 複数キーワード検索の考慮事項

- **キーワードの順序**: キーワードの出現順序は問わない（"東京 2024" と "2024 東京" は同じ）
- **重複マッチ**: 同じキーワードが複数回マッチする場合、すべての組み合わせを考慮
- **最小範囲の計算**: 全キーワードを含む最小の連続範囲を計算
- **範囲の境界**: 最小範囲は、最初のキーワードの開始位置から最後のキーワードの終了位置まで

例：
- テキスト: "2024年東京オリンピック"
- クエリ: "東京 2024"
- 正規化後テキスト: "2024年東京オリンピック"
- 正規化後クエリ: ["東京", "2024"]
- マッチ: "東京"が位置4-6、"2024"が位置0-4
- 最小範囲: 位置0-6（"2024年東京"）

### 4. エッジケース

- 空文字列の処理
- 正規化後の文字列が空になる場合
- マッチが境界マーカーを含む場合
- 複数キーワードで一部のキーワードがマッチしない場合（マッチなし）
- 複数キーワードが境界マーカーをまたぐ場合（マッチなし）

## 実装順序

1. 型定義の追加（`NormalizationMapping`, `NormalizationResult`, `MultiKeywordMatch`）
2. 正規化関数の実装（基本的な正規化ルール）
3. 位置変換関数の実装（単一キーワード用）
4. 複数キーワード検索の実装
   - キーワード分割と正規化
   - 各キーワードのマッチ検索
   - 最小範囲の計算
   - 位置変換（複数キーワード用）
5. 検索フローへの統合（単一/複数の分岐処理）
6. テストの作成

## 複数キーワード検索の実装要件

### 必須要件
- 空白で区切られた複数のキーワードを検索
- 各キーワードを正規化して検索
- 一定範囲内（設定可能）に全キーワードが存在する場合にマッチ
- **全キーワードを含む最小の範囲をハイライト**

### 実装時の注意点
- 最小範囲は、最初のキーワードの開始位置から最後のキーワードの終了位置まで
- キーワードの出現順序は問わない
- 同じキーワードが複数回マッチする場合は、すべての組み合わせを考慮
- 境界マーカーをまたぐ範囲はマッチしない
