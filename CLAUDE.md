# Pattern Lens - Claude Code/Cursor開発ガイド

## プロジェクト概要

このプロジェクトは、Chrome拡張機能として実装された高度なページ内検索ツールです。
通常のテキスト検索に加え、正規表現とDOM要素検索（CSSセレクタ、XPath）に対応しています。
さらに、あいまい検索と検索結果一覧表示機能を提供します。

## アーキテクチャ

### 主要コンポーネント

1. **[manifest.json](manifest.json)**: Manifest V3形式の拡張機能定義ファイル
2. **Popup** ([popup/](popup/)): ユーザーインターフェース
   - [popup.html](popup/popup.html): 検索UI
   - [popup.js](popup/popup.js): UI制御とメッセージング
3. **Options** ([options/](options/)): 設定ページ
   - [options.html](options/options.html): 設定UI
   - [options.js](options/options.js): 設定の保存/読み込み
4. **Content Script** ([content_scripts/main.js](content_scripts/main.js)): ページ内での検索とハイライト処理

### データフロー

```
ユーザー入力 (popup.html)
    ↓
popup.js (chrome.tabs.sendMessage)
    ↓
content_scripts/main.js (chrome.runtime.onMessage)
    ↓
DOM操作・検索処理
    ↓
レスポンス返却
    ↓
popup.js (結果表示)
```

## 技術的な設計判断

### なぜManifest V3を選択したか

- Manifest V2は2024年に非推奨化
- V3はセキュリティとパフォーマンスが向上
- Service Workerベースの設計

### ハイライト実装方法

Gemini MCPの助言に基づき、**テキストノード置換方式**を採用：

- `document.createTreeWalker`でテキストノードのみを効率的に探索
- マッチ部分を`<mark>`タグで囲む
- DOM構造を直接変更せず、テキストノードのみ置換することでイベントリスナーの破壊を防止

**不採用だった代替案:**
- `innerHTML`書き換え: イベントリスナーが消滅するリスク
- CSS Custom Highlight API: 将来的な採用を検討（現在はブラウザサポートを考慮）

### 要素検索の実装

- **CSSセレクタ**: `document.querySelectorAll`
- **XPath**: `document.evaluate`
- エラーハンドリング: 不正な入力に対して`try-catch`で対処

### あいまい検索の実装

あいまい検索は、表記ゆれやフォーマットの差異を吸収して検索できる機能です。

**主な機能:**
- **複数キーワード検索**: 空白で区切られた複数のキーワードが一定範囲内に存在する場合にマッチ
- **記号の表記ゆれ吸収**: ハイフン、伸ばし棒などの半角・全角の差異を吸収
- **文字種の表記ゆれ吸収**: アルファベット、数字、カタカナの全角・半角の差異を吸収
- **日付フォーマットの差異吸収**: 年月日の様々なフォーマット（例: 2024/01/01, 2024-01-01, 2024年1月1日）を同一視

**実装方針:**
- 正規化関数でテキストを正規化（全角→半角変換、記号統一など）
- 複数キーワードの場合は、各キーワードの正規化後の位置を追跡
- 一定範囲内（設定可能）に全キーワードが存在する場合にマッチと判定

**制約:**
- 要素検索モードがONの場合は強制的にOFF（要素検索とあいまい検索は同時に使用不可）

### 検索結果一覧の実装

検索結果一覧は、検索で見つかったすべてのマッチを一覧表示する機能です。

**主な機能:**
- **一覧表示**: 検索結果をリスト形式で表示
- **前後文脈表示**: 各検索結果の前後の文字列も表示（設定可能な文字数）
- **ジャンプ機能**: 一覧から選択した結果の位置にページをスクロール

**実装方針:**
- 検索実行時に各マッチの位置情報（Range、テキスト、前後文脈）を収集
- ポップアップ内に一覧UIを表示
- クリック時に`scrollIntoView`で該当位置にジャンプ

**制約:**
- 要素検索モードがONの場合は強制的にOFF（要素検索と検索結果一覧は同時に使用不可）

