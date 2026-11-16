import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`      → normal site for Cloudflare Pages (needs Supabase)
// `npm run build:demo` → one self-contained HTML file with sample data (double-click to open)
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'demo' ? [viteSingleFile()] : [])],
  base: mode === 'demo' || mode === 'ghpages' ? './' : '/',
  build: mode === 'demo' ? { outDir: 'dist-demo', assetsInlineLimit: 100000000 } : {},
  define: mode === 'demo' ? { 'import.meta.env.VITE_DEMO': JSON.stringify('1') }
    : mode === 'ghpages' ? { 'import.meta.env.VITE_HASH_ROUTER': JSON.stringify('1') } : {},
  server: { port: 5173, host: true },
}));
