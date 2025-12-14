# テスト環境整備ガイド

## 概要

このドキュメントでは、Pattern Lens Chrome拡張機能のテスト環境を整備するための方針と手順を説明します。

## 最新の実装: オーバーレイ方式のハイライト

現在の実装では、DOM構造を変更せずにハイライトを実現するオーバーレイ方式を採用しています。

### オーバーレイ方式の特徴

1. **Range API使用**: テキスト検索では`document.createRange()`と`getClientRects()`を使用
2. **要素の矩形取得**: DOM要素検索では`element.getClientRects()`を使用
3. **絶対配置のオーバーレイ**: 矩形情報を元に`position: absolute`のdiv要素を配置
4. **DOMを変更しない**: 元のDOM構造やスタイルを一切変更しない
5. **スクロール/リサイズ対応**: イベントリスナーで位置を自動更新

### 実装の詳細

- オーバーレイコンテナID: `pattern-lens-overlay-container`
- オーバーレイクラス: `pattern-lens-highlight-overlay`
- z-index: 2147483647（最前面に表示）
- pointer-events: none（クリックを透過）

## テスト戦略

### テストの種類

1. **ユニットテスト**
   - 各関数のロジックを個別にテスト
   - DOM操作から独立した純粋な関数を優先的にテスト
   - 対象: `content_scripts/main.js`の各関数（詳細は後述）

2. **統合テスト**
   - 複数のコンポーネント（Popup, Content Script）やChrome APIが連携するユーザー操作フローをテスト
   - 対象: `popup/popup.js`, `options/options.js`との連携（詳細は後述）

3. **E2Eテスト（将来の拡張）**
   - 実際のブラウザ環境での動作確認
   - Puppeteer/Playwrightを使用
   - `test-cross-element.html`を使った視覚的な確認（スクリーンショットテストなど）

## テストフレームワークの選択

### 推奨: Vitest

**理由:**
- モダンで高速（Viteベース）
- Jest互換のAPI（移行が容易）
- 設定がシンプル
- TypeScriptサポートが優れている
- ホットリロード対応

**代替案: Jest**
- より広く使われており、情報が多い
- 安定性が高い
- 大規模プロジェクトで実績がある

## 必要なパッケージ

### Vitestを使用する場合

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0",
    "jsdom": "^23.0.0"
  }
}
```

### Jestを使用する場合

```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0"
  }
}
```

## 環境整備の手順

### 1. package.jsonの作成

プロジェクトルートに`package.json`を作成し、必要な依存関係を定義します。

### 2. テスト設定ファイルの作成

#### Vitestの場合: `vitest.config.js`
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
  },
});
```

#### Jestの場合: `jest.config.js`
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
};
```

### 3. Chrome APIモックの作成

`tests/setup.js`でChrome APIをモックします。

#### Vitestの場合
```javascript
import { vi } from 'vitest';

