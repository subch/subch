import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://subch.us',
  outDir: './dist',
  build: {
    format: 'directory',
  },
});
