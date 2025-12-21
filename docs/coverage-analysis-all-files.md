# 全ファイルのカバレッジ分析とテスト追加の必要性

## カバレッジサマリー

- **全体カバレッジ**: 67.72% (Statements), 86.98% (Branches), 93.1% (Functions), 67.72% (Lines)
- **lib配下**: 100% (constants.ts), その他は80-100%の範囲

## 未カバー行の詳細分析

### 1. entrypoints/* (0% カバレッジ)

#### entrypoints/background.ts (1-36行)
**カバレッジ**: 0%
**テスト追加の必要性**: ❌ **不要**（統合テスト/E2Eテストでカバー）
**理由**: 
- Service Workerのエントリーポイント
- 統合テストやE2Eテストでカバーされるべき
- 単体テストではChrome Extension APIのモックが複雑

#### entrypoints/content.ts (1-109行)
**カバレッジ**: 0%
**テスト追加の必要性**: ❌ **不要**（統合テストでカバー）
**理由**: 
- Content Scriptのエントリーポイント
- 統合テストでカバーされている可能性が高い
- DOM操作とChrome APIの統合が必要

#### entrypoints/popup/main.ts (1-781行)
**カバレッジ**: 0%
**テスト追加の必要性**: ⚠️ **検討が必要**（UI操作のテスト）
**理由**: 
- ポップアップUIのロジック
- E2Eテストや統合テストでカバーすべき
- ただし、ビジネスロジック部分は単体テスト可能

#### entrypoints/settings/main.ts (1-318行)
**カバレッジ**: 0%
**テスト追加の必要性**: ⚠️ **検討が必要**（設定の保存/読み込み）
**理由**: 
- 設定ページのロジック
- chrome.storage APIの使用
- 単体テスト可能（モック使用）

---

### 2. lib/highlight/minimap.ts (121-123行)

**未カバー行**: 121-123 (エラーハンドリング)
```typescript
} catch (error) {
  // Failed to create minimap marker
  handleError(error, 'updateMinimap: Failed to create minimap marker for element', undefined);
}
```

**テスト追加の必要性**: ✅ **推奨**
**理由**: 
- エラーハンドリングのテストは重要
- 現在のテストではエラーケースが部分的にしかカバーされていない
- `range.getBoundingClientRect is not a function` エラーが発生しているが、catch節がカバーされていない

**推奨テスト**:
- `getBoundingClientRect` が存在しない場合
- `getBoundingClientRect` が例外を投げる場合

---

### 3. lib/highlight/overlay.ts (132-235, 260-261行)

**未カバー行**: 132-235, 260-261
**テスト追加の必要性**: ⚠️ **部分的に必要**
**理由**: 
- 132-235行: `createOverlay` 関数の実装部分
- 260-261行: エラーハンドリング

**推奨テスト**:
- `createOverlay` の様々なパラメータでのテスト
- エラーケースのテスト

---

### 4. lib/messaging/handlers.ts (92-193, 289-292行)

**未カバー行**: 92-193, 289-292
**テスト追加の必要性**: ✅ **推奨**
**理由**: 
- メッセージハンドラーの重要なロジック
- 92-193行: 検索処理の分岐ロジック
- 289-292行: エラーハンドリング

**推奨テスト**:
- 各検索モード（テキスト、要素、あいまい検索）のテスト
- エラーケースのテスト

---

### 5. lib/navigation/navigator.ts (15-16行)

**未カバー行**: 15-16
```typescript
if (totalMatches === 0) {
  return -1;
}
```

**テスト追加の必要性**: ✅ **推奨**
**理由**: 
- エッジケース（マッチが0件の場合）
- 簡単にテスト可能

**推奨テスト**:
- `normalizeMatchIndex(0, 0)` → `-1` を返すことを確認

---

### 6. lib/observers/domObserver.ts (141, 247-256, 286行)

**未カバー行**: 141, 247-256, 286
**テスト追加の必要性**: ⚠️ **部分的に必要**
**理由**: 
- 141行: `isRelevantNode` の特定のケース
- 247-256行: MutationObserverの特定のケース
- 286行: エラーハンドリング

