/**
 * Pharos ContractLens Agent Engine
 * Core Agentic Execution Loop with Controlled Multi-Tool Orchestration
 * Coordinates Pharos Chain MCP, Docs MCP, and Skill Engine Evaluator
 */

import { CONFIG } from '../config/index.ts';
import { PharosChainMcpClient } from '../mcp/chainClient.ts';
import { PharosDocsMcpClient } from '../mcp/docsClient.ts';
import { SkillEngineEvaluator } from '../skillEngine/evaluator.ts';
import type { AnalysisResult, DecisionState } from '../types/index.ts';

export interface AnalyzeRequest {
  address: string;
  query?: string;
  walletAddress?: string;
}

export class ContractLensAgent {
  private chainMcp: PharosChainMcpClient;
  private docsMcp: PharosDocsMcpClient;
  private evaluator: SkillEngineEvaluator;

  constructor() {
    this.chainMcp = new PharosChainMcpClient();
    this.docsMcp = new PharosDocsMcpClient();
    this.evaluator = new SkillEngineEvaluator();
  }

  private isValidAddress(addr: string): boolean {
    return /^0x[0-9a-fA-F]{40}$/.test(addr.trim());
  }

  private sanitizeQuery(rawQuery?: string): string {
    if (!rawQuery || typeof rawQuery !== 'string') {
      return 'Assess overall contract safety, proxy upgradeability, and privileged controls.';
    }
    // Prevent prompt injection: strip system prompt markers, constrain length
    const cleaned = rawQuery.replace(/<[^>]*>/g, '').trim();
    return cleaned.slice(0, 300) || 'Assess overall contract safety and architecture.';
  }

  public async analyze(req: AnalyzeRequest): Promise<AnalysisResult> {
    const rawAddress = req.address?.trim() || '';
    const userQuery = this.sanitizeQuery(req.query);
    const connectedWallet = req.walletAddress?.trim();

    if (!this.isValidAddress(rawAddress)) {
      return {
        targetAddress: rawAddress,
        userQuery,
        connectedWallet,
        timestamp: new Date().toISOString(),
        chainContext: {
          chainId: CONFIG.NETWORK.CHAIN_ID,
          chainName: CONFIG.NETWORK.CHAIN_NAME,
          latestBlock: '0',
          rpcUrl: CONFIG.NETWORK.RPC_URL,
          mcpSessionId: 'none',
        },
        contractMetadata: {
          hasBytecode: false,
          bytecodeLength: 0,
          bytecodeHash: '0x',
          isProxy: false,
        },
        decision: 'BLOCK',
        decisionJustification: `Invalid EVM address format '${rawAddress}'. Must be a 0x-prefixed 40-character hexadecimal string.`,
        checks: [
          {
            id: 'RULE-ADDRESS-VALIDATION',
            title: 'EVM Address Format Validation',
            description: 'Enforces standard Ethereum / EVM address specification.',
            severity: 'CRITICAL',
            status: 'FAIL',
            observation: `Address '${rawAddress}' failed regex validation (^0x[0-9a-fA-F]{40}$).`,
            provenance: {
              field: 'address_format',
              sourceType: 'SKILL_ENGINE_INFERENCE',
              targetAddress: rawAddress,
              decodedValue: 'INVALID_FORMAT',
              verifiedAt: new Date().toISOString(),
            },
          },
        ],
        toolTraces: [],
        provenanceRegistry: [],
        agentSummary: 'Analysis terminated fail-closed due to malformed target address.',
      };
    }

    const targetAddress = rawAddress.toLowerCase();

    // STEP 1: Chain MCP Initialization & Context
    let mcpSessionId = 'unavailable';
    let chainInfo = { chainId: CONFIG.NETWORK.CHAIN_ID, name: CONFIG.NETWORK.CHAIN_NAME, latestBlock: '0', rpcUrl: CONFIG.NETWORK.RPC_URL, nativeSymbol: 'PROS' };
    let blockNumber = '0';

    try {
      mcpSessionId = await this.chainMcp.initialize();
      chainInfo = await this.chainMcp.getChainInfo();
      blockNumber = await this.chainMcp.getBlockNumber();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        targetAddress,
        userQuery,
        connectedWallet,
        timestamp: new Date().toISOString(),
        chainContext: {
          chainId: CONFIG.NETWORK.CHAIN_ID,
          chainName: CONFIG.NETWORK.CHAIN_NAME,
          latestBlock: '0',
          rpcUrl: CONFIG.NETWORK.RPC_URL,
          mcpSessionId: 'unreachable',
        },
        contractMetadata: {
          hasBytecode: false,
          bytecodeLength: 0,
          bytecodeHash: '0x',
          isProxy: false,
        },
        decision: 'REVIEW',
        decisionJustification: `Upstream Chain MCP unreachable (${msg}). Fail-closed: Cannot confirm contract bytecode or security properties.`,
        checks: [
          {
            id: 'RULE-UPSTREAM-MCP-HEALTH',
            title: 'Upstream Chain MCP Connectivity',
            description: 'Enforces live operational connection to official Pharos Chain MCP.',
            severity: 'CRITICAL',
            status: 'UNAVAILABLE',
            observation: `Connection to ${CONFIG.NETWORK.CHAIN_MCP_URL} failed: ${msg}. Evaluation suspended.`,
            provenance: {
              field: 'upstream_mcp',
              sourceType: 'UNAVAILABLE',
              targetAddress,
              decodedValue: 'UPSTREAM_ERROR',
              verifiedAt: new Date().toISOString(),
            },
          },
        ],
        toolTraces: this.chainMcp.traces,
        provenanceRegistry: [],
        agentSummary: 'Analysis suspended: Upstream Pharos Chain MCP could not be reached.',
      };
    }

