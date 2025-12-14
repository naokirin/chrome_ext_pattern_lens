// Load saved settings
function loadSettings() {
  chrome.storage.sync.get(
    {
      defaultRegex: false,
      defaultElementSearch: false,
    },
    (items) => {
      document.getElementById('defaultRegex').checked = items.defaultRegex;
      document.getElementById('defaultElementSearch').checked = items.defaultElementSearch;
    }
  );
}

// Save settings
function saveSettings() {
  const settings = {
    defaultRegex: document.getElementById('defaultRegex').checked,
    defaultElementSearch: document.getElementById('defaultElementSearch').checked,
  };

  chrome.storage.sync.set(settings, () => {
    const statusDiv = document.getElementById('saveStatus');
    statusDiv.style.display = 'block';
    statusDiv.classList.add('success');

    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 2000);
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', loadSettings);

// Auto-save on change
document.getElementById('defaultRegex').addEventListener('change', saveSettings);
document.getElementById('defaultElementSearch').addEventListener('change', saveSettings);
