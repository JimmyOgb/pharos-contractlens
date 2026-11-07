/**
 * Pharos ContractLens Request Router & Handlers
 * Handles /api/health, /api/analyze, /api/simulate, /api/docs, /api/tools
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { ContractLensAgent } from '../agent/engine.ts';
import { CONFIG } from '../config/index.ts';
import { PharosChainMcpClient } from '../mcp/chainClient.ts';
import { PharosDocsMcpClient } from '../mcp/docsClient.ts';

const agent = new ContractLensAgent();

export async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => {
      resolve({});
    });
  });
}

export function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const jsonStr = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id',
  });
  res.end(jsonStr);
}

export async function handleHealth(res: ServerResponse): Promise<void> {
  sendJson(res, 200, {
    status: 'ok',
    product: 'Pharos ContractLens',
    version: '1.0.0',
    network: CONFIG.NETWORK.CHAIN_NAME,
    chainId: CONFIG.NETWORK.CHAIN_ID,
    rpcUrl: CONFIG.NETWORK.RPC_URL,
    chainMcpEndpoint: CONFIG.NETWORK.CHAIN_MCP_URL,
    docsMcpEndpoint: CONFIG.NETWORK.DOCS_MCP_URL,
    mode: 'Strictly Read-Only Agent (Non-Custodial)',
    timestamp: new Date().toISOString(),
  });
}

export async function handleAnalyze(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const address = String(body.address || '');
  const query = body.query ? String(body.query) : undefined;
  const walletAddress = body.walletAddress ? String(body.walletAddress) : undefined;

  if (!address) {
    sendJson(res, 400, {
      error: 'Missing required field: address',
      status: 'ERROR',
    });
    return;
  }

  try {
    const freshAgent = new ContractLensAgent();
    const result = await freshAgent.analyze({ address, query, walletAddress });
    sendJson(res, 200, result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, {
      error: `Analysis execution failed: ${msg}`,
      status: 'ERROR',
    });
  }
}

export async function handleSimulate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const to = String(body.to || '');
  const data = String(body.data || '0x');
  const from = body.from ? String(body.from) : undefined;
  const value = body.value ? String(body.value) : '0';

  if (!to) {
    sendJson(res, 400, { error: 'Missing required field: to' });
    return;
  }

  try {
    const chainClient = new PharosChainMcpClient();
    await chainClient.initialize();
    const callRes = await chainClient.ethCall(to, data);
    const gasRes = await chainClient.estimateGas(to, data, from, value);

    sendJson(res, 200, {
      success: !callRes.error,
      callResult: callRes.result,
      callError: callRes.error,
      gasEstimated: gasRes.gasLimit,
      gasError: gasRes.error,
      timestamp: new Date().toISOString(),
      traces: chainClient.traces,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: msg });
  }
}

export async function handleDocs(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const query = url.searchParams.get('q') || 'canonical';
  try {
    const docsClient = new PharosDocsMcpClient();
    const result = await docsClient.searchDocs(query);
    sendJson(res, 200, {
      query,
      content: result,
      traces: docsClient.traces,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: msg });
  }
}

export async function handleTools(res: ServerResponse): Promise<void> {
  sendJson(res, 200, {
    integrations: [
      {
        id: 'pharos_chain_mcp',
        name: 'Pharos Chain MCP',
        endpoint: CONFIG.NETWORK.CHAIN_MCP_URL,
        protocol: 'MCP 2024-11-05',
        status: 'OPERATIONAL',
        tools: [
          'get_chain_info',
          'get_block_number',
          'get_balance',
          'get_transaction_count',
          'get_gas_price',
          'get_block',
          'get_transaction',
          'get_transaction_receipt',
          'get_code',
          'get_storage_at',
          'eth_call',
          'estimate_gas',
          'get_logs',
        ],
      },
      {
        id: 'pharos_docs_mcp',
        name: 'Pharos Developer Docs MCP',
        endpoint: CONFIG.NETWORK.DOCS_MCP_URL,
        protocol: 'MCP 2024-11-05',
        status: 'OPERATIONAL',
        tools: ['searchDocumentation', 'getPage', 'askQuestion', 'sendFeedback'],
      },
      {
        id: 'pharos_skill_engine',
        name: 'Pharos Skill Engine',
        source: 'https://github.com/PharosNetwork/pharos-skill-engine',
        status: 'INTEGRATED',
        checks: [
          'RULE-BYTECODE-EXISTS',
          'RULE-PROXY-MUTABILITY',
          'RULE-PRIVILEGED-OWNER',
          'RULE-EMERGENCY-PAUSE',
          'RULE-TOTAL-SUPPLY',
          'RULE-CANONICAL-DOCS',
        ],
      },
    ],
  });
}
