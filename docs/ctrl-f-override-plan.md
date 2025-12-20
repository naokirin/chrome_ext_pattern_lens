# Ctrl+Fオーバーライド機能の実装計画

## 概要

Ctrl+F（macOSではCmd+F）を押したときに、Chromeの標準検索機能ではなく、この拡張機能のポップアップを表示する機能を実装します。

## 技術的な制約と可能性

### 制約事項

1. **`chrome.commands` APIの制限**
   - Chrome拡張機能の`chrome.commands` APIでは、ブラウザの標準ショートカット（Ctrl+Fなど）を直接オーバーライドすることはできません
   - これは、ブラウザの基本機能を保護するためのセキュリティ上の制限です

2. **Content Scriptでのインターセプト**
   - Content Scriptでキーボードイベントをインターセプトし、`preventDefault()`を呼び出すことで、ブラウザのデフォルト動作を防ぐことは可能です
   - ただし、これはページのコンテキストでのみ動作し、すべてのページで確実に動作するとは限りません

3. **ポップアップを開く方法**
   - `chrome.action.openPopup()`はChrome 127以降でしか利用できません
   - それ以前のバージョンでは、ユーザーが手動でアイコンをクリックする必要があります

### 実装可能な方法

Content Scriptでキーボードイベントをキャプチャフェーズでインターセプトし、Background Scriptにメッセージを送信してポップアップを開く方法が実現可能です。

## 実装計画

### 1. Background Scriptの追加

**ファイル**: `entrypoints/background.ts`

- WXTの`defineBackground`を使用してBackground Scriptを作成
- Content Scriptからのメッセージを受信し、`chrome.action.openPopup()`を呼び出す
- Chrome 127未満の場合のフォールバック処理を実装

**実装内容**:
```typescript
export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'open-popup') {
      // Chrome 127以降の場合
      if (chrome.action && chrome.action.openPopup) {
        chrome.action.openPopup().catch((error) => {
          console.error('Failed to open popup:', error);
        });
      } else {
        // フォールバック: ユーザーに通知するか、何もしない
        console.warn('chrome.action.openPopup() is not available');
      }
    }
  });
});
```

### 2. Content Scriptでのキーボードインターセプト

**ファイル**: `entrypoints/content.ts`

- キャプチャフェーズで`keydown`イベントをリッスン
- Ctrl+F（Windows/Linux）またはCmd+F（macOS）を検知
- 設定でこの機能が有効な場合のみ動作
- `preventDefault()`でブラウザのデフォルト動作を防ぐ
- Background Scriptにメッセージを送信

**実装内容**:
```typescript
// 設定を読み込んでキーボードインターセプトを有効化
function setupKeyboardIntercept(): void {
  chrome.storage.sync.get({ overrideCtrlF: true }, (items) => {
    const settings = items as Settings;
    if (settings.overrideCtrlF) {
      document.addEventListener(
        'keydown',
        (event) => {
          // Ctrl+F (Windows/Linux) または Cmd+F (macOS)
          if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
            event.preventDefault();
            event.stopPropagation();
            
            // Background Scriptにメッセージを送信
            chrome.runtime.sendMessage({ action: 'open-popup' }).catch((error) => {
              console.error('Failed to send message to background:', error);
            });
          }
        },
        true // キャプチャフェーズでインターセプト
      );
    }
  });
}
```

### 3. 設定の追加

**ファイル**: `lib/types.ts`

- `Settings`インターフェースに`overrideCtrlF?: boolean`を追加

**ファイル**: `entrypoints/options/main.ts` と `entrypoints/options/index.html`

- オプションページに「Ctrl+Fで拡張機能を開く」チェックボックスを追加
- デフォルト値は`true`（有効）

**ファイル**: `entrypoints/popup/main.ts`

- 設定の読み込み時にこの設定を考慮（必要に応じて）

### 4. メッセージタイプの追加

**ファイル**: `lib/types.ts`

- `OpenPopupMessage`インターフェースを追加
- `Message`型に追加

### 5. 特殊ページでの動作制限