**推奨テスト**:
- 特定のノードタイプでの `isRelevantNode` のテスト
- MutationObserverの特定のケースのテスト

---

### 7. lib/search/elementSearch.ts (23-125, 127-135行)

**未カバー行**: 23-125, 127-135
**テスト追加の必要性**: ✅ **推奨**
**理由**: 
- 要素検索の主要ロジック
- CSSセレクタとXPathの処理

**推奨テスト**:
- 様々なCSSセレクタのテスト
- 様々なXPathのテスト
- エラーケースのテスト

---

### 8. lib/search/fuzzySearch.ts (146-247, 258-259行)

**未カバー行**: 146-247, 258-259
**テスト追加の必要性**: ⚠️ **部分的に必要**
**理由**: 
- 146-247行: 複数キーワード検索の組み合わせ生成ロジック
- 258-259行: エラーハンドリング

**推奨テスト**:
- 複数キーワードの組み合わせ生成のテスト
- 大量のマッチがある場合のテスト

---

### 9. lib/search/resultsCollector.ts (95-200, 257-262行)

**未カバー行**: 95-200, 257-262
**テスト追加の必要性**: ✅ **推奨**
**理由**: 
- 検索結果収集の主要ロジック
- 前後文脈の処理

**推奨テスト**:
- 様々なcontextLengthでのテスト
- エッジケース（contextLengthが0、最大値など）のテスト

---

### 10. lib/search/textSearch.ts (335-437, 439-450行)

**未カバー行**: 335-437, 439-450
**テスト追加の必要性**: ⚠️ **部分的に必要**
**理由**: 
- 335-437行: `searchText` 関数の実装
- 439-450行: エラーハンドリング

**推奨テスト**:
- `searchText` の様々なパラメータでのテスト
- エラーケースのテスト

---

### 11. lib/search/virtualText.ts (127-128, 152-153行)

**未カバー行**: 127-128, 152-153
```typescript
if (virtualText.endsWith(BLOCK_BOUNDARY_MARKER)) {
  return { virtualText, charMap };
}
```

**テスト追加の必要性**: ✅ **推奨**
**理由**: 
- エッジケース（既に境界マーカーがある場合）
- 簡単にテスト可能

**推奨テスト**:
- 既に境界マーカーで終わる文字列の場合のテスト

---

### 12. lib/state/searchState.ts (106, 114行)

**未カバー行**: 106, 114
```typescript
return this.highlightData.ranges[this.currentMatchIndex] ?? null;
return this.highlightData.elements[this.currentMatchIndex] ?? null;
```

**テスト追加の必要性**: ✅ **推奨**
**理由**: 
- エッジケース（インデックスが範囲外の場合）
- `?? null` の動作確認

**推奨テスト**:
- `currentMatchIndex` が範囲外の場合のテスト

---

### 13. lib/utils/domUtils.ts (54-156, 175-195行)

**未カバー行**: 54-156, 175-195
**テスト追加の必要性**: ⚠️ **部分的に必要**
**理由**: 
- DOM操作のユーティリティ
- 特定のケースが未カバー

**推奨テスト**:
- 様々なDOM構造でのテスト
- エッジケースのテスト

---

### 14. lib/utils/errorHandler.ts (89行)

**未カバー行**: 89
```typescript
default:
  return false;
```

**テスト追加の必要性**: ✅ **推奨**
**理由**: 
- エラータイプが未知の場合の処理
- エッジケース

**推奨テスト**:
- 未知のエラータイプでのテスト

---

### 15. lib/utils/i18n.ts (1-53行)

**カバレッジ**: 0%
**テスト追加の必要性**: ✅ **推奨**
**理由**: 
- 国際化機能は重要
- 単体テスト可能

**推奨テスト**:
- `getMessage` 関数のテスト
- 様々な言語でのテスト
- プレースホルダーのテスト

---

## 優先度別の推奨事項

### 優先度: 高（テスト追加を強く推奨）✅ **完了**

