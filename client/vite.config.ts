import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@voxelia/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 3000,
  },
});
