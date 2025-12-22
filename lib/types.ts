// Shared type definitions for Pattern Lens extension

// Message types for communication between popup and content script
export interface SearchMessage {
  action: 'search';
  query: string;
  useRegex: boolean;
  caseSensitive: boolean;
  useElementSearch: boolean;
  elementSearchMode: 'css' | 'xpath';
  useFuzzy: boolean;
}

export interface ClearMessage {
  action: 'clear';
}

export interface NavigateMessage {
  action: 'navigate-next' | 'navigate-prev';
}

export interface GetStateMessage {
  action: 'get-state';
}

export interface GetResultsListMessage {
  action: 'get-results-list';
  contextLength?: number;
}

export interface JumpToMatchMessage {
  action: 'jump-to-match';
  index: number;
}

export interface OpenPopupMessage {
  action: 'open-popup';
}

export interface PingMessage {
  action: 'ping';
}

export type Message =
  | SearchMessage
  | ClearMessage
  | NavigateMessage
  | GetStateMessage
  | GetResultsListMessage
  | JumpToMatchMessage
  | OpenPopupMessage
  | PingMessage;

// Response types
export interface SearchResponse {
  success: boolean;
  count?: number;
  totalMatches?: number;
  currentIndex?: number;
  error?: string;
}

export interface StateResponse {
  success: boolean;
  state?: SearchState;
  currentIndex?: number;
  totalMatches?: number;
}

export interface SearchResultItem {
  index: number;
  matchedText: string;
  contextBefore: string;
  contextAfter: string;
  fullText: string;
  tagInfo?: string; // 要素検索用: "<div#id.class>" 形式
}

export interface SearchResultsListResponse {
  success: boolean;
  items?: SearchResultItem[];
  totalMatches?: number;
  error?: string;
}

export type Response =
  | SearchResponse
  | StateResponse
  | SearchResultsListResponse
  | { success: boolean };

// Settings types
export interface Settings {
  defaultRegex: boolean;
  defaultCaseSensitive: boolean;
  defaultFuzzy: boolean; // あいまい検索をデフォルトで有効化
  defaultElementSearch: boolean;
  defaultElementSearchMode?: 'css' | 'xpath'; // 要素検索のデフォルトモード（CSSセレクタ or XPath）
  resultsListContextLength?: number;
  defaultResultsList?: boolean; // 検索結果一覧をデフォルトで有効化（デフォルト: false）
  autoUpdateSearch?: boolean; // 動的要素の自動検索更新を有効化
  overrideCtrlF?: boolean; // Ctrl+Fで拡張機能を開く（デフォルト: false）
  fuzzySearchBaseMultiplier?: number; // あいまい検索の範囲計算倍率（デフォルト: 6）
  fuzzySearchMinDistance?: number; // あいまい検索の最小範囲（デフォルト: 20）
  fuzzySearchMaxDistance?: number; // あいまい検索の最大範囲（デフォルト: 200）
}

export interface SearchState {
  query: string;
  useRegex: boolean;
  caseSensitive: boolean;
  useElementSearch: boolean;
  elementSearchMode: 'css' | 'xpath';
  useFuzzy: boolean;
}

// Content script types
export interface HighlightData {
  ranges: Range[];
  elements: Element[];
  overlays: HTMLDivElement[];
}

export interface CharMapEntry {
  node: Text | null;
  offset: number;
  type?: 'block-boundary';
}

export interface VirtualMatch {
  start: number;
  end: number;
}

export interface NavigationResult {
  currentIndex: number;
  totalMatches: number;
}

export interface SearchResult {
  count: number;
  currentIndex: number;
  totalMatches: number;
}

// Fuzzy search types
export interface NormalizationMapping {
  // 正規化後のインデックス i が元の仮想テキストの [ranges[i].start, ranges[i].end) に対応
  ranges: Array<{ start: number; end: number }>;
}

export interface NormalizationResult {
  normalizedText: string; // 正規化後のテキスト
  mapping: NormalizationMapping; // 位置マッピング
  originalText?: string; // 元のテキスト（アクセント付き文字の検証用）
}

export interface MultiKeywordMatch {
  keywords: string[]; // 検索キーワードの配列
  matches: VirtualMatch[]; // 各キーワードのマッチ位置（正規化後）
  minRange: VirtualMatch; // 全キーワードを含む最小範囲（正規化後）
}
