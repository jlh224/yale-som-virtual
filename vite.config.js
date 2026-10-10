import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // relative paths so it works on GitHub Pages and locally
  plugins: [react()],
  // /api goes to the FastAPI backend (backend/main.py) during development
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8007' } },
})