## 開発時の注意点

### よくあるエラーと対処方法

1. **"Could not establish connection"エラー**
   - 原因: ページ読み込み前にメッセージ送信
   - 対処: content scriptの`run_at: "document_idle"`設定

2. **正規表現エラー**
   - 原因: ユーザー入力の不正な正規表現
   - 対処: [content_scripts/main.js:93-95](content_scripts/main.js#L93-L95)でtry-catchによるエラーハンドリング

3. **XPath/CSSセレクタエラー**
   - 原因: 不正なセレクタ構文
   - 対処: [content_scripts/main.js:117-130](content_scripts/main.js#L117-L130)でエラーメッセージを返す

### パフォーマンス考慮事項

- **大量テキスト処理**: `createTreeWalker`で効率的に探索
- **正規表現の最適化**: グローバルフラグ`gi`を使用
- 将来的な改善案: Web Workersでの非同期処理（Gemini助言より）

## Chrome Extension APIs使用箇所

### chrome.storage.sync

- [options/options.js](options/options.js): 設定の保存/読み込み
- [popup/popup.js](popup/popup.js): デフォルト設定の読み込み

### chrome.tabs

- [popup/popup.js:53](popup/popup.js#L53): アクティブタブの取得
- [popup/popup.js:63](popup/popup.js#L63): content scriptへのメッセージ送信

### chrome.runtime

- [content_scripts/main.js:134](content_scripts/main.js#L134): popupからのメッセージ受信
- [popup/popup.js:66](popup/popup.js#L66): エラーハンドリング

## 実装予定の機能

1. **あいまい検索**
   - 表記ゆれやフォーマットの差異を吸収した検索
   - 複数キーワードの範囲検索
   - 要素検索時は強制OFF

2. **検索結果一覧**
   - 検索結果の一覧表示
   - 前後文脈の表示
   - 一覧からのジャンプ機能
   - 要素検索時は強制OFF

## 拡張予定の機能

1. **Shadow DOMサポート**
   - 現状: 通常のDOMのみ検索可能
   - 計画: Shadow Rootを再帰的に探索

2. **検索履歴**
   - chrome.storage.localに保存

3. **CSS Custom Highlight API**
   - ブラウザサポート状況を確認後、導入検討

## アイコンについて

現在、アイコンはプレースホルダーです。以下のサイズが必要：
- 16x16px: ツールバーアイコン
- 48x48px: 拡張機能管理ページ
- 128x128px: Chromeウェブストア

## テスト方法

### 手動テスト

1. `chrome://extensions/`で拡張機能を読み込む
2. テストページを開く
3. 拡張機能アイコンをクリック
4. 各モードでテスト:
   - 通常検索
   - 正規表現検索（例: `\d+`, `[a-z]{3,}`）
   - CSSセレクタ（例: `.class`, `#id`）
   - XPath（例: `//div[@class='test']`）
   - あいまい検索（例: 全角・半角混在のキーワード、複数キーワード）
   - 検索結果一覧（一覧表示とジャンプ機能）

### デバッグ Tips

- Popup DevTools: ポップアップを右クリック → 「検証」
- Content Script: ページのDevToolsで確認
- Background: 拡張機能ページの「Service Worker」リンク

## コーディング規約

- ES6+構文を使用
- `const`/`let`のみ（`var`は使用しない）
- エラーは必ずtry-catchで処理
- メッセージングは必ず非同期前提で実装

## Claude Code/Cursorでの開発推奨事項

1. **ファイル変更時の手順**
   - コード変更
   - `chrome://extensions/`でリロード
   - テストページでリロード
   - 動作確認

2. **新機能追加時**
   - まずGemini MCPで技術調査
   - 実装方針を確認
   - 段階的に実装

3. **エラー対処**
   - Chrome DevToolsのコンソールを確認
   - 拡張機能のエラーログを確認
   - Gemini MCPでエラーメッセージを検索

## 参考リソース

- [Chrome Extensions Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/migrating/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
