/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Use '/' for username.github.io, or '/repository-name/' for project pages
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      // Each page is its own entry, so the portfolio never loads the map code.
      input: {
        main: page('./index.html'),
        propertyFinder: page('./property-finder/index.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
