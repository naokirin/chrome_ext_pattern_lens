import { SEARCH_DEBOUNCE_DELAY_MS } from '~/lib/constants';
// Import shared type definitions
import type {
  ClearMessage,
  GetStateMessage,
  NavigateMessage,
  Response,
  SearchMessage,
  SearchResponse,
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
const elementMode = getRequiredElementById<HTMLInputElement>('elementMode');
const searchModeContainer = getRequiredElementById<HTMLDivElement>('searchModeContainer');
const searchMode = getRequiredElementById<HTMLSelectElement>('searchMode');
const results = getRequiredElementById<HTMLDivElement>('results');
const navigation = getRequiredElementById<HTMLDivElement>('navigation');
const matchCounter = getRequiredElementById<HTMLSpanElement>('matchCounter');
const prevBtn = getRequiredElementById<HTMLButtonElement>('prevBtn');
const nextBtn = getRequiredElementById<HTMLButtonElement>('nextBtn');
const clearLink = getRequiredElementById<HTMLAnchorElement>('clearLink');

// Track last search query to detect changes
let _lastSearchQuery = '';
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
// Track the query that initiated the current search to detect if it's stale
let currentSearchQuery = '';

// Load settings from storage
function loadSettings(): void {
  chrome.storage.sync.get(
    {
      defaultRegex: false,
      defaultCaseSensitive: false,
      defaultElementSearch: false,
    },
    (items) => {
      const settings = items as Settings;
      regexMode.checked = settings.defaultRegex;
      caseSensitiveMode.checked = settings.defaultCaseSensitive;
      elementMode.checked = settings.defaultElementSearch;
      updateSearchModeVisibility();
    }
  );
}

// Update search mode selector visibility and regex mode state
function updateSearchModeVisibility(): void {
  const isElementMode = elementMode.checked;

  // Show/hide element search mode selector
  searchModeContainer.style.display = isElementMode ? 'block' : 'none';

  // Disable regex mode and case-sensitive mode when element search is enabled
  if (isElementMode) {
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
  if (totalMatches > 0) {
    navigation.style.display = 'flex';
    matchCounter.textContent = `${currentIndex + 1}/${totalMatches}`;
    prevBtn.disabled = false;
    nextBtn.disabled = false;
  } else {
    navigation.style.display = 'none';
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
        showResult(`${response.count} 件の結果が見つかりました`);
        // Update last search query
        _lastSearchQuery = query;
        if (response.totalMatches && response.totalMatches > 0) {
          updateNavigation(response.currentIndex ?? 0, response.totalMatches);
        } else {
          hideNavigation();
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
        elementMode.checked = state.useElementSearch;
        searchMode.value = state.elementSearchMode;

        // Update UI visibility
        updateSearchModeVisibility();

        // Show results and navigation if there are matches
        if (response.totalMatches && response.totalMatches > 0) {
          showResult(`${response.totalMatches} 件の結果が見つかりました`);
          updateNavigation(response.currentIndex ?? 0, response.totalMatches);
        }

        _lastSearchQuery = state.query;
      }
    });
  } catch (error) {
    // Failed to restore search state (non-critical)
    handleError(error, 'restoreSearchState: Exception', undefined);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  // Restore previous search state after settings are loaded
  setTimeout(() => {
    restoreSearchState();
    searchInput.focus();
  }, 100);
});
