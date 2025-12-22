// WXT Background Script
export default defineBackground(() => {
  // Handle messages from content script
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'open-popup') {
      // Chrome 127以降の場合、chrome.action.openPopup()が利用可能
      if (chrome.action && typeof chrome.action.openPopup === 'function') {
        chrome.action
          .openPopup()
          .then(() => {
            // ポップアップが正常に開かれた
            sendResponse({ success: true });
          })
          .catch((error) => {
            // ポップアップを開けなかった（既に開いている、または権限がないなど）
            console.warn('Failed to open popup:', error);
            sendResponse({ success: false, error: String(error) });
          });
      } else {
        // Chrome 127未満の場合、chrome.action.openPopup()は利用できない
        console.warn(
          'chrome.action.openPopup() is not available. This feature requires Chrome 127 or later.'
        );
        sendResponse({
          success: false,
          error: 'chrome.action.openPopup() is not available',
        });
      }

      // 非同期レスポンスを返すため、trueを返す
      return true;
    }
  });
});
