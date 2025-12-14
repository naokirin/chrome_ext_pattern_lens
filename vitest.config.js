import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['content_scripts/**/*.js', 'popup/**/*.js', 'options/**/*.js'],
      exclude: ['tests/**', 'node_modules/**']
    }
  },
});