global.chrome = {
  storage: {
    sync: {
      get: vi.fn((keys, callback) => {
        callback({ defaultRegex: false, defaultElementSearch: false });
      }),
      set: vi.fn((items, callback) => {
        if (callback) callback();
      }),
    },
  },
  tabs: {
    query: vi.fn((queryInfo, callback) => {
      callback([{ id: 1, url: 'https://example.com' }]);
    }),
    sendMessage: vi.fn((tabId, message, callback) => {
      if (callback) callback({ success: true, count: 0 });
    }),
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(),
    },
    lastError: null,
  },
  scripting: {
    executeScript: vi.fn(() => Promise.resolve()),
  },
};
```

#### Jestの場合
```javascript
global.chrome = {
  storage: {
    sync: {
      get: jest.fn((keys, callback) => {
        callback({ defaultRegex: false, defaultElementSearch: false });
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
      }),
    },
  },
  tabs: {
    query: jest.fn((queryInfo, callback) => {
      callback([{ id: 1, url: 'https://example.com' }]);
    }),
    sendMessage: jest.fn((tabId, message, callback) => {
      if (callback) callback({ success: true, count: 0 });
    }),
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    lastError: null,
  },
  scripting: {
    executeScript: jest.fn(() => Promise.resolve()),
  },
};
```

### 4. テストディレクトリ構造

```
chrome_ext_pattern_lens/
├── tests/
│   ├── setup.js              # テスト環境のセットアップ
│   ├── unit/                  # ユニットテスト
│   │   ├── content_scripts/
│   │   │   └── main.test.js
│   │   └── utils/
│   ├── integration/           # 統合テスト
│   │   ├── popup.test.js
│   │   └── options.test.js
│   └── helpers/               # テストヘルパー
│       └── dom-helpers.js
├── package.json
├── vitest.config.js (または jest.config.js)
└── ...
```

### 5. package.jsonのスクリプト追加

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

## テスト対象の優先順位

### ユニットテスト対象 (content_scripts/main.js)

| 優先度 | 関数名 | テスト内容 |
| :--- | :--- | :--- |
| **高** | `createVirtualTextAndMap` | - 異なるDOM構造（ネスト、インライン、ブロック）から正しい仮想テキストが生成されるか<br>- ブロック要素間に `BLOCK_BOUNDARY_MARKER` (\uE000) が正しく挿入されるか<br>- `charMap` が文字とDOMノードを正確に対応付けできているか<br>- `test-cross-element.html` の各ケースに対応 |
| **高** | `searchInVirtualText` | - 通常検索、正規表現検索が正しくマッチするか<br>- 大文字/小文字の区別が機能するか<br>- `BLOCK_BOUNDARY_MARKER` をまたぐ検索を正しく除外できるか<br>- 特殊文字の処理が正しいか |
| **高** | `mergeAdjacentRects` | - 複数行にまたがるテキストの矩形（`ClientRects`）を正しくマージできるか<br>- 隣接していない矩形はマージされないことを確認<br>- tolerance パラメータの動作 |
| **中** | `createRangeFromVirtualMatch` | - `searchInVirtualText` の結果と `charMap` を使って正しいDOM `Range` オブジェクトを生成できるか<br>- ブロック境界マーカーのスキップ処理が正しいか |
| **中** | `isBlockLevel` | - 様々な要素（`div`, `p`, `span`, `strong`など）がブロックレベルかインラインレベルか正しく判定できるか<br>- CSSの`display`プロパティを考慮した判定 |
| **中** | `getNearestBlockAncestor` | - 任意のノードから最も近いブロックレベルの祖先要素を正しく取得できるか |
| **中** | `navigateToMatch` | - テキスト検索と要素検索の両方で正しくナビゲーションできるか<br>- インデックスの正規化（ラップアラウンド）が正しいか<br>- 返り値（currentIndex, totalMatches）が正しいか |
| **低** | `createOverlay` | - スタイルが正しく適用されるか（スナップショットテスト）<br>- padding と border の計算が正しいか |
| **低** | `applyMinimapStyles` | - スクロールバー幅を考慮した位置計算が正しいか |

### 統合テスト対象

| 優先度 | ワークフロー | テストシナリオ |
| :--- | :--- | :--- |
| **高** | **テキスト検索とハイライト表示** | 1. Popupでキーワードを入力し、検索を実行<br>2. `main.js`がメッセージを受け取り、検索とハイライト（オーバーレイ）を行う<br>3. Popupに正しい件数が表示される |
| **高** | **要素境界をまたぐ検索** | 1. `test-cross-element.html` のようなページで検索を実行<br>2. `<span>`や`<p>`をまたぐキーワード（例: "ipsum dolor", "mkdir-p"）が正しくハイライトされることを確認 |
| **高** | **検索結果のナビゲーション** | 1. Popupの「次へ」「前へ」ボタン、または `Enter`/`Shift+Enter` を押す<br>2. `navigateToMatch` が呼び出され、ハイライトとページスクロールが正しく連動することを確認<br>3. 現在のマッチがオレンジ色でハイライトされる |
| **中** | **CSS/XPathセレクタ検索** | 1. Popupで要素検索モードに切り替え、セレクタを入力<br>2. `searchElements` が実行され、一致する要素がハイライトされることを確認<br>3. 不正なセレクタのエラーハンドリング |
| **中** | **ミニマップとの連携** | 1. 検索実行後、ミニマップにハイライト位置が正しく表示されるか<br>2. ナビゲーション時に、ミニマップ上のアクティブなマーカーが更新されるか<br>3. 検索結果が0件の場合、ミニマップが非表示になるか |
| **中** | **スクロール/リサイズ時の追従** | 1. ページをスクロールまたはウィンドウサイズを変更<br>2. `updateOverlayPositions` が呼ばれ、オーバーレイの位置が正しく更新されることを確認 |
| **低** | **設定の永続化** | 1. Optionsページでデフォルト設定を変更し保存<br>2. Popupを開いた際に、変更した設定が反映されていることを確認 |
| **低** | **検索状態の復元** | 1. 検索を実行後、Popupを閉じる<br>2. Popupを再度開いた際に、前回の検索状態（キーワード、マッチ件数、現在位置）が復元されるか |

### 新たに追加されたテスト対象（現在の実装に基づく）

#### ユニットテスト
- **`createVirtualTextAndMap`**: 要素境界をまたぐ検索機能の中核となる関数。`test-cross-element.html` の各ケースをDOM入力として与え、期待される仮想テキストが出力されるか検証。
- **`searchInVirtualText`**: `BLOCK_BOUNDARY_MARKER` を含むテキストで、境界をまたがない検索パターンが正しくマッチすることを確認。

#### 統合テスト
- **スクロール/リサイズ時の追従**: ページをスクロールまたはウィンドウサイズを変更した際に、`updateOverlayPositions` が呼ばれ、オーバーレイの位置が正しく更新されることをテスト。
- **ミニマップの表示**: 検索結果に応じてミニマップが表示・非表示され、マーカーの位置が正しいかを確認。

#### E2Eテスト（将来的に）
- **`test-cross-element.html` を使ったE2Eテスト**: PuppeteerやPlaywrightを導入し、実際のブラウザで `test-cross-element.html` を開き、各テストケースの検索文字列を入力して、期待通りにハイライトされるかを視覚的に確認（スクリーンショットテストなど）。

## テスト実行方法

### 開発時の実行

```bash
# ウォッチモード（ファイル変更時に自動実行）
npm run test:watch

