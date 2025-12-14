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
        return;
      }

      if (response && response.success) {
        showResult(`${response.count} 件の結果が見つかりました`);
      } else if (response && response.error) {
        showResult(`エラー: ${response.error}`, true);
      } else {
        showResult('検索に失敗しました', true);
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
        searchInput.value = '';
      }
    });
  } catch (error) {
    showResult(`エラー: ${error.message}`, true);
  }
}

// Event listeners
elementMode.addEventListener('change', updateSearchModeVisibility);
searchBtn.addEventListener('click', performSearch);
clearBtn.addEventListener('click', clearHighlights);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    performSearch();
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  searchInput.focus();
});
