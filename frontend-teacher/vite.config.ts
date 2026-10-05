import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    clearMocks: true,
    restoreMocks: true,
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/users': {
        target: process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/v1': {
        target: process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
