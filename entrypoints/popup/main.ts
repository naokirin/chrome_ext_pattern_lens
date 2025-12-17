import { SEARCH_DEBOUNCE_DELAY_MS } from '~/lib/constants';
// Import shared type definitions
import {
  DEFAULT_RESULTS_LIST_CONTEXT_LENGTH,
  MAX_RESULTS_LIST_CONTEXT_LENGTH,
  MIN_RESULTS_LIST_CONTEXT_LENGTH,
} from '~/lib/constants';
import type {
  ClearMessage,
  GetResultsListMessage,
  GetStateMessage,
  JumpToMatchMessage,
  NavigateMessage,
  Response,
  SearchMessage,
  SearchResponse,
  SearchResultsListResponse,
  Settings,
  StateResponse,
} from '~/lib/types';
import { getRequiredElementById } from '~/lib/utils/domUtils';
import { handleError } from '~/lib/utils/errorHandler';
import { getActiveTab, isSpecialPage } from '~/lib/utils/tabUtils';

// DOM elements - these are required elements in popup.html
const searchInput = getRequiredElementById<HTMLInputElement>('searchInput');
const regexMode = getRequiredElementById<HTMLInputElement>('regexMode');
const regexLabel = getRequiredElementById<HTMLLabelElement>('regexLabel');
const caseSensitiveMode = getRequiredElementById<HTMLInputElement>('caseSensitiveMode');
const caseSensitiveLabel = getRequiredElementById<HTMLLabelElement>('caseSensitiveLabel');
const fuzzyMode = getRequiredElementById<HTMLInputElement>('fuzzyMode');
const fuzzyLabel = getRequiredElementById<HTMLLabelElement>('fuzzyLabel');
const elementMode = getRequiredElementById<HTMLInputElement>('elementMode');
const resultsListMode = getRequiredElementById<HTMLInputElement>('resultsListMode');
const resultsListLabel = getRequiredElementById<HTMLLabelElement>('resultsListLabel');
const searchModeContainer = getRequiredElementById<HTMLDivElement>('searchModeContainer');
const searchMode = getRequiredElementById<HTMLSelectElement>('searchMode');
const results = getRequiredElementById<HTMLDivElement>('results');
const navigation = getRequiredElementById<HTMLDivElement>('navigation');
const matchCounter = getRequiredElementById<HTMLSpanElement>('matchCounter');
const prevBtn = getRequiredElementById<HTMLButtonElement>('prevBtn');
const nextBtn = getRequiredElementById<HTMLButtonElement>('nextBtn');
const clearLink = getRequiredElementById<HTMLAnchorElement>('clearLink');
const resultsList = getRequiredElementById<HTMLDivElement>('resultsList');
const resultsListCount = getRequiredElementById<HTMLSpanElement>('resultsListCount');
const resultsListItems = getRequiredElementById<HTMLDivElement>('resultsListItems');

// Track last search query to detect changes
let _lastSearchQuery = '';
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
// Track the query that initiated the current search to detect if it's stale
let currentSearchQuery = '';
// Context length for results list (loaded from settings)
let contextLength = DEFAULT_RESULTS_LIST_CONTEXT_LENGTH;

// Load settings from storage
function loadSettings(): void {
  chrome.storage.sync.get(
    {
      defaultRegex: false,
      defaultCaseSensitive: false,
      defaultElementSearch: false,
      resultsListContextLength: DEFAULT_RESULTS_LIST_CONTEXT_LENGTH,
    },
    (items) => {
      const settings = items as Settings;
      regexMode.checked = settings.defaultRegex;
      caseSensitiveMode.checked = settings.defaultCaseSensitive;
      elementMode.checked = settings.defaultElementSearch;

      // Load context length and validate
      const savedContextLength =
        settings.resultsListContextLength ?? DEFAULT_RESULTS_LIST_CONTEXT_LENGTH;
      if (
        savedContextLength >= MIN_RESULTS_LIST_CONTEXT_LENGTH &&
        savedContextLength <= MAX_RESULTS_LIST_CONTEXT_LENGTH
      ) {
        contextLength = savedContextLength;
      } else {
        contextLength = DEFAULT_RESULTS_LIST_CONTEXT_LENGTH;
      }

      updateSearchModeVisibility();
    }
  );
}

