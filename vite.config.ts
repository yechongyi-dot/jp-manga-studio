import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'public/editor-dist',
    lib: {
      entry: path.resolve(__dirname, 'src/editor/main.tsx'),
      name: 'JpEditor',
      formats: ['iife'],
      fileName: () => 'editor.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: true,
    sourcemap: false,
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, 'src'),
    },
  },
});
