// Import shared type definitions
import type { Settings } from '~/lib/types';

// Load saved settings
function loadSettings(): void {
  chrome.storage.sync.get(
    {
      defaultRegex: false,
      defaultCaseSensitive: false,
      defaultElementSearch: false,
    },
    (items) => {
      const settings = items as Settings;
      const defaultRegexEl = document.getElementById('defaultRegex') as HTMLInputElement;
      const defaultElementSearchEl = document.getElementById(
        'defaultElementSearch'
      ) as HTMLInputElement;

      if (defaultRegexEl) {
        defaultRegexEl.checked = settings.defaultRegex;
      }
      if (defaultElementSearchEl) {
        defaultElementSearchEl.checked = settings.defaultElementSearch;
      }
      // Note: defaultCaseSensitive is not shown in options page UI
    }
  );
}

// Save settings
function saveSettings(): void {
  const defaultRegexEl = document.getElementById('defaultRegex') as HTMLInputElement;
  const defaultElementSearchEl = document.getElementById(
    'defaultElementSearch'
  ) as HTMLInputElement;

  if (!defaultRegexEl || !defaultElementSearchEl) {
    return;
  }

  const settings: Settings = {
    defaultRegex: defaultRegexEl.checked,
    defaultCaseSensitive: false, // Options page doesn't have this setting
    defaultElementSearch: defaultElementSearchEl.checked,
  };

  chrome.storage.sync.set(settings, () => {
    const statusDiv = document.getElementById('saveStatus') as HTMLDivElement;
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
const defaultRegexEl = document.getElementById('defaultRegex') as HTMLInputElement;
const defaultElementSearchEl = document.getElementById('defaultElementSearch') as HTMLInputElement;

if (defaultRegexEl) {
  defaultRegexEl.addEventListener('change', saveSettings);
}
if (defaultElementSearchEl) {
  defaultElementSearchEl.addEventListener('change', saveSettings);
}