// Update search mode selector visibility and regex mode state
function updateSearchModeVisibility(): void {
  const isElementMode = elementMode.checked;
  const isFuzzyMode = fuzzyMode.checked && !elementMode.checked;

  // Show/hide element search mode selector
  searchModeContainer.style.display = isElementMode ? 'block' : 'none';

  // Disable regex mode, case-sensitive mode, fuzzy mode, and results list when element search is enabled
  if (isElementMode) {
    regexMode.checked = false;
    regexMode.disabled = true;
    regexLabel.classList.add('disabled');
    caseSensitiveMode.checked = false;
    caseSensitiveMode.disabled = true;
    caseSensitiveLabel.classList.add('disabled');
    fuzzyMode.checked = false;
    fuzzyMode.disabled = true;
    fuzzyLabel.classList.add('disabled');
    resultsListMode.checked = false;
    resultsListMode.disabled = true;
    resultsListLabel.classList.add('disabled');
    resultsList.style.display = 'none';
    resultsList.classList.remove('visible');
    document.body.classList.remove('has-results-list');
  } else {
    // Disable regex mode and case-sensitive mode when fuzzy search is enabled
    if (isFuzzyMode) {
      regexMode.checked = false;
      regexMode.disabled = true;
      regexLabel.classList.add('disabled');
      caseSensitiveMode.checked = false;
      caseSensitiveMode.disabled = true;
      caseSensitiveLabel.classList.add('disabled');
    } else {
      regexMode.disabled = false;
      regexLabel.classList.remove('disabled');
      caseSensitiveMode.disabled = false;
      caseSensitiveLabel.classList.remove('disabled');
    }
    fuzzyMode.disabled = false;
    fuzzyLabel.classList.remove('disabled');
    resultsListMode.disabled = false;
    resultsListLabel.classList.remove('disabled');
  }
}

// Show result message
function showResult(message: string, isError = false): void {
  results.textContent = message;
  results.className = isError ? 'results error' : 'results success';
  results.style.display = 'block';
}

// Hide result message
function hideResult(): void {
  results.style.display = 'none';
}

// Update navigation UI
function updateNavigation(currentIndex: number, totalMatches: number): void {
  // Always show navigation after a search, and indicate status with x/y
  navigation.style.display = 'flex';

  if (totalMatches > 0) {
    // Matches found: show current/total in green and enable navigation
    matchCounter.textContent = `${currentIndex + 1} / ${totalMatches}`;
    matchCounter.style.color = '#4CAF50';
    prevBtn.disabled = false;
    nextBtn.disabled = false;
  } else {
    // No matches: show 0/0 in red and disable navigation buttons
    matchCounter.textContent = '0 / 0';
    matchCounter.style.color = '#f44336';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
  }
}

// Hide navigation UI
function hideNavigation(): void {
  navigation.style.display = 'none';
}

