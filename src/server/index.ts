/**
 * Pharos ContractLens Standalone Server
 * Serves API endpoints and static frontend assets
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../config/index.ts';
import {
  handleHealth,
  handleAnalyze,
  handleSimulate,
  handleDocs,
  handleTools,
  sendJson,
} from './router.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../../public');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export const server = http.createServer(async (req, res) => {
  const reqUrl = req.url || '/';
  const url = new URL(reqUrl, `http://localhost:${CONFIG.PORT}`);
  const pathname = url.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id',
    });
    res.end();
    return;
  }

  // API Routes
  if (pathname === '/api/health') {
    return handleHealth(res);
  }
  if (pathname === '/api/analyze' && req.method === 'POST') {
    return handleAnalyze(req, res);
  }
  if (pathname === '/api/simulate' && req.method === 'POST') {
    return handleSimulate(req, res);
  }
  if (pathname === '/api/docs') {
    return handleDocs(req, res, url);
  }
  if (pathname === '/api/tools') {
    return handleTools(res);
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    sendJson(res, 404, { error: 'Not Found' });
  }
});

// Auto-start if directly executed
if (process.env.NODE_ENV !== 'test') {
  server.listen(CONFIG.PORT, () => {
    console.log(`[ContractLens] Server running on http://localhost:${CONFIG.PORT}`);
    console.log(`[ContractLens] Pharos Pacific Mainnet (Chain ID: ${CONFIG.NETWORK.CHAIN_ID})`);
    console.log(`[ContractLens] Mode: Strictly Read-Only Agent (Non-Custodial)`);
  });
}
