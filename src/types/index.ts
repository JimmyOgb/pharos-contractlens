/**
 * Pharos ContractLens Core Type Definitions
 * Strict types for Agent Workflow, MCP Tool Calls, Skill Engine Policy & Provenance
 */

export type DecisionState = 'PASS' | 'REVIEW' | 'BLOCK';

export type RiskSeverity = 'SAFE' | 'INFO' | 'WARN' | 'CRITICAL';

export interface ToolCallTrace {
  toolName: string;
  source: 'PHAROS_CHAIN_MCP' | 'PHAROS_DOCS_MCP' | 'PHAROS_SKILL_ENGINE';
  endpoint: string;
  arguments: Record<string, unknown>;
  responsePreview: string;
  rawResponse?: unknown;
  durationMs: number;
  timestamp: string;
  status: 'SUCCESS' | 'ERROR';
  errorMessage?: string;
}

export interface ProvenanceItem {
  field: string;
  sourceType: 'ON_CHAIN_MCP' | 'OFFICIAL_DOCS_MCP' | 'SKILL_ENGINE_INFERENCE' | 'UNAVAILABLE';
  targetAddress: string;
  blockNumber?: string | number;
  storageSlot?: string;
  selector?: string;
  rawHex?: string;
  decodedValue?: string | number | boolean | null;
  docsUrl?: string;
  verifiedAt: string;
}

export interface PolicyCheck {
  id: string;
  title: string;
  description: string;
  severity: RiskSeverity;
  status: 'PASS' | 'WARN' | 'FAIL' | 'UNAVAILABLE';
  observation: string;
  provenance: ProvenanceItem;
}

export interface UnsignedTransaction {
  chainId: number;
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  gasPriceGwei?: string;
  methodName?: string;
  decodedArgs?: Record<string, unknown>;
  safetyNotes: string[];
}

export interface AnalysisResult {
  targetAddress: string;
  userQuery: string;
  connectedWallet?: string;
  timestamp: string;
  chainContext: {
    chainId: number;
    chainName: string;
    latestBlock: string;
    rpcUrl: string;
    mcpSessionId: string;
  };
  contractMetadata: {
    hasBytecode: boolean;
    bytecodeLength: number;
    bytecodeHash: string;
    isProxy: boolean;
    proxyType?: 'EIP-1967' | 'EIP-1822' | 'BEACON' | 'NONE';
    implementationAddress?: string;
    implementationBytecodeLength?: number;
    owner?: string;
    isPaused?: boolean;
    totalSupply?: string;
    canonicalDocsRecord?: {
      name: string;
      category: string;
      docsUrl: string;
      matched: boolean;
    };
  };
  decision: DecisionState;
  decisionJustification: string;
  checks: PolicyCheck[];
  toolTraces: ToolCallTrace[];
  provenanceRegistry: ProvenanceItem[];
  proposedTransaction?: UnsignedTransaction;
  agentSummary: string;
}