    // STEP 2: Bytecode Inspection
    const bytecode = await this.chainMcp.getCode(targetAddress);
    const cleanBytecode = bytecode.trim().toLowerCase();
    const hasBytecode = cleanBytecode !== '0x' && cleanBytecode.length > 2;
    const bytecodeLength = hasBytecode ? (cleanBytecode.length - 2) / 2 : 0;

    // STEP 3: Proxy & Storage Slot Inspection
    const eip1967ImplSlot = await this.chainMcp.getStorageAt(
      targetAddress,
      CONFIG.SLOTS.EIP_1967_IMPLEMENTATION
    );
    const eip1967BeaconSlot = await this.chainMcp.getStorageAt(
      targetAddress,
      CONFIG.SLOTS.EIP_1967_BEACON
    );

    // STEP 4: State Introspection via eth_call
    const ownerResult = await this.chainMcp.ethCall(targetAddress, CONFIG.SELECTORS.OWNER);
    const pausedResult = await this.chainMcp.ethCall(targetAddress, CONFIG.SELECTORS.PAUSED);
    const totalSupplyResult = await this.chainMcp.ethCall(targetAddress, CONFIG.SELECTORS.TOTAL_SUPPLY);

    // STEP 5: Docs MCP Cross-Reference
    const canonicalDocs = this.docsMcp.crossReferenceContract(targetAddress);
    await this.docsMcp.searchDocs(canonicalDocs.matched ? canonicalDocs.name : targetAddress);

    // STEP 6: Skill Engine Policy Evaluation
    const evaluation = this.evaluator.evaluate({
      targetAddress,
      userQuery,
      bytecode,
      blockNumber,
      eip1967ImplSlot,
      eip1967BeaconSlot,
      ownerResult,
      pausedResult,
      totalSupplyResult,
      canonicalDocs,
      walletAddress: connectedWallet,
    });

    // STEP 7: Implementation Bytecode Inspection if Proxy
    let implBytecodeLength: number | undefined;
    if (evaluation.isProxy && evaluation.implementationAddress) {
      const implBytecode = await this.chainMcp.getCode(evaluation.implementationAddress);
      const cleanImpl = implBytecode.trim().toLowerCase();
      if (cleanImpl !== '0x') {
        implBytecodeLength = (cleanImpl.length - 2) / 2;
      }
    }

    // STEP 8: Gas Estimation Simulation for Proposed Interaction
    if (evaluation.proposedTx) {
      const gasEst = await this.chainMcp.estimateGas(
        evaluation.proposedTx.to,
        evaluation.proposedTx.data,
        connectedWallet,
        evaluation.proposedTx.value
      );
      if (gasEst.gasLimit) {
        evaluation.proposedTx.gasLimit = gasEst.gasLimit;
      }
    }

