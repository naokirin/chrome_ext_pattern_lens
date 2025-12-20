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
      defaultFuzzy: false,
      defaultElementSearch: false,
      resultsListContextLength: DEFAULT_RESULTS_LIST_CONTEXT_LENGTH,
      autoUpdateSearch: true, // デフォルトで有効
      overrideCtrlF: false, // デフォルトで無効
    },
    (items) => {
      const settings = items as Settings;
      const defaultRegexEl = getElementById<HTMLInputElement>('defaultRegex');
      const defaultCaseSensitiveEl = getElementById<HTMLInputElement>('defaultCaseSensitive');
      const defaultFuzzyEl = getElementById<HTMLInputElement>('defaultFuzzy');
      const defaultElementSearchEl = getElementById<HTMLInputElement>('defaultElementSearch');
      const defaultElementSearchModeEl = getElementById<HTMLSelectElement>(
        'defaultElementSearchMode'
      );
      const resultsListContextLengthEl = getElementById<HTMLInputElement>(
        'resultsListContextLength'
      );
      const autoUpdateSearchEl = getElementById<HTMLInputElement>('autoUpdateSearch');
      const overrideCtrlFEl = getElementById<HTMLInputElement>('overrideCtrlF');

      if (defaultRegexEl) {
        defaultRegexEl.checked = settings.defaultRegex;
      }
      if (defaultCaseSensitiveEl) {
        defaultCaseSensitiveEl.checked = settings.defaultCaseSensitive ?? false;
      }
      if (defaultFuzzyEl) {
        defaultFuzzyEl.checked = settings.defaultFuzzy ?? false;
      }
      if (defaultElementSearchEl) {
        defaultElementSearchEl.checked = settings.defaultElementSearch;
      }
      if (defaultElementSearchModeEl) {
        defaultElementSearchModeEl.value = settings.defaultElementSearchMode ?? 'css';
      }
      if (resultsListContextLengthEl) {
        resultsListContextLengthEl.value = String(
          settings.resultsListContextLength ?? DEFAULT_RESULTS_LIST_CONTEXT_LENGTH
        );
      }
      if (autoUpdateSearchEl) {
        autoUpdateSearchEl.checked = settings.autoUpdateSearch ?? true;
      }
      if (overrideCtrlFEl) {
        overrideCtrlFEl.checked = settings.overrideCtrlF ?? false;
      }

      // Apply mutual exclusion rules after loading
      updateMutualExclusion();
    }
  );
}

// Update mutual exclusion rules (same as popup)
function updateMutualExclusion(): void {
  const defaultElementSearchEl = getElementById<HTMLInputElement>('defaultElementSearch');
  const defaultFuzzyEl = getElementById<HTMLInputElement>('defaultFuzzy');
  const defaultCaseSensitiveEl = getElementById<HTMLInputElement>('defaultCaseSensitive');
  const defaultRegexEl = getElementById<HTMLInputElement>('defaultRegex');

  if (!defaultElementSearchEl || !defaultFuzzyEl || !defaultCaseSensitiveEl || !defaultRegexEl) {
    return;
  }

  // Get label elements for visual feedback
  const defaultFuzzyLabel = defaultFuzzyEl.closest('label');
  const defaultCaseSensitiveLabel = defaultCaseSensitiveEl.closest('label');
  const defaultRegexLabel = defaultRegexEl.closest('label');

  const isElementMode = defaultElementSearchEl.checked;
  const isFuzzyMode = defaultFuzzyEl.checked && !isElementMode;

  // When element search is enabled, disable fuzzy, case-sensitive, and regex
  if (isElementMode) {
    defaultFuzzyEl.checked = false;
    defaultFuzzyEl.disabled = true;
    if (defaultFuzzyLabel) {
      defaultFuzzyLabel.classList.add('disabled');
    }
    defaultCaseSensitiveEl.checked = false;
    defaultCaseSensitiveEl.disabled = true;
    if (defaultCaseSensitiveLabel) {
      defaultCaseSensitiveLabel.classList.add('disabled');
    }
    defaultRegexEl.disabled = true;
    if (defaultRegexLabel) {
      defaultRegexLabel.classList.add('disabled');
    }
  } else {
    // When fuzzy search is enabled (and element search is disabled), disable regex and case-sensitive
    if (isFuzzyMode) {
      defaultRegexEl.checked = false;
      defaultRegexEl.disabled = true;
      if (defaultRegexLabel) {
        defaultRegexLabel.classList.add('disabled');
      }
      defaultCaseSensitiveEl.checked = false;
      defaultCaseSensitiveEl.disabled = true;
      if (defaultCaseSensitiveLabel) {
        defaultCaseSensitiveLabel.classList.add('disabled');
      }
    } else {
      defaultRegexEl.disabled = false;
      if (defaultRegexLabel) {
        defaultRegexLabel.classList.remove('disabled');
      }
      defaultCaseSensitiveEl.disabled = false;
      if (defaultCaseSensitiveLabel) {
        defaultCaseSensitiveLabel.classList.remove('disabled');
      }
    }
    defaultFuzzyEl.disabled = false;
    if (defaultFuzzyLabel) {
      defaultFuzzyLabel.classList.remove('disabled');
    }
  }
}