- `chrome://`、`chrome-extension://`、`about:`などの特殊ページでは動作しない
- これはContent Scriptがこれらのページで実行されないため
- エラーハンドリングで適切に対処

## 実装の詳細

### ファイル構成

```
entrypoints/
├── background.ts          # 新規追加
├── content.ts             # 修正
├── popup/
│   └── main.ts            # 必要に応じて修正
└── options/
    ├── index.html         # 修正（設定UI追加）
    └── main.ts            # 修正（設定保存/読み込み）

lib/
└── types.ts               # 修正（型定義追加）

public/
└── _locales/
    ├── ja/
    │   └── messages.json  # 修正（メッセージ追加）
    └── en/
        └── messages.json  # 修正（メッセージ追加）
```

### 実装ステップ

1. **型定義の追加** (`lib/types.ts`)
   - `OpenPopupMessage`インターフェース
   - `Settings`に`overrideCtrlF`フィールド

2. **Background Scriptの作成** (`entrypoints/background.ts`)
   - メッセージリスナーの実装
   - `chrome.action.openPopup()`の呼び出し

3. **Content Scriptの修正** (`entrypoints/content.ts`)
   - キーボードインターセプト機能の追加
   - 設定の読み込みとイベントリスナーの登録

4. **設定UIの追加** (`entrypoints/options/`)
   - HTMLにチェックボックス追加
   - 設定の保存/読み込み処理

5. **国際化対応** (`public/_locales/`)
   - 日本語・英語のメッセージ追加

6. **テスト**
   - 手動テストで動作確認
   - 各種ページでの動作確認
   - Chrome 127未満での動作確認

## 考慮事項

### ユーザー体験

1. **既にポップアップが開いている場合**
   - `chrome.action.openPopup()`は既に開いているポップアップには影響しない
   - ユーザーが再度Ctrl+Fを押した場合、ポップアップがフォーカスされる

2. **フォールバック処理**
   - Chrome 127未満の場合、ポップアップを自動的に開くことができない
   - ユーザーに通知するか、何もしない（設定で無効化を推奨）

3. **競合する拡張機能**
   - 他の拡張機能もCtrl+Fをインターセプトしている場合、競合する可能性がある
   - キャプチャフェーズで早期にインターセプトすることで、優先度を高める

### セキュリティとプライバシー

1. **キーボードイベントのインターセプト**
   - ユーザーが明示的に設定で有効化した場合のみ動作
   - デフォルトで有効にするかどうかは要検討

2. **特殊ページでの動作**
   - `chrome://extensions/`などの特殊ページでは動作しない
   - これはChromeのセキュリティ制限によるもの

### パフォーマンス

1. **イベントリスナーの登録**
   - 設定が無効な場合はイベントリスナーを登録しない
   - メモリリークを防ぐため、適切にクリーンアップ

2. **メッセージングのオーバーヘッド**
   - Content ScriptからBackground Scriptへのメッセージ送信は軽量
   - パフォーマンスへの影響は最小限

## 代替案

### 代替案1: カスタムショートカットの提供

`chrome.commands` APIを使用して、Ctrl+Shift+Fなどのカスタムショートカットを提供する方法。

**メリット**:
- ブラウザの標準機能と競合しない
- より確実に動作する

**デメリット**:
- ユーザーが新しいショートカットを覚える必要がある
- Ctrl+Fを直接オーバーライドできない

### 代替案2: コンテキストメニューからの起動

右クリックメニューから拡張機能を起動できるオプションを追加する方法。

**メリット**:
- 実装が簡単
- 確実に動作する

**デメリット**:
- キーボードショートカットより操作が煩雑

## 推奨実装

上記の実装計画に従って、以下の順序で実装することを推奨します：

1. 型定義と設定の追加
2. Background Scriptの作成
3. Content Scriptでのキーボードインターセプト
4. 設定UIの追加
5. 国際化対応
6. テストとドキュメント更新

## 注意事項

- Chrome 127未満のユーザーには、この機能が完全に動作しない可能性がある
- 一部のウェブサイトでは、独自のキーボードイベントハンドラーが競合する可能性がある
- ユーザーがこの機能を無効化できるオプションを必ず提供する
