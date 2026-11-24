import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const { ML_API_URL = 'http://localhost:8000' } = loadEnv(mode, '.', 'ML_API_URL');
  return {
    plugins: [react(), tailwindcss()],
    server: { proxy: { '/api/ml': { target: ML_API_URL, changeOrigin: true } } },
    preview: { proxy: { '/api/ml': { target: ML_API_URL, changeOrigin: true } } },
  };
});
