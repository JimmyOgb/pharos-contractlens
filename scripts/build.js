/**
 * Production Packaging & Build Pipeline for Pharos ContractLens
 * Bundles standalone ESM modules for local server, library, and Vercel serverless functions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.resolve(ROOT_DIR, 'src');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const API_DIR = path.resolve(ROOT_DIR, 'api');
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');

async function build() {
  console.log('[BUILD] Starting Pharos ContractLens production packaging...');

  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(API_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  // 1. Bundle server (dist/server.js)
  console.log('[BUILD] Bundling server entry point (src/server/index.ts -> dist/server.js)...');
  await esbuild.build({
    entryPoints: [path.join(SRC_DIR, 'server/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    outfile: path.join(DIST_DIR, 'server.js'),
    sourcemap: true,
    packages: 'external',
    banner: {
      js: '// Pharos ContractLens Standalone Server | Pacific Mainnet (Chain ID 1672)\n',
    },
  });

  // 2. Bundle library (dist/index.js)
  console.log('[BUILD] Bundling library entry point (src/index.ts -> dist/index.js)...');
  await esbuild.build({
    entryPoints: [path.join(SRC_DIR, 'index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    outfile: path.join(DIST_DIR, 'index.js'),
    sourcemap: true,
    packages: 'external',
  });

  // 3. Bundle Vercel Serverless Functions in api/*.js
  console.log('[BUILD] Bundling Vercel serverless functions into api/*.js...');
  const serverlessEndpoints = ['health', 'analyze', 'simulate', 'docs', 'tools'];
  for (const ep of serverlessEndpoints) {
    const srcFile = path.join(SRC_DIR, 'api', `${ep}.ts`);
    const outFile = path.join(API_DIR, `${ep}.js`);
    if (fs.existsSync(srcFile)) {
      await esbuild.build({
        entryPoints: [srcFile],
        bundle: true,
        platform: 'node',
        target: 'node22',
        format: 'esm',
        outfile: outFile,
        sourcemap: false,
        packages: 'external',
        banner: {
          js: `// Vercel Serverless Function: /api/${ep}\n`,
        },
      });
      console.log(`  -> Built api/${ep}.js`);
    }
  }

  console.log('[BUILD] Packaging completed successfully.');
}

build().catch((err) => {
  console.error('[BUILD ERROR]', err);
  process.exit(1);
});
