import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: projectRoot,
  envDir: projectRoot,
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [react()],
})
