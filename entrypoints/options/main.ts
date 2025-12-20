// Import shared type definitions
import { DEFAULT_RESULTS_LIST_CONTEXT_LENGTH } from '~/lib/constants';
import type { Settings } from '~/lib/types';
import { getElementById } from '~/lib/utils/domUtils';
import { initializeI18n } from '~/lib/utils/i18n';

// Load saved settings
function loadSettings(): void {
  chrome.storage.sync.get(
    {
      defaultRegex: false,
      defaultCaseSensitive: false,
      defaultElementSearch: false,
      resultsListContextLength: DEFAULT_RESULTS_LIST_CONTEXT_LENGTH,
      autoUpdateSearch: true, // デフォルトで有効
    },
    (items) => {
      const settings = items as Settings;
      const defaultRegexEl = getElementById<HTMLInputElement>('defaultRegex');
      const defaultElementSearchEl = getElementById<HTMLInputElement>('defaultElementSearch');
      const resultsListContextLengthEl = getElementById<HTMLInputElement>(
        'resultsListContextLength'
      );
      const autoUpdateSearchEl = getElementById<HTMLInputElement>('autoUpdateSearch');

      if (defaultRegexEl) {
        defaultRegexEl.checked = settings.defaultRegex;
      }
      if (defaultElementSearchEl) {
        defaultElementSearchEl.checked = settings.defaultElementSearch;
      }
      if (resultsListContextLengthEl) {
        resultsListContextLengthEl.value = String(
          settings.resultsListContextLength ?? DEFAULT_RESULTS_LIST_CONTEXT_LENGTH
        );
      }
      if (autoUpdateSearchEl) {
        autoUpdateSearchEl.checked = settings.autoUpdateSearch ?? true;
      }
      // Note: defaultCaseSensitive is not shown in options page UI
    }
  );
}

// Save settings
function saveSettings(): void {
  const defaultRegexEl = getElementById<HTMLInputElement>('defaultRegex');
  const defaultElementSearchEl = getElementById<HTMLInputElement>('defaultElementSearch');
  const resultsListContextLengthEl = getElementById<HTMLInputElement>('resultsListContextLength');
  const autoUpdateSearchEl = getElementById<HTMLInputElement>('autoUpdateSearch');

  if (
    !defaultRegexEl ||
    !defaultElementSearchEl ||
    !resultsListContextLengthEl ||
    !autoUpdateSearchEl
  ) {
    return;
  }

  const contextLength = Number.parseInt(resultsListContextLengthEl.value, 10);
  const validContextLength =
    !Number.isNaN(contextLength) && contextLength >= 10 && contextLength <= 100
      ? contextLength
      : DEFAULT_RESULTS_LIST_CONTEXT_LENGTH;

  const settings: Settings = {
    defaultRegex: defaultRegexEl.checked,
    defaultCaseSensitive: false, // Options page doesn't have this setting
    defaultElementSearch: defaultElementSearchEl.checked,
    resultsListContextLength: validContextLength,
    autoUpdateSearch: autoUpdateSearchEl.checked,
  };

  chrome.storage.sync.set(settings, () => {
    const statusDiv = getElementById<HTMLDivElement>('saveStatus');
    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.classList.add('success');

      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 2000);
    }
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeI18n();
  loadSettings();
});

// Auto-save on change
const defaultRegexEl = getElementById<HTMLInputElement>('defaultRegex');
const defaultElementSearchEl = getElementById<HTMLInputElement>('defaultElementSearch');
const resultsListContextLengthEl = getElementById<HTMLInputElement>('resultsListContextLength');
const autoUpdateSearchEl = getElementById<HTMLInputElement>('autoUpdateSearch');

if (defaultRegexEl) {
  defaultRegexEl.addEventListener('change', saveSettings);
}
if (defaultElementSearchEl) {
  defaultElementSearchEl.addEventListener('change', saveSettings);
}
if (resultsListContextLengthEl) {
  resultsListContextLengthEl.addEventListener('change', saveSettings);
  resultsListContextLengthEl.addEventListener('blur', saveSettings);
}
if (autoUpdateSearchEl) {
  autoUpdateSearchEl.addEventListener('change', saveSettings);
}
