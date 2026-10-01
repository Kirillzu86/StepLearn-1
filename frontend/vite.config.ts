import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    clearMocks: true,
    restoreMocks: true,
  },
  server: {
    // 1. Позволяет Docker пробрасывать порты (Vite слушает не только внутри сети контейнера)
    host: '0.0.0.0', 
    port: 5173,
    // 2. Важно: разрешаем Vite принимать запросы с вашего домена ngrok
    allowedHosts: [
      'heartenedly-uncommutable-eda.ngrok-free.dev'
    ],
    // 3. Прокси на Django backend (порт 8000)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/users': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/v1': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
    // 4. Настройка для Hot Module Replacement
    hmr: {
      host: 'heartenedly-uncommutable-eda.ngrok-free.dev',
      clientPort: 443,
      protocol: 'wss'
    }
  }
})