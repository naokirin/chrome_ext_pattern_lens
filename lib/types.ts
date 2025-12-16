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

export type Message = SearchMessage | ClearMessage | NavigateMessage | GetStateMessage;

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

export type Response = SearchResponse | StateResponse | { success: boolean };

// Settings types
export interface Settings {
  defaultRegex: boolean;
  defaultCaseSensitive: boolean;
  defaultElementSearch: boolean;
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
}

export interface MultiKeywordMatch {
  keywords: string[]; // 検索キーワードの配列
  matches: VirtualMatch[]; // 各キーワードのマッチ位置（正規化後）
  minRange: VirtualMatch; // 全キーワードを含む最小範囲（正規化後）
}