// Send search request to content script
async function performSearch(): Promise<void> {
  const query = searchInput.value.trim();

  if (!query) {
    showResult('検索キーワードを入力してください', true);
    return;
  }

  // Save the query at the start of the search to detect if it becomes stale
  currentSearchQuery = query;

  try {
    const tab = await getActiveTab();

    if (!tab) {
      showResult('エラー: タブ情報を取得できませんでした', true);
      return;
    }

    // Check if the page is a special page where content scripts cannot run
    if (isSpecialPage(tab.url)) {
      showResult('このページでは拡張機能を使用できません', true);
      return;
    }

    const message: SearchMessage = {
      action: 'search',
      query: query,
      useRegex: regexMode.checked,
      caseSensitive: caseSensitiveMode.checked,
      useElementSearch: elementMode.checked,
      elementSearchMode: searchMode.value as 'css' | 'xpath',
      useFuzzy: fuzzyMode.checked && !elementMode.checked,
    };

    // Send message to content script
    // tab.id is guaranteed to be a number because getActiveTab() only returns tabs with IDs
    chrome.tabs.sendMessage(tab.id, message, (response: SearchResponse | undefined) => {
      // Check if the query has changed since this search was initiated
      const currentQuery = searchInput.value.trim();
      if (currentQuery !== currentSearchQuery) {
        // Query has changed, ignore this stale response
        return;
      }

      if (chrome.runtime.lastError) {
        const error = new Error(chrome.runtime.lastError.message || 'ページに接続できませんでした');
        handleError(error, 'performSearch: Chrome runtime error', (err) => {
          showResult(`エラー: ${err.message}`, true);
        });
        hideNavigation();
        return;
      }

      if (response?.success) {
        // 検索成功時は件数メッセージを表示せず、ナビゲーションの x/y 表示で状態を示す
        hideResult();
        // Update last search query
        _lastSearchQuery = query;
        // totalMatches が 0 の場合もナビゲーションに 0/0（赤・矢印 disabled）を表示する
        const totalMatches = response.totalMatches ?? 0;
        const currentIndex = response.currentIndex ?? 0;
        updateNavigation(currentIndex, totalMatches);
        // 検索結果一覧を更新
        if (resultsListMode.checked) {
          fetchAndDisplayResultsList();
        }
      } else if (response?.error) {
        const error = new Error(response.error);
        handleError(error, 'performSearch: Search response error', (err) => {
          showResult(`エラー: ${err.message}`, true);
        });
        hideNavigation();
      } else {
        const error = new Error('検索に失敗しました');
        handleError(error, 'performSearch: Unknown search failure', (err) => {
          showResult(`エラー: ${err.message}`, true);
        });
        hideNavigation();
      }
    });
  } catch (error) {
    handleError(error, 'performSearch: Exception', (err) => {
      showResult(`エラー: ${err.message}`, true);
    });
  }
}

// Clear highlights
async function clearHighlights(): Promise<void> {
  try {
    const tab = await getActiveTab();

    if (!tab) {
      showResult('エラー: タブ情報を取得できませんでした', true);
      return;
    }

    // Check if the page is a special page
    if (isSpecialPage(tab.url)) {
      showResult('このページでは拡張機能を使用できません', true);
      return;
    }

    const message: ClearMessage = { action: 'clear' };
    chrome.tabs.sendMessage(tab.id, message, (response: Response | undefined) => {
      if (chrome.runtime.lastError) {
        const error = new Error(chrome.runtime.lastError.message || 'ページに接続できませんでした');
        handleError(error, 'clearHighlights: Chrome runtime error', (err) => {
          showResult(`エラー: ${err.message}`, true);
        });
        return;
      }

      if (response?.success) {
        hideResult();
        hideNavigation();
        resultsList.style.display = 'none';
        resultsList.classList.remove('visible');
        document.body.classList.remove('has-results-list');
        searchInput.value = '';
        _lastSearchQuery = '';
      }
    });
  } catch (error) {
    handleError(error, 'clearHighlights: Exception', (err) => {
      showResult(`エラー: ${err.message}`, true);
    });
  }
}

// Navigate to next match
async function navigateNext(): Promise<void> {
  try {
    const tab = await getActiveTab();

    if (!tab) {
      return;
    }

    const message: NavigateMessage = { action: 'navigate-next' };
    chrome.tabs.sendMessage(tab.id, message, (response: SearchResponse | undefined) => {
      if (
        response?.success &&
        response.totalMatches !== undefined &&
        response.currentIndex !== undefined
      ) {
        updateNavigation(response.currentIndex, response.totalMatches);
      }
    });
  } catch (error) {
    // Navigation errors are non-critical, log but don't show to user
    handleError(error, 'navigateNext: Navigation error', undefined);
  }
}

// Navigate to previous match
async function navigatePrev(): Promise<void> {
  try {
    const tab = await getActiveTab();

    if (!tab) {
      return;
    }

    const message: NavigateMessage = { action: 'navigate-prev' };
    chrome.tabs.sendMessage(tab.id, message, (response: SearchResponse | undefined) => {
      if (
        response?.success &&
        response.totalMatches !== undefined &&
        response.currentIndex !== undefined
      ) {
        updateNavigation(response.currentIndex, response.totalMatches);
      }
    });
  } catch (error) {
    // Navigation errors are non-critical, log but don't show to user
    handleError(error, 'navigatePrev: Navigation error', undefined);
  }
}

