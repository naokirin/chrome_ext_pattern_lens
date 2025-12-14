// DOM elements
const searchInput = document.getElementById('searchInput');
const regexMode = document.getElementById('regexMode');
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
      defaultElementSearch: false,
    },
    (items) => {
      regexMode.checked = items.defaultRegex;
      elementMode.checked = items.defaultElementSearch;
      updateSearchModeVisibility();
    }
  );
}

// Update search mode selector visibility
function updateSearchModeVisibility() {
  searchModeContainer.style.display = elementMode.checked ? 'block' : 'none';
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

    const message = {
      action: 'search',
      query: query,
      useRegex: regexMode.checked,
      useElementSearch: elementMode.checked,
      elementSearchMode: searchMode.value,
    };

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