# UIモード（ブラウザで結果を確認）
npm run test:ui
```

### CI/CDでの実行

```bash
# 通常のテスト実行
npm test

# カバレッジレポート付き
npm run test:coverage
```

## 注意事項

### DOM操作のテスト

- `jsdom`環境を使用するため、実際のブラウザとは動作が異なる場合がある
- `createTreeWalker`などのDOM APIは`jsdom`でサポートされているが、制限がある可能性

### Chrome APIのモック

- 実際のChrome APIの動作と完全に一致させる必要がある
- 非同期処理（コールバック、Promise）を正しくモックする

### テストデータの準備

- テスト用のHTMLドキュメントを動的に生成
- 各テストケースでDOMをクリーンアップ

## 次のステップ

1. **package.jsonの作成と依存関係のインストール**
2. **テスト設定ファイルの作成**
3. **Chrome APIモックの実装**
4. **最初のテストケースの作成**（`searchText()`関数から開始）
5. **テストの段階的な追加**

## 参考リソース

- [Vitest公式ドキュメント](https://vitest.dev/)
- [Jest公式ドキュメント](https://jestjs.io/)
- [Chrome Extension Testing Guide](https://developer.chrome.com/docs/extensions/how-to/test/unit-testing)
- [jsdomドキュメント](https://github.com/jsdom/jsdom)