// Auto-search on input change (debounced)
searchInput.addEventListener('input', () => {
  // Clear existing timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
    searchTimeout = null;
  }

  const query = searchInput.value.trim();

  // If empty, clear highlights immediately
  if (!query) {
    clearHighlights();
    currentSearchQuery = '';
    _lastSearchQuery = '';
    return;
  }

  // Reset currentSearchQuery when input changes to ensure Enter key detects changes
  // This allows Enter key to trigger a new search even if pressed immediately after input
  currentSearchQuery = '';

  // Debounce search to avoid too many requests while typing
  searchTimeout = setTimeout(() => {
    // Double-check the query hasn't changed during the debounce delay
    const currentQuery = searchInput.value.trim();
    if (currentQuery === query) {
      performSearch();
    }
    searchTimeout = null;
  }, SEARCH_DEBOUNCE_DELAY_MS);
});

// Auto-search when checkboxes change
function handleCheckboxChange(): void {
  updateSearchModeVisibility();
  // Only trigger search if there's a query
  const query = searchInput.value.trim();
  if (query) {
    performSearch();
  }
}

// Event listeners
elementMode.addEventListener('change', handleCheckboxChange);
regexMode.addEventListener('change', handleCheckboxChange);
caseSensitiveMode.addEventListener('change', handleCheckboxChange);
fuzzyMode.addEventListener('change', handleCheckboxChange);
resultsListMode.addEventListener('change', () => {
  updateSearchModeVisibility();
  if (resultsListMode.checked) {
    fetchAndDisplayResultsList();
  } else {
    resultsList.style.display = 'none';
    resultsList.classList.remove('visible');
    document.body.classList.remove('has-results-list');
  }
});
searchMode.addEventListener('change', () => {
  // Element search mode selector change
  const query = searchInput.value.trim();
  if (query && elementMode.checked) {
    performSearch();
  }
});
prevBtn.addEventListener('click', navigatePrev);
nextBtn.addEventListener('click', navigateNext);
clearLink.addEventListener('click', (e) => {
  e.preventDefault();
  searchInput.value = '';
  clearHighlights();
});
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    // Cancel pending auto-search
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }

    const currentQuery = searchInput.value.trim();

    // Check if query has changed by comparing with currentSearchQuery
    // currentSearchQuery is set when performSearch() starts, so if it doesn't match,
    // it means the input has changed since the last search started
    const queryChanged = !currentSearchQuery || currentQuery !== currentSearchQuery;

    if (queryChanged) {
      // Query has changed or no search has been performed yet, perform new search
      performSearch();
    } else if (e.shiftKey) {
      // Shift+Enter: Navigate to previous match
      if (navigation.style.display !== 'none') {
        navigatePrev();
      } else {
        performSearch();
      }
    } else {
      // Enter: Navigate to next match if available, otherwise search
      if (navigation.style.display !== 'none') {
        navigateNext();
      } else {
        performSearch();
      }
    }
  } else if (e.key === 'Escape') {
    // Escape: Clear search and highlights
    searchInput.value = '';
    clearHighlights();
    currentSearchQuery = '';
    _lastSearchQuery = '';
  }
});

/**
 * 検索結果一覧を取得して表示
 */
async function fetchAndDisplayResultsList(): Promise<void> {
  if (!resultsListMode.checked) {
    resultsList.style.display = 'none';
    resultsList.classList.remove('visible');
    document.body.classList.remove('has-results-list');
    return;
  }

  try {
    const tab = await getActiveTab();
    if (!tab || isSpecialPage(tab.url)) {
      return;
    }

    const message: GetResultsListMessage = {
      action: 'get-results-list',
      contextLength: contextLength,
    };

    chrome.tabs.sendMessage(tab.id, message, (response: SearchResultsListResponse | undefined) => {
      if (chrome.runtime.lastError || !response?.success) {
        return;
      }

      displayResultsList(response.items || [], response.totalMatches || 0);
    });
  } catch (error) {
    handleError(error, 'fetchAndDisplayResultsList: Exception', undefined);
  }
}

