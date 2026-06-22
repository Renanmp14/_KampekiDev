import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy de /api para o backend Express durante o desenvolvimento.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
