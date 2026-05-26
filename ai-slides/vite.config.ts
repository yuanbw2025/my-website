import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/ai-slides/',
  server: { port: 5176, open: true },
  build: { outDir: 'dist' },
})
