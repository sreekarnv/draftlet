import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

const reactPath = require.resolve('react');
const reactJsxRuntimePath = require.resolve('react/jsx-runtime');
const reactJsxDevRuntimePath = require.resolve('react/jsx-dev-runtime');

export default defineConfig({
  resolve: {
    alias: [
      { find: 'react/jsx-dev-runtime', replacement: reactJsxDevRuntimePath },
      { find: 'react/jsx-runtime', replacement: reactJsxRuntimePath },
      { find: 'react', replacement: reactPath },
    ],
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    server: {
      deps: {
        inline: ['react-hook-form'],
      },
    },
  },
});
