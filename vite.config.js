import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // three.js is lazy-loaded in its own chunk; it's expected to be large.
  build: { chunkSizeWarningLimit: 800 },
});
