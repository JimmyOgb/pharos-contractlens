/**
 * Official Pharos Developer Docs MCP Client
 * Protocol: MCP 2024-11-05 via HTTP SSE
 * Host: https://docs.pharos.xyz/~gitbook/mcp
 */

import { CONFIG } from '../config/index.ts';
import type { ToolCallTrace } from '../types/index.ts';

export interface DocSearchResult {
  title: string;
  url: string;
  content: string;
}

export interface CanonicalDocsMatch {
  name: string;
  category: string;
  docsUrl: string;
  description: string;
  matched: boolean;
}

// Canonical Pharos protocol contracts recorded in official documentation
export const CANONICAL_DOCS_REGISTRY: Record<string, { name: string; category: string; description: string; docsUrl: string }> = {
  '0xca11bde05977b3631167028862be2a173976ca11': {
    name: 'MultiCall3',
    category: 'Canonical Infrastructure',
    description: 'Allows bundling multiple EVM calls in a single transaction for consistent reads and atomic state inspection.',
    docsUrl: 'https://docs.pharos.xyz/getting-started/canonical-contracts',
  },
  '0x000000000022d473030f116ddee9f6b43ac78ba3': {
    name: 'Permit2',
    category: 'Approval Infrastructure',
    description: 'Next-generation signature-based token approval router preventing recurring unlimited allowance vulnerabilities.',
    docsUrl: 'https://docs.pharos.xyz/getting-started/canonical-contracts',
  },
  '0x13b0d85ccb8bf860b6b79af3029fca081ae9bef2': {
    name: 'Create2Deployer',
    category: 'Deterministic Deployment',
    description: 'Helper contract for deterministic CREATE2 contract deployment.',
    docsUrl: 'https://docs.pharos.xyz/getting-started/canonical-contracts',
  },
  '0x4e59b44847b379578588920ca78fbf26c0b4956c': {
    name: 'DeterministicDeploymentProxy',
    category: 'Deterministic Deployment',
    description: 'Integrated with Foundry for predictable addresses across chains.',
    docsUrl: 'https://docs.pharos.xyz/getting-started/canonical-contracts',
  },
  '0x0000000071727de22e5e9d8baf0edac6f37da032': {
    name: 'EntryPoint (v0.7.0)',
    category: 'Account Abstraction',
    description: 'ERC-4337 entry point contract managing smart account transactions.',
    docsUrl: 'https://docs.pharos.xyz/getting-started/canonical-contracts',
  },
  '0x69f4d1788e39c87893c980c06edf4b7f686e2938': {
    name: 'GnosisSafe (v1.3.0)',
    category: 'Multi-Sig Governance',
    description: 'Canonical multisignature wallet contract.',
    docsUrl: 'https://docs.pharos.xyz/getting-started/canonical-contracts',
  },
  '0x6b0a44c64190279f7034b77c13a566e914fe5ec4': {
    name: 'Faroo Liquid Staking',
    category: 'DeFi Liquid Staking',
    description: 'Primary liquid staking protocol on Pharos Pacific Mainnet issuing stPROS.',
    docsUrl: 'https://docs.pharos.xyz/ecosystem/defi',
  },
  '0x52c48d4213107b20bc583832b0d951fb9ca8f0b0': {
    name: 'Wrapped PROS (WPROS)',
    category: 'Canonical DeFi Token',
    description: 'Canonical ERC-20 wrapper for native PROS on Pharos Pacific Mainnet.',
    docsUrl: 'https://docs.pharos.xyz/getting-started/tokens',
  },
};

export class PharosDocsMcpClient {
  private endpoint: string;
  private messageId = 1;
  public traces: ToolCallTrace[] = [];

  constructor(endpoint: string = CONFIG.NETWORK.DOCS_MCP_URL) {
    this.endpoint = endpoint;
  }

  private parseSse(text: string): Record<string, unknown> | null {
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        try {
          return JSON.parse(trimmed.slice(6));
        } catch {
          // ignore parsing error
        }
      }
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  public async callTool(name: string, args: Record<string, unknown>): Promise<string> {
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

      const text = await res.text();
      const parsed = this.parseSse(text);

      let contentText = '';
      if (parsed && typeof parsed === 'object' && 'result' in parsed) {
        const result = (parsed as { result?: { content?: Array<{ text?: string }> } }).result;
        if (result?.content && Array.isArray(result.content)) {
          contentText = result.content.map(c => c.text || '').join('\n');
        }
      }

      this.traces.push({
        toolName: name,
        source: 'PHAROS_DOCS_MCP',
        endpoint: this.endpoint,
        arguments: args,
        responsePreview: contentText.length > 200 ? contentText.slice(0, 200) + '...' : contentText,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        status: res.ok && contentText && !contentText.includes('Internal Server Error') ? 'SUCCESS' : 'ERROR',
        errorMessage: contentText.includes('Internal Server Error') ? 'Upstream GitBook search error' : undefined,
      });

      return contentText;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.traces.push({
        toolName: name,
        source: 'PHAROS_DOCS_MCP',
        endpoint: this.endpoint,
        arguments: args,
        responsePreview: `Docs MCP failed: ${msg}`,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        status: 'ERROR',
        errorMessage: msg,
      });
      return '';
    }
  }

  public async searchDocs(query: string): Promise<string> {
    const raw = await this.callTool('searchDocumentation', { query });
    if (raw && !raw.includes('Internal Server Error')) {
      return raw;
    }
    // Honest fallback: if search failed or unindexed, attempt getPage
    return await this.getPage('https://docs.pharos.xyz/getting-started/canonical-contracts');
  }

  public async getPage(url: string): Promise<string> {
    return await this.callTool('getPage', { url });
  }

  public crossReferenceContract(address: string): CanonicalDocsMatch {
    const normalized = address.toLowerCase();
    const entry = CANONICAL_DOCS_REGISTRY[normalized];
    if (entry) {
      return {
        name: entry.name,
        category: entry.category,
        docsUrl: entry.docsUrl,
        description: entry.description,
        matched: true,
      };
    }
    return {
      name: 'Unindexed Contract',
      category: 'Third-Party / Custom Deployment',
      docsUrl: 'https://docs.pharos.xyz',
      description: 'This contract address is not listed among canonical system deployments in official Pharos documentation.',
      matched: false,
    };
  }
}
