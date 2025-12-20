// Import shared type definitions
import {
  DEFAULT_RESULTS_LIST_CONTEXT_LENGTH,
  FUZZY_SEARCH_BASE_MULTIPLIER,
  FUZZY_SEARCH_MAX_DISTANCE,
  FUZZY_SEARCH_MIN_DISTANCE,
} from '~/lib/constants';
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
      fuzzySearchBaseMultiplier: FUZZY_SEARCH_BASE_MULTIPLIER, // デフォルト倍率
      fuzzySearchMinDistance: FUZZY_SEARCH_MIN_DISTANCE, // デフォルト最小範囲
      fuzzySearchMaxDistance: FUZZY_SEARCH_MAX_DISTANCE, // デフォルト最大範囲
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
      const fuzzySearchBaseMultiplierEl = getElementById<HTMLInputElement>(
        'fuzzySearchBaseMultiplier'
      );
      const fuzzySearchMinDistanceEl = getElementById<HTMLInputElement>('fuzzySearchMinDistance');
      const fuzzySearchMaxDistanceEl = getElementById<HTMLInputElement>('fuzzySearchMaxDistance');

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
      if (fuzzySearchBaseMultiplierEl) {
        fuzzySearchBaseMultiplierEl.value = String(
          settings.fuzzySearchBaseMultiplier ?? FUZZY_SEARCH_BASE_MULTIPLIER
        );
      }
      if (fuzzySearchMinDistanceEl) {
        fuzzySearchMinDistanceEl.value = String(
          settings.fuzzySearchMinDistance ?? FUZZY_SEARCH_MIN_DISTANCE
        );
      }
      if (fuzzySearchMaxDistanceEl) {
        fuzzySearchMaxDistanceEl.value = String(
          settings.fuzzySearchMaxDistance ?? FUZZY_SEARCH_MAX_DISTANCE
        );
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
  const fuzzySearchBaseMultiplierEl = getElementById<HTMLInputElement>('fuzzySearchBaseMultiplier');
  const fuzzySearchMinDistanceEl = getElementById<HTMLInputElement>('fuzzySearchMinDistance');
  const fuzzySearchMaxDistanceEl = getElementById<HTMLInputElement>('fuzzySearchMaxDistance');

  if (
    !defaultRegexEl ||
    !defaultCaseSensitiveEl ||
    !defaultFuzzyEl ||
    !defaultElementSearchEl ||
    !defaultElementSearchModeEl ||
    !resultsListContextLengthEl ||
    !autoUpdateSearchEl ||
    !overrideCtrlFEl ||
    !fuzzySearchBaseMultiplierEl ||
    !fuzzySearchMinDistanceEl ||
    !fuzzySearchMaxDistanceEl
  ) {
    return;
  }

  const contextLength = Number.parseInt(resultsListContextLengthEl.value, 10);
  const validContextLength =
    !Number.isNaN(contextLength) && contextLength >= 10 && contextLength <= 100
      ? contextLength
      : DEFAULT_RESULTS_LIST_CONTEXT_LENGTH;

  const elementSearchMode = defaultElementSearchModeEl.value as 'css' | 'xpath';
  const validElementSearchMode =
    elementSearchMode === 'css' || elementSearchMode === 'xpath' ? elementSearchMode : 'css';

  const fuzzySearchBaseMultiplier = Number.parseInt(fuzzySearchBaseMultiplierEl.value, 10);
  const validFuzzySearchBaseMultiplier =
    !Number.isNaN(fuzzySearchBaseMultiplier) &&
    fuzzySearchBaseMultiplier >= 1 &&
    fuzzySearchBaseMultiplier <= 20
      ? fuzzySearchBaseMultiplier
      : FUZZY_SEARCH_BASE_MULTIPLIER;

  const fuzzySearchMinDistance = Number.parseInt(fuzzySearchMinDistanceEl.value, 10);
  const validFuzzySearchMinDistance =
    !Number.isNaN(fuzzySearchMinDistance) &&
    fuzzySearchMinDistance >= 1 &&
    fuzzySearchMinDistance <= 100
      ? fuzzySearchMinDistance
      : FUZZY_SEARCH_MIN_DISTANCE;

  const fuzzySearchMaxDistance = Number.parseInt(fuzzySearchMaxDistanceEl.value, 10);
  const validFuzzySearchMaxDistance =
    !Number.isNaN(fuzzySearchMaxDistance) &&
    fuzzySearchMaxDistance >= 50 &&
    fuzzySearchMaxDistance <= 1000
      ? fuzzySearchMaxDistance
      : FUZZY_SEARCH_MAX_DISTANCE;

  const settings: Settings = {
    defaultRegex: defaultRegexEl.checked,
    defaultCaseSensitive: defaultCaseSensitiveEl.checked,
    defaultFuzzy: defaultFuzzyEl.checked,
    defaultElementSearch: defaultElementSearchEl.checked,
    defaultElementSearchMode: validElementSearchMode,
    resultsListContextLength: validContextLength,
    autoUpdateSearch: autoUpdateSearchEl.checked,
    overrideCtrlF: overrideCtrlFEl.checked,
    fuzzySearchBaseMultiplier: validFuzzySearchBaseMultiplier,
    fuzzySearchMinDistance: validFuzzySearchMinDistance,
    fuzzySearchMaxDistance: validFuzzySearchMaxDistance,
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
const fuzzySearchBaseMultiplierEl = getElementById<HTMLInputElement>('fuzzySearchBaseMultiplier');
if (fuzzySearchBaseMultiplierEl) {
  fuzzySearchBaseMultiplierEl.addEventListener('change', saveSettings);
  fuzzySearchBaseMultiplierEl.addEventListener('blur', saveSettings);
}
const fuzzySearchMinDistanceEl = getElementById<HTMLInputElement>('fuzzySearchMinDistance');
if (fuzzySearchMinDistanceEl) {
  fuzzySearchMinDistanceEl.addEventListener('change', saveSettings);
  fuzzySearchMinDistanceEl.addEventListener('blur', saveSettings);
}
const fuzzySearchMaxDistanceEl = getElementById<HTMLInputElement>('fuzzySearchMaxDistance');
if (fuzzySearchMaxDistanceEl) {
  fuzzySearchMaxDistanceEl.addEventListener('change', saveSettings);
  fuzzySearchMaxDistanceEl.addEventListener('blur', saveSettings);
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
