import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  manifest: ({ mode }) => {
    const isDevelopment = mode === 'development';

    return {
      name: '__MSG_extName__',
      version: '1.2.3',
      description: '__MSG_extDescription__',
      default_locale: 'ja',
      permissions: ['storage', 'activeTab', 'scripting'],
      icons: {
        16: '/icons/icon16.png',
        48: '/icons/icon48.png',
        128: '/icons/icon128.png',
      },
      options_page: 'settings.html',
      content_security_policy: {
        extension_pages: isDevelopment
          ? "script-src 'self' http://localhost:*; object-src 'self';"
          : "script-src 'self'; object-src 'self';",
      },
    };
  },
});
