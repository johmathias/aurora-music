import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Builds dist/sw.js from src-sw/sw.template.js by filling in the list of every
 * file the app needs to run offline (the "app shell"). Your music is NOT in this
 * list - songs live in IndexedDB, completely separate from this cache.
 */
function serviceWorkerPlugin(): Plugin {
  const walk = (dir: string, base = ''): string[] =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
          d.isDirectory() ? walk(path.join(dir, d.name), base + d.name + '/') : [base + d.name],
        )
      : [];

  return {
    name: 'aurora-service-worker',
    apply: 'build',
    writeBundle(options, bundle) {
      const outDir = options.dir ?? 'dist';
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const publicFiles = walk('public').filter((f) => f !== 'sw.js');
      const files = Array.from(new Set(['./', ...built, ...publicFiles]));
      const version = crypto.createHash('sha1').update(files.join('|') + built.map((f) => {
        const item = bundle[f];
        return item.type === 'chunk' ? item.code.length : String((item as { source: string | Uint8Array }).source.length);
      }).join(',')).digest('hex').slice(0, 10);
      const template = fs.readFileSync('src-sw/sw.template.js', 'utf8');
      const output = template
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(files, null, 2));
      fs.writeFileSync(path.join(outDir, 'sw.js'), output);
    },
  };
}

export default defineConfig({
  base: './', // relative paths so the app works at any URL (GitHub Pages, Netlify, ...)
  plugins: [react(), serviceWorkerPlugin()],
  build: {
    target: 'safari14',
    cssTarget: 'safari14',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
  server: { host: true, port: 5173 },
});
