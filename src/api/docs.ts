import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleDocs } from '../server/router.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }
  const url = new URL(req.url || '/', 'http://localhost');
  return handleDocs(req, res, url);
}
