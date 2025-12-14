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
   - 対象: `content_scripts/main.js`の各関数
     - `searchText()`: テキスト検索と正規表現検索
     - `searchElements()`: CSSセレクタとXPath検索
     - `clearHighlights()`: ハイライトの削除
     - `initializeStyles()`: スタイルの初期化

2. **統合テスト**
   - Chrome APIとの連携をテスト
   - 対象: `popup/popup.js`, `options/options.js`
     - `chrome.storage.sync`の読み書き
     - `chrome.tabs`との通信
     - `chrome.runtime.onMessage`のメッセージ処理

3. **E2Eテスト（将来の拡張）**
   - 実際のブラウザ環境での動作確認
   - Puppeteer/Playwrightを使用

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

### 優先度: 高

1. **`searchText()`関数**
   - 通常検索の動作
   - 正規表現検索の動作
   - 大文字小文字の区別
   - 特殊文字の処理

2. **`searchElements()`関数**
   - CSSセレクタの検索
   - XPathの検索
   - エラーハンドリング（不正なセレクタ）

3. **`clearHighlights()`関数**
   - ハイライトの削除
   - DOMの正規化

### 優先度: 中

4. **`popup.js`のメッセージング**
   - Chrome APIとの通信
   - エラーハンドリング

5. **`options.js`の設定保存**
   - `chrome.storage.sync`の読み書き

### 優先度: 低

6. **UIの表示/非表示**
   - モード切り替え時のUI更新

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
