import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: '../public',
  server: { fs: { allow: ['..'] } },
});