/**
 * 検索結果一覧を表示
 */
function displayResultsList(
  items: Array<{
    index: number;
    matchedText: string;
    contextBefore: string;
    contextAfter: string;
    fullText: string;
  }>,
  totalMatches: number
): void {
  resultsListCount.textContent = `${totalMatches}件`;
  resultsListItems.innerHTML = '';

  if (items.length === 0) {
    resultsList.style.display = 'none';
    resultsList.classList.remove('visible');
    document.body.classList.remove('has-results-list');
    return;
  }

  resultsList.style.display = 'flex';
  resultsList.classList.add('visible');
  document.body.classList.add('has-results-list');

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

    chrome.tabs.sendMessage(tab.id, message, (response: SearchResponse | undefined) => {
      if (response?.success) {
        // ナビゲーションUIを更新
        if (response.totalMatches !== undefined && response.currentIndex !== undefined) {
          updateNavigation(response.currentIndex, response.totalMatches);
        }
        // 一覧の現在のマッチをハイライト
        updateResultsListHighlight(response.currentIndex ?? -1);
      }
    });
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
      // スクロールして表示領域に収める
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      item.classList.remove('current');
    }
  });
}

// Restore previous search state from content script
async function restoreSearchState(): Promise<void> {
  try {
    const tab = await getActiveTab();

    if (!tab) {
      return;
    }

    // Check if the page is a special page
    if (isSpecialPage(tab.url)) {
      return;
    }

    const message: GetStateMessage = { action: 'get-state' };
    chrome.tabs.sendMessage(tab.id, message, (response: StateResponse | undefined) => {
      if (chrome.runtime.lastError) {
        // Content script not loaded yet, ignore (low severity)
        const error = new Error(chrome.runtime.lastError.message || 'Content script not loaded');
        handleError(error, 'restoreSearchState: Chrome runtime error', undefined);
        return;
      }

      if (response?.success && response.state?.query) {
        // Restore search state
        const state = response.state;
        searchInput.value = state.query;
        regexMode.checked = state.useRegex;
        caseSensitiveMode.checked = state.caseSensitive;
        fuzzyMode.checked = state.useFuzzy ?? false;
        elementMode.checked = state.useElementSearch;
        searchMode.value = state.elementSearchMode;

        // Update UI visibility
        updateSearchModeVisibility();

        // Show results and navigation if there are matches
        // 検索状態復元時も件数メッセージは表示せず、ナビゲーションのみ更新する
        const totalMatches = response.totalMatches ?? 0;
        const currentIndex = response.currentIndex ?? 0;
        updateNavigation(currentIndex, totalMatches);

        // 検索結果一覧を復元
        if (resultsListMode.checked) {
          fetchAndDisplayResultsList();
        }

        _lastSearchQuery = state.query;
      }
    });
  } catch (error) {
    // Failed to restore search state (non-critical)
    handleError(error, 'restoreSearchState: Exception', undefined);
  }
}

// Listen for storage changes to update context length
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.resultsListContextLength) {
    const newContextLength = changes.resultsListContextLength.newValue;
    if (
      typeof newContextLength === 'number' &&
      newContextLength >= MIN_RESULTS_LIST_CONTEXT_LENGTH &&
      newContextLength <= MAX_RESULTS_LIST_CONTEXT_LENGTH
    ) {
      contextLength = newContextLength;
      // If results list is currently displayed, refresh it with new context length
      if (resultsListMode.checked) {
        fetchAndDisplayResultsList();
      }
    }
  }
});

// Listen for search updates from content script (e.g., after dynamic DOM changes)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'searchUpdated') {
    const totalMatches = message.totalMatches ?? 0;
    const currentIndex = message.currentIndex ?? 0;
    updateNavigation(currentIndex, totalMatches);
    // Refresh results list if displayed
    if (resultsListMode.checked) {
      fetchAndDisplayResultsList();
    }
    sendResponse({ success: true });
  }
  return true;
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  // Restore previous search state after settings are loaded
  setTimeout(() => {
    restoreSearchState();
    searchInput.focus();
  }, 100);
});