1. ✅ **lib/navigation/navigator.ts (15-16行)**: エッジケース（マッチ0件） - **テスト追加済み**
2. ⚠️ **lib/search/virtualText.ts (127-128行)**: エッジケース（既に境界マーカーがある場合） - **到達不可能な可能性が高い（private関数、createNodeFilterで既にフィルタリング）**
3. ✅ **lib/state/searchState.ts (106, 114行)**: エッジケース（インデックス範囲外） - **テスト追加済み**
4. ✅ **lib/utils/errorHandler.ts (89行)**: エッジケース（未知のエラータイプ） - **テスト追加済み**
5. ✅ **lib/utils/i18n.ts (1-53行)**: 国際化機能のテスト - **テスト追加済み（0% → 100%）**

### 優先度: 中（テスト追加を推奨）

1. **lib/highlight/minimap.ts (121-123行)**: エラーハンドリング
2. **lib/messaging/handlers.ts (92-193, 289-292行)**: 検索処理の分岐ロジック
3. **lib/search/elementSearch.ts (23-125, 127-135行)**: 要素検索の主要ロジック
4. **lib/search/resultsCollector.ts (95-200, 257-262行)**: 検索結果収集の主要ロジック

### 優先度: 低（部分的にテスト追加を検討）

1. **lib/highlight/overlay.ts (132-235, 260-261行)**: 部分的にカバーされている
2. **lib/observers/domObserver.ts (141, 247-256, 286行)**: 特定のケースのみ
3. **lib/search/fuzzySearch.ts (146-247, 258-259行)**: 複雑な組み合わせロジック
4. **lib/search/textSearch.ts (335-437, 439-450行)**: 部分的にカバーされている
5. **lib/utils/domUtils.ts (54-156, 175-195行)**: 特定のケースのみ

### 優先度: 不要（統合テスト/E2Eテストでカバー）

1. **entrypoints/background.ts**: Service Workerエントリーポイント
2. **entrypoints/content.ts**: Content Scriptエントリーポイント

### 優先度: 検討が必要

1. **entrypoints/popup/main.ts**: UI操作のテスト（E2Eテスト推奨）
2. **entrypoints/settings/main.ts**: 設定の保存/読み込み（単体テスト可能）

---

## 実装完了したテスト（優先度: 高）

### 追加したテスト

1. ✅ **lib/navigation/navigator.ts**: `normalizeMatchIndex` の `totalMatches === 0` ケース（3テスト）
2. ✅ **lib/state/searchState.ts**: `getCurrentRange` と `getCurrentElement` のエッジケース（6テスト）
3. ✅ **lib/utils/errorHandler.ts**: 未知のErrorSeverityのケース（1テスト）
4. ✅ **lib/utils/i18n.ts**: 国際化機能の完全なテストスイート（12テスト）

### カバレッジ改善結果

- **navigator.ts**: 97.87% → **100%** ✅
- **searchState.ts**: 100% → **100%** ✅（維持）
- **errorHandler.ts**: 99.41% → **100%** ✅
- **i18n.ts**: 0% → **100%** ✅

### テスト数

- **追加テスト数**: 22テスト
- **全テスト通過**: ✅

## まとめ

### テスト追加が必要な行数（概算）

- **優先度: 高**: ✅ **完了**（約100行）
- **優先度: 中**: 約400行（未実装）
- **優先度: 低**: 約500行（未実装）
- **合計**: 約900行（entrypoints除く、優先度: 高は完了）

### 推奨アクション

1. ✅ **優先度: 高**のテスト - **完了**
2. **優先度: 中**のテストを段階的に追加（次のステップ）
3. **優先度: 低**のテストは必要に応じて追加
4. **entrypoints**は統合テスト/E2Eテストでカバー

### 注意事項

- **lib/search/virtualText.ts (127-128, 152-153行)**: これらの行は private 関数内のエッジケースで、実際には到達しない可能性が高い（`createNodeFilter` で既にフィルタリングされている）。テスト追加は任意。
