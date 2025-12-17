/**
 * テスト用非同期ヘルパー関数
 */

/**
 * タイムアウト付きの Promise ラッパー
 * @param {Promise} promise - 待機する Promise
 * @param {number} timeoutMs - タイムアウト時間（ミリ秒）
 * @param {string} message - タイムアウト時のエラーメッセージ
 * @returns {Promise} タイムアウト付きの Promise
 */
export function withTimeout(promise, timeoutMs = 5000, message = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

/**
 * 指定時間待機する Promise
 * @param {number} ms - 待機時間（ミリ秒）
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chrome API メッセージ送信のラッパー（タイムアウト付き）
 * @param {number} tabId - タブ ID
 * @param {object} message - 送信するメッセージ
 * @param {number} timeoutMs - タイムアウト時間（ミリ秒）
 * @returns {Promise<object>} レスポンス
 */
export function sendMessageWithTimeout(tabId, message, timeoutMs = 5000) {
  return withTimeout(
    new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        resolve(response);
      });
    }),
    timeoutMs,
    `sendMessage timed out for action: ${message.action}`
  );
}
