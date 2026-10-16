import { defineConfig } from 'vite'

// Vite 產出到 build/，Neutralino 的 documentRoot 與 resourcesPath 都指向它。
// dist/ 保留給 neu build 的輸出（執行檔 + resources.neu），兩者不可共用。
export default defineConfig({
  publicDir: 'resources',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
})
