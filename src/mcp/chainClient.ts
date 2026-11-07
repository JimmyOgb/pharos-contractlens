/**
 * Official Pharos Chain MCP Client
 * Protocol: MCP 2024-11-05 via HTTP SSE
 * Host: https://mcp.pharos.xyz/mcp
 */

import { CONFIG } from '../config/index.ts';
import type { ToolCallTrace } from '../types/index.ts';

export interface ChainInfo {
  name: string;
  chainId: number;
  latestBlock: string;
  rpcUrl: string;
  nativeSymbol: string;
}

export class PharosChainMcpClient {
  private endpoint: string;
  private sessionId: string | null = null;
  private messageId = 1;
  public traces: ToolCallTrace[] = [];

  constructor(endpoint: string = CONFIG.NETWORK.CHAIN_MCP_URL) {
    this.endpoint = endpoint;
  }

  private parseSse(text: string): Record<string, unknown> | null {
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        try {
          return JSON.parse(trimmed.slice(6));
        } catch {
          // ignore parsing error for non-json lines
        }
      }
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  public async initialize(retries = 2): Promise<string> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      const start = Date.now();
      const payload = {
        jsonrpc: '2.0',
        id: this.messageId++,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'pharos-contractlens-agent', version: '1.0.0' },
        },
      };

      try {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'User-Agent': 'Pharos-ContractLens/1.0.0',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(CONFIG.TIMEOUTS.MCP_REQUEST_MS),
        });

        const sid = res.headers.get('mcp-session-id') || `session-${Date.now()}`;
        this.sessionId = sid;
        const text = await res.text();
        const parsed = this.parseSse(text);

        this.traces.push({
          toolName: 'initialize',
          source: 'PHAROS_CHAIN_MCP',
          endpoint: this.endpoint,
          arguments: payload.params,
          responsePreview: `Session initialized (status: ${res.status}, sid: ${sid})`,
          rawResponse: parsed,
          durationMs: Date.now() - start,
          timestamp: new Date().toISOString(),
          status: res.ok ? 'SUCCESS' : 'ERROR',
        });

        // Send notifications/initialized
        try {
          await fetch(this.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json, text/event-stream',
              'mcp-session-id': sid,
            },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          // Non-blocking
        }

        return sid;
      } catch (err: unknown) {
        lastErr = err;
        if (attempt <= retries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }

    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    this.traces.push({
      toolName: 'initialize',
      source: 'PHAROS_CHAIN_MCP',
      endpoint: this.endpoint,
      arguments: {},
      responsePreview: `Initialization failed after retries: ${msg}`,
      durationMs: 0,
      timestamp: new Date().toISOString(),
      status: 'ERROR',
      errorMessage: msg,
    });
    throw new Error(`Failed to initialize Pharos Chain MCP: ${msg}`);
  }

  public async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.sessionId) {
      await this.initialize();
    }

    const start = Date.now();
    const payload = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'User-Agent': 'Pharos-ContractLens/1.0.0',
      };
      if (this.sessionId) {
        headers['mcp-session-id'] = this.sessionId;
      }

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(CONFIG.TIMEOUTS.MCP_REQUEST_MS),
      });

      const text = await res.text();
      const parsed = this.parseSse(text);

      let contentText = '';
      if (parsed && typeof parsed === 'object' && 'result' in parsed) {
        const result = (parsed as { result?: { content?: Array<{ text?: string }> } }).result;
        if (result?.content && Array.isArray(result.content)) {
          contentText = result.content.map(c => c.text || '').join('\n');
        }
      }

      let parsedContent: unknown = contentText;
      try {
        parsedContent = JSON.parse(contentText);
      } catch {
        // Keep as string
      }

      const isError = Boolean((parsed as { isError?: boolean })?.isError || !res.ok);

      this.traces.push({
        toolName: name,
        source: 'PHAROS_CHAIN_MCP',
        endpoint: this.endpoint,
        arguments: args,
        responsePreview: typeof parsedContent === 'string'
          ? (parsedContent.length > 200 ? parsedContent.slice(0, 200) + '...' : parsedContent)
          : JSON.stringify(parsedContent).slice(0, 200),
        rawResponse: parsedContent,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        status: isError ? 'ERROR' : 'SUCCESS',
        errorMessage: isError ? contentText : undefined,
      });

      return parsedContent;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.traces.push({
        toolName: name,
        source: 'PHAROS_CHAIN_MCP',
        endpoint: this.endpoint,
        arguments: args,
        responsePreview: `Tool execution failed: ${msg}`,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        status: 'ERROR',
        errorMessage: msg,
      });
      return { error: msg };
    }
  }

  public async getChainInfo(): Promise<ChainInfo> {
    const raw = (await this.callTool('get_chain_info', {})) as Record<string, unknown>;
    return {
      name: String(raw?.name || 'Pharos'),
      chainId: Number(raw?.chainId || 1672),
      latestBlock: String(raw?.latestBlock || '0'),
      rpcUrl: String(raw?.rpcUrl || CONFIG.NETWORK.RPC_URL),
      nativeSymbol: String(raw?.nativeSymbol || 'PROS'),
    };
  }

  public async getBlockNumber(): Promise<string> {
    const raw = (await this.callTool('get_block_number', {})) as Record<string, unknown>;
    return String(raw?.blockNumber || raw?.latestBlock || '0');
  }

  public async getCode(address: string): Promise<string> {
    const raw = (await this.callTool('get_code', { address })) as Record<string, unknown> | string;
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object') {
      if ('code' in raw) return String(raw.code);
      if ('bytecode' in raw) return String(raw.bytecode);
      if ('result' in raw) return String(raw.result);
    }
    return '0x';
  }

  public async getStorageAt(address: string, position: string): Promise<string> {
    const raw = (await this.callTool('get_storage_at', { address, position })) as Record<string, unknown>;
    if (raw && typeof raw === 'object' && 'value' in raw) return String(raw.value);
    if (raw && typeof raw === 'object' && 'result' in raw) return String(raw.result);
    return '0x0000000000000000000000000000000000000000000000000000000000000000';
  }

  public async ethCall(to: string, data: string): Promise<{ result?: string; error?: string }> {
    const raw = (await this.callTool('eth_call', {
      transaction: { to, data },
    })) as Record<string, unknown>;

    if (raw && typeof raw === 'object') {
      if ('error' in raw) {
        return { error: typeof raw.error === 'object' ? JSON.stringify(raw.error) : String(raw.error) };
      }
      if ('result' in raw) {
        return { result: String(raw.result) };
      }
    }
    return { error: 'Unknown response format from eth_call' };
  }

  public async estimateGas(to: string, data: string, from?: string, value?: string): Promise<{ gasLimit?: string; error?: string }> {
    const raw = (await this.callTool('estimate_gas', {
      transaction: { to, data, from, value },
    })) as Record<string, unknown>;

    if (raw && typeof raw === 'object') {
      if ('gas' in raw) return { gasLimit: String(raw.gas) };
      if ('gasLimit' in raw) return { gasLimit: String(raw.gasLimit) };
      if ('result' in raw) return { gasLimit: String(raw.result) };
      if ('error' in raw) return { error: JSON.stringify(raw.error) };
    }
    return { gasLimit: '100000' };
  }

  public async getBalance(address: string): Promise<string> {
    const raw = (await this.callTool('get_balance', { address })) as Record<string, unknown>;
    if (raw && typeof raw === 'object') {
      if ('balance' in raw) return String(raw.balance);
      if ('balanceWei' in raw) return String(raw.balanceWei);
      if ('result' in raw) return String(raw.result);
    }
    return '0';
  }
}
