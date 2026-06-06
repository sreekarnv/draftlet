import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Draftlet',
    description: 'Privacy-first local AI draft replies.',
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
