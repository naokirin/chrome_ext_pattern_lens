// DOM elements
const searchInput = document.getElementById('searchInput');
const regexMode = document.getElementById('regexMode');
const regexLabel = document.getElementById('regexLabel');
const caseSensitiveMode = document.getElementById('caseSensitiveMode');
const caseSensitiveLabel = document.getElementById('caseSensitiveLabel');
const elementMode = document.getElementById('elementMode');
const searchModeContainer = document.getElementById('searchModeContainer');
const searchMode = document.getElementById('searchMode');
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');
const results = document.getElementById('results');
const navigation = document.getElementById('navigation');
const matchCounter = document.getElementById('matchCounter');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(
    {
      defaultRegex: false,
      defaultCaseSensitive: false,
      defaultElementSearch: false,
    },
    (items) => {
      regexMode.checked = items.defaultRegex;
      caseSensitiveMode.checked = items.defaultCaseSensitive;
      elementMode.checked = items.defaultElementSearch;
      updateSearchModeVisibility();
    }
  );
}

// Update search mode selector visibility and regex mode state
function updateSearchModeVisibility() {
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
function showResult(message, isError = false) {
  results.textContent = message;
  results.className = isError ? 'results error' : 'results success';
  results.style.display = 'block';
}

// Hide result message
function hideResult() {
  results.style.display = 'none';
}

// Update navigation UI
function updateNavigation(currentIndex, totalMatches) {
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
function hideNavigation() {
  navigation.style.display = 'none';
}

// Send search request to content script
async function performSearch() {
  const query = searchInput.value.trim();

  if (!query) {
    showResult('検索キーワードを入力してください', true);
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if the page is a special page where content scripts cannot run
    if (tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('https://chrome.google.com/webstore')) {
      showResult('このページでは拡張機能を使用できません', true);
      return;
    }

    const message = {
      action: 'search',
      query: query,
      useRegex: regexMode.checked,
      caseSensitive: caseSensitiveMode.checked,
      useElementSearch: elementMode.checked,
      elementSearchMode: searchMode.value,
    };

    // Send message to content script
    chrome.tabs.sendMessage(tab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        showResult('エラー: ページに接続できませんでした', true);
        hideNavigation();
        return;
      }

      if (response && response.success) {
        showResult(`${response.count} 件の結果が見つかりました`);
        if (response.totalMatches > 0) {
          updateNavigation(response.currentIndex, response.totalMatches);
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
    showResult(`エラー: ${error.message}`, true);
  }
}

// Clear highlights
async function clearHighlights() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if the page is a special page
    if (tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('https://chrome.google.com/webstore')) {
      showResult('このページでは拡張機能を使用できません', true);
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'clear' }, (response) => {
      if (chrome.runtime.lastError) {
        showResult('エラー: ページに接続できませんでした', true);
        return;
      }

      if (response && response.success) {
        hideResult();
        hideNavigation();
        searchInput.value = '';
      }
    });
  } catch (error) {
    showResult(`エラー: ${error.message}`, true);
  }
}

// Navigate to next match
async function navigateNext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'navigate-next' }, (response) => {
      if (response && response.success) {
        updateNavigation(response.currentIndex, response.totalMatches);
      }
    });
  } catch (error) {
    console.error('Navigation error:', error);
  }
}

// Navigate to previous match
async function navigatePrev() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'navigate-prev' }, (response) => {
      if (response && response.success) {
        updateNavigation(response.currentIndex, response.totalMatches);
      }
    });
  } catch (error) {
    console.error('Navigation error:', error);
  }
}

// Event listeners
elementMode.addEventListener('change', updateSearchModeVisibility);
searchBtn.addEventListener('click', performSearch);
clearBtn.addEventListener('click', clearHighlights);
prevBtn.addEventListener('click', navigatePrev);
nextBtn.addEventListener('click', navigateNext);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) {
      // Shift+Enter: Navigate to previous match
      if (navigation.style.display !== 'none') {
        navigatePrev();
      }
    } else {
      // Enter: If navigation is visible, go to next match, otherwise perform search
      if (navigation.style.display !== 'none') {
        navigateNext();
      } else {
        performSearch();
      }
    }
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  searchInput.focus();
});