    // Combine traces
    const allTraces = [...this.chainMcp.traces, ...this.docsMcp.traces];

    // Synthesize Agent Summary
    const agentSummary = this.buildAgentSummary(
      targetAddress,
      userQuery,
      evaluation.decision,
      evaluation.isProxy,
      evaluation.implementationAddress,
      evaluation.ownerAddress,
      evaluation.isPaused,
      canonicalDocs,
      blockNumber
    );

    return {
      targetAddress,
      userQuery,
      connectedWallet,
      timestamp: new Date().toISOString(),
      chainContext: {
        chainId: chainInfo.chainId || CONFIG.NETWORK.CHAIN_ID,
        chainName: chainInfo.name || CONFIG.NETWORK.CHAIN_NAME,
        latestBlock: blockNumber,
        rpcUrl: chainInfo.rpcUrl || CONFIG.NETWORK.RPC_URL,
        mcpSessionId,
      },
      contractMetadata: {
        hasBytecode,
        bytecodeLength,
        bytecodeHash: bytecode.slice(0, 18) + '...',
        isProxy: evaluation.isProxy,
        proxyType: evaluation.proxyType,
        implementationAddress: evaluation.implementationAddress,
        implementationBytecodeLength: implBytecodeLength,
        owner: evaluation.ownerAddress,
        isPaused: evaluation.isPaused,
        totalSupply: evaluation.totalSupply,
        canonicalDocsRecord: {
          name: canonicalDocs.name,
          category: canonicalDocs.category,
          docsUrl: canonicalDocs.docsUrl,
          matched: canonicalDocs.matched,
        },
      },
      decision: evaluation.decision,
      decisionJustification: evaluation.justification,
      checks: evaluation.checks,
      toolTraces: allTraces,
      provenanceRegistry: evaluation.provenance,
      proposedTransaction: evaluation.proposedTx,
      agentSummary,
    };
  }

  private buildAgentSummary(
    address: string,
    query: string,
    decision: DecisionState,
    isProxy: boolean,
    implAddr: string | undefined,
    ownerAddr: string | undefined,
    isPaused: boolean,
    canonicalDocs: { name: string; matched: boolean },
    blockNumber: string
  ): string {
    const lines: string[] = [];
    lines.push(`### Pharos ContractLens Agent Assessment — Target: \`${address}\``);
    lines.push(`**User Query:** "${query}"`);
    lines.push(`**Evaluated at Block:** #${blockNumber} (Pharos Pacific Mainnet, Chain ID 1672)`);
    lines.push('');

    if (decision === 'BLOCK') {
      lines.push('🛑 **FINAL DECISION: BLOCK**');
      lines.push('The requested interaction violates core safety constraints. Reasons include zero runtime bytecode, active emergency pause, or execution revert on basic call introspection.');
    } else if (decision === 'REVIEW') {
      lines.push('⚠️ **FINAL DECISION: REVIEW**');
      lines.push(`The contract is executable but has privileged controls requiring human due diligence.`);
      if (isProxy) {
        lines.push(`- **Upgradeable Proxy:** Routes execution to implementation \`${implAddr}\`. The admin can change contract logic at any time.`);
      }
      if (ownerAddr) {
        lines.push(`- **Centralized Admin:** Privileged owner detected at \`${ownerAddr}\`.`);
      }
    } else {
      lines.push('✅ **FINAL DECISION: PASS**');
      lines.push('The evaluated contract passed all defined on-chain safety gates. Runtime bytecode is verified, no malicious storage overrides were detected, and no active emergency pause is present.');
      if (canonicalDocs.matched) {
        lines.push(`- **Official Canonical Deployment:** Matches official Pharos documentation for **${canonicalDocs.name}**.`);
      }
    }

    lines.push('');
    lines.push('> *Disclaimer: ContractLens is an AI due-diligence assistant, not a formal security audit. Always verify transaction parameters in your wallet before signing.*');

    return lines.join('\n');
  }
}
