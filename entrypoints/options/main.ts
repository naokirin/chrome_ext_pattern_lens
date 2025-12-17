// Import shared type definitions
import { DEFAULT_RESULTS_LIST_CONTEXT_LENGTH } from '~/lib/constants';
import type { Settings } from '~/lib/types';
import { getElementById } from '~/lib/utils/domUtils';

// Load saved settings
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
      const defaultRegexEl = getElementById<HTMLInputElement>('defaultRegex');
      const defaultElementSearchEl = getElementById<HTMLInputElement>('defaultElementSearch');
      const resultsListContextLengthEl = getElementById<HTMLInputElement>(
        'resultsListContextLength'
      );

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
      // Note: defaultCaseSensitive is not shown in options page UI
    }
  );
}

// Save settings
function saveSettings(): void {
  const defaultRegexEl = getElementById<HTMLInputElement>('defaultRegex');
  const defaultElementSearchEl = getElementById<HTMLInputElement>('defaultElementSearch');
  const resultsListContextLengthEl = getElementById<HTMLInputElement>('resultsListContextLength');

  if (!defaultRegexEl || !defaultElementSearchEl || !resultsListContextLengthEl) {
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
document.addEventListener('DOMContentLoaded', loadSettings);

// Auto-save on change
const defaultRegexEl = getElementById<HTMLInputElement>('defaultRegex');
const defaultElementSearchEl = getElementById<HTMLInputElement>('defaultElementSearch');
const resultsListContextLengthEl = getElementById<HTMLInputElement>('resultsListContextLength');

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
