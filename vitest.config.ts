import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Vitest 配置
 *
 * - 环境:happy-dom(纯前端项目,需要 DOM API)
 * - IndexedDB:由 tests/setup.ts 加载 fake-indexeddb
 * - 别名:与 vite.config.ts 一致(@ 指向 src)
 * - 覆盖率:v8,目标 60%(关键模块 80%)
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        // Phase 3 目标 - 当前是入门基线
        // lines: 60,
        // branches: 60,
        // functions: 60,
        // statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