// Save settings
function saveSettings(): void {
  const defaultRegexEl = getElementById<HTMLInputElement>('defaultRegex');
  const defaultCaseSensitiveEl = getElementById<HTMLInputElement>('defaultCaseSensitive');
  const defaultFuzzyEl = getElementById<HTMLInputElement>('defaultFuzzy');
  const defaultElementSearchEl = getElementById<HTMLInputElement>('defaultElementSearch');
  const defaultElementSearchModeEl = getElementById<HTMLSelectElement>('defaultElementSearchMode');
  const resultsListContextLengthEl = getElementById<HTMLInputElement>('resultsListContextLength');
  const autoUpdateSearchEl = getElementById<HTMLInputElement>('autoUpdateSearch');
  const overrideCtrlFEl = getElementById<HTMLInputElement>('overrideCtrlF');

  if (
    !defaultRegexEl ||
    !defaultCaseSensitiveEl ||
    !defaultFuzzyEl ||
    !defaultElementSearchEl ||
    !defaultElementSearchModeEl ||
    !resultsListContextLengthEl ||
    !autoUpdateSearchEl ||
    !overrideCtrlFEl
  ) {
    return;
  }

  const contextLength = Number.parseInt(resultsListContextLengthEl.value, 10);
  const validContextLength =
    !Number.isNaN(contextLength) && contextLength >= 10 && contextLength <= 100
      ? contextLength
      : DEFAULT_RESULTS_LIST_CONTEXT_LENGTH;

  const elementSearchMode = defaultElementSearchModeEl.value as 'css' | 'xpath';
  const validElementSearchMode = elementSearchMode === 'css' || elementSearchMode === 'xpath' ? elementSearchMode : 'css';

  const settings: Settings = {
    defaultRegex: defaultRegexEl.checked,
    defaultCaseSensitive: defaultCaseSensitiveEl.checked,
    defaultFuzzy: defaultFuzzyEl.checked,
    defaultElementSearch: defaultElementSearchEl.checked,
    defaultElementSearchMode: validElementSearchMode,
    resultsListContextLength: validContextLength,
    autoUpdateSearch: autoUpdateSearchEl.checked,
    overrideCtrlF: overrideCtrlFEl.checked,
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
const defaultCaseSensitiveEl = getElementById<HTMLInputElement>('defaultCaseSensitive');
const defaultFuzzyEl = getElementById<HTMLInputElement>('defaultFuzzy');
const defaultElementSearchEl = getElementById<HTMLInputElement>('defaultElementSearch');
const resultsListContextLengthEl = getElementById<HTMLInputElement>('resultsListContextLength');
const autoUpdateSearchEl = getElementById<HTMLInputElement>('autoUpdateSearch');
const overrideCtrlFEl = getElementById<HTMLInputElement>('overrideCtrlF');

if (defaultRegexEl) {
  defaultRegexEl.addEventListener('change', () => {
    updateMutualExclusion();
    saveSettings();
  });
}
if (defaultCaseSensitiveEl) {
  defaultCaseSensitiveEl.addEventListener('change', () => {
    updateMutualExclusion();
    saveSettings();
  });
}
if (defaultFuzzyEl) {
  defaultFuzzyEl.addEventListener('change', () => {
    updateMutualExclusion();
    saveSettings();
  });
}
if (defaultElementSearchEl) {
  defaultElementSearchEl.addEventListener('change', () => {
    updateMutualExclusion();
    saveSettings();
  });
}
const defaultElementSearchModeEl = getElementById<HTMLSelectElement>('defaultElementSearchMode');
if (defaultElementSearchModeEl) {
  defaultElementSearchModeEl.addEventListener('change', saveSettings);
}
if (resultsListContextLengthEl) {
  resultsListContextLengthEl.addEventListener('change', saveSettings);
  resultsListContextLengthEl.addEventListener('blur', saveSettings);
}
if (autoUpdateSearchEl) {
  autoUpdateSearchEl.addEventListener('change', saveSettings);
}
if (overrideCtrlFEl) {
  overrideCtrlFEl.addEventListener('change', saveSettings);
}
