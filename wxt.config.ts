import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'Pattern Lens',
    version: '1.0.0',
    description: 'Enhanced page search with regex and DOM element selector support',
    permissions: ['storage', 'activeTab'],
    icons: {
      16: '/icons/icon16.png',
      48: '/icons/icon48.png',
      128: '/icons/icon128.png',
    },
  },
});
