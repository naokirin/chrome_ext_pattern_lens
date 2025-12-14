// Import shared type definitions
import type {
  SearchMessage,
  ClearMessage,
  NavigateMessage,
  GetStateMessage,
  SearchResponse,
  StateResponse,
  Settings,
  Response,
} from '~/lib/types';

// DOM elements
const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const regexMode = document.getElementById('regexMode') as HTMLInputElement;
const regexLabel = document.getElementById('regexLabel') as HTMLLabelElement;
const caseSensitiveMode = document.getElementById('caseSensitiveMode') as HTMLInputElement;
const caseSensitiveLabel = document.getElementById('caseSensitiveLabel') as HTMLLabelElement;
const elementMode = document.getElementById('elementMode') as HTMLInputElement;
const searchModeContainer = document.getElementById('searchModeContainer') as HTMLDivElement;
const searchMode = document.getElementById('searchMode') as HTMLSelectElement;
const results = document.getElementById('results') as HTMLDivElement;
const navigation = document.getElementById('navigation') as HTMLDivElement;
const matchCounter = document.getElementById('matchCounter') as HTMLSpanElement;
const prevBtn = document.getElementById('prevBtn') as HTMLButtonElement;
const nextBtn = document.getElementById('nextBtn') as HTMLButtonElement;
const clearLink = document.getElementById('clearLink') as HTMLAnchorElement;

// Track last search query to detect changes
let lastSearchQuery = '';
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

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

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      showResult('エラー: タブ情報を取得できませんでした', true);
      return;
    }

    // Check if the page is a special page where content scripts cannot run
    if (tab.url?.startsWith('chrome://') ||
      tab.url?.startsWith('chrome-extension://') ||
      tab.url?.startsWith('https://chrome.google.com/webstore')) {
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
    chrome.tabs.sendMessage(tab.id, message, (response: SearchResponse | undefined) => {
      if (chrome.runtime.lastError) {
        showResult('エラー: ページに接続できませんでした', true);
        hideNavigation();
        return;
      }

      if (response && response.success) {
        showResult(`${response.count} 件の結果が見つかりました`);
        // Update last search query
        lastSearchQuery = query;
        if (response.totalMatches && response.totalMatches > 0) {
          updateNavigation(response.currentIndex ?? 0, response.totalMatches);
        } else {
          hideNavigation();
        }
      } else if (response && response.error) {
        showResult(`エラー: ${response.error}`, true);
        hideNavigation();
      } else {
        showResult('検索に失敗しました', true);
        hideNavigation();
      }
    });
  } catch (error) {
    const err = error as Error;
    showResult(`エラー: ${err.message}`, true);
  }
}

// Clear highlights
async function clearHighlights(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      showResult('エラー: タブ情報を取得できませんでした', true);
      return;
    }

    // Check if the page is a special page
    if (tab.url?.startsWith('chrome://') ||
      tab.url?.startsWith('chrome-extension://') ||
      tab.url?.startsWith('https://chrome.google.com/webstore')) {
      showResult('このページでは拡張機能を使用できません', true);
      return;
    }

    const message: ClearMessage = { action: 'clear' };
    chrome.tabs.sendMessage(tab.id, message, (response: Response | undefined) => {
      if (chrome.runtime.lastError) {
        showResult('エラー: ページに接続できませんでした', true);
        return;
      }

      if (response && response.success) {
        hideResult();
        hideNavigation();
        searchInput.value = '';
        lastSearchQuery = '';
      }
    });
  } catch (error) {
    const err = error as Error;
    showResult(`エラー: ${err.message}`, true);
  }
}

// Navigate to next match
async function navigateNext(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      return;
    }

    const message: NavigateMessage = { action: 'navigate-next' };
    chrome.tabs.sendMessage(tab.id, message, (response: SearchResponse | undefined) => {
      if (response && response.success && response.totalMatches !== undefined && response.currentIndex !== undefined) {
        updateNavigation(response.currentIndex, response.totalMatches);
      }
    });
  } catch (error) {
    console.error('Navigation error:', error);
  }
}

// Navigate to previous match
async function navigatePrev(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      return;
    }

    const message: NavigateMessage = { action: 'navigate-prev' };
    chrome.tabs.sendMessage(tab.id, message, (response: SearchResponse | undefined) => {
      if (response && response.success && response.totalMatches !== undefined && response.currentIndex !== undefined) {
        updateNavigation(response.currentIndex, response.totalMatches);
      }
    });
  } catch (error) {
    console.error('Navigation error:', error);
  }
}

// Auto-search on input change (debounced)
searchInput.addEventListener('input', () => {
  // Clear existing timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  const query = searchInput.value.trim();

  // If empty, clear highlights immediately
  if (!query) {
    clearHighlights();
    return;
  }

  // Debounce search to avoid too many requests while typing
  searchTimeout = setTimeout(() => {
    performSearch();
  }, 300); // 300ms delay
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
    // Cancel pending auto-search
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }

    if (e.shiftKey) {
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
  }
});

// Restore previous search state from content script
async function restoreSearchState(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      return;
    }

    // Check if the page is a special page
    if (tab.url?.startsWith('chrome://') ||
      tab.url?.startsWith('chrome-extension://') ||
      tab.url?.startsWith('https://chrome.google.com/webstore')) {
      return;
    }

    const message: GetStateMessage = { action: 'get-state' };
    chrome.tabs.sendMessage(tab.id, message, (response: StateResponse | undefined) => {
      if (chrome.runtime.lastError) {
        // Content script not loaded yet, ignore
        return;
      }

      if (response && response.success && response.state?.query) {
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

        lastSearchQuery = state.query;
      }
    });
  } catch (error) {
    console.error('Failed to restore search state:', error);
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
