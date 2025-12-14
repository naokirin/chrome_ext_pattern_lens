# WXT + TypeScript 移行計画

## 概要

現在の素のJavaScriptで実装されたChrome拡張機能を、WXTフレームワークとTypeScriptに移行する計画です。

## 現在のプロジェクト構造

```
chrome_ext_pattern_lens/
├── manifest.json              # 手動管理
├── popup/
│   ├── popup.html
│   └── popup.js
├── options/
│   ├── options.html
│   └── options.js
├── content_scripts/
│   └── main.js
├── tests/
│   └── ...
├── vitest.config.js
└── package.json
```

## WXT移行後の想定構造

```
chrome_ext_pattern_lens/
├── .output/                   # WXTビルド出力（.gitignoreに追加）
├── entrypoints/
│   ├── popup.html             # WXTが自動検出
│   ├── popup.ts               # popup.htmlと同じディレクトリに配置
│   ├── options.html
│   ├── options.ts
│   └── content.ts             # content_scripts/main.js → entrypoints/content.ts
├── public/
│   └── icons/                 # 静的リソース
├── wxt.config.ts              # WXT設定ファイル
├── tsconfig.json              # TypeScript設定
├── tests/
│   └── ...                    # テストは既存のまま（必要に応じて調整）
├── vitest.config.ts           # Vitest設定（TypeScript対応）
└── package.json
```

## 移行ステップ

### フェーズ1: プロジェクトセットアップ

1. **WXTとTypeScriptの依存関係を追加**
   - `wxt`
   - `typescript`
   - `@types/chrome` (Chrome Extension APIの型定義)
   - `@types/node` (必要に応じて)

2. **TypeScript設定ファイルの作成**
   - `tsconfig.json`を作成
   - WXT推奨設定を適用

3. **WXT設定ファイルの作成**
   - `wxt.config.ts`を作成
   - manifest.jsonの設定をWXT設定に移行
   - ビルドオプション、パス設定など

4. **package.jsonの更新**
   - 新しい依存関係を追加
   - ビルドスクリプトを追加（`wxt build`, `wxt dev`など）

### フェーズ2: ファイル構造の移行

1. **entrypointsディレクトリの作成**
   - `entrypoints/`ディレクトリを作成

2. **Popupの移行**
   - `popup/popup.html` → `entrypoints/popup.html`
   - `popup/popup.js` → `entrypoints/popup.ts`（TypeScriptに変換）
   - HTML内の`<script src="popup.js">`を削除（WXTが自動注入）

3. **Optionsの移行**
   - `options/options.html` → `entrypoints/options.html`
   - `options/options.js` → `entrypoints/options.ts`（TypeScriptに変換）
   - HTML内の`<script src="options.js">`を削除

4. **Content Scriptの移行**
   - `content_scripts/main.js` → `entrypoints/content.ts`（TypeScriptに変換）
   - WXTのファイルベースルーティングに従う

5. **静的リソースの移行**
   - `icons/` → `public/icons/`（WXTの静的リソース配置）

### フェーズ3: コードのTypeScript化

1. **型定義の追加**
   - Chrome Extension APIの型定義を活用
   - カスタム型定義ファイルの作成（必要に応じて）
   - メッセージ型、設定型などの定義

2. **JavaScript → TypeScript変換**
   - `.js` → `.ts`への拡張子変更
   - 型アノテーションの追加
   - `any`型の使用を最小限に
   - エラーハンドリングの型安全性向上

3. **Chrome APIの型安全な使用**
   - `chrome.storage.sync`の型定義
   - `chrome.tabs.sendMessage`のメッセージ型定義
   - `chrome.runtime.onMessage`のリスナー型定義

### フェーズ4: テスト環境の調整

1. **Vitest設定の更新**
   - `vitest.config.js` → `vitest.config.ts`
   - TypeScriptファイルのテスト対応
   - 型定義のモック更新

2. **テストファイルの更新**
   - 既存のテストがTypeScriptでも動作することを確認
   - 必要に応じて型定義を追加

### フェーズ5: ビルドと動作確認

1. **開発環境の確認**
   - `wxt dev`で開発モードが動作することを確認
   - HMR（Hot Module Replacement）が機能することを確認

2. **ビルドの確認**
   - `wxt build`で本番ビルドが成功することを確認
   - `.output/`ディレクトリに正しくビルドされることを確認

3. **機能テスト**
   - すべての機能が正常に動作することを確認
   - 既存のテストがすべてパスすることを確認

### フェーズ6: クリーンアップ

1. **不要ファイルの削除**
   - 古い`manifest.json`（WXTが自動生成）
   - 移行済みの`.js`ファイル（バックアップ後）

2. **ドキュメントの更新**
   - `README.md`の更新
   - `CLAUDE.md`の更新
   - 開発手順の更新

## 技術的な考慮事項

### WXTのファイルベースルーティング

WXTは以下の規則でエントリーポイントを自動検出します：

- `entrypoints/popup.html` → Popup UI
- `entrypoints/options.html` → Options Page
- `entrypoints/content.ts` → Content Script
- `entrypoints/background.ts` → Background Script（現在は未使用）

### Manifest設定の移行

現在の`manifest.json`の設定を`wxt.config.ts`に移行：

```typescript
// wxt.config.ts (想定)
export default defineConfig({
  manifest: {
    name: 'Pattern Lens',
    version: '1.0.0',
    permissions: ['storage', 'activeTab'],
    // ...
  },
});
```

### 型定義の活用

Chrome Extension APIの型定義を活用：

```typescript
// メッセージ型の定義例
interface SearchMessage {
  action: 'search';
  query: string;
  useRegex: boolean;
  caseSensitive: boolean;
  useElementSearch: boolean;
  elementSearchMode: 'css' | 'xpath';
}

// 型安全なメッセージ送信
chrome.tabs.sendMessage(tabId, message as SearchMessage);
```

### 既存機能の保持

- すべての既存機能を維持
- テストの互換性を保持
- パフォーマンス特性を維持

## リスクと対策

### リスク1: ビルドエラー
- **対策**: 段階的に移行し、各フェーズで動作確認

### リスク2: 型エラーの大量発生
- **対策**: まず型を緩く設定し、段階的に厳密化

### リスク3: テストの互換性問題
- **対策**: テスト環境を先に更新し、動作確認

### リスク4: 開発フローの変更による混乱
- **対策**: ドキュメントを更新し、新しい開発手順を明記

## 移行後のメリット

1. **型安全性**: TypeScriptによるコンパイル時エラー検出
2. **開発体験**: HMRによる高速な開発サイクル
3. **保守性**: 型定義によるコードの可読性向上
4. **自動化**: Manifestの自動生成による設定ミスの削減
5. **モダンな開発環境**: Viteベースの高速ビルド

## 次のステップ

この計画に基づいて、段階的に移行を進めます。各フェーズの完了後に動作確認を行い、問題がなければ次のフェーズに進みます。
