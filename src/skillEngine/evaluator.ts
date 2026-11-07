/**
 * Pharos Skill Engine Policy Evaluator
 * Deterministic rule-based evaluation of on-chain bytecode, storage slots, and documentation
 * Produces PASS, REVIEW, or BLOCK decision states strictly backed by evidence
 */

import { CONFIG } from '../config/index.ts';
import type { CanonicalDocsMatch } from '../mcp/docsClient.ts';
import type { DecisionState, PolicyCheck, ProvenanceItem, UnsignedTransaction } from '../types/index.ts';

export interface EvaluatorInput {
  targetAddress: string;
  userQuery: string;
  bytecode: string;
  blockNumber: string;
  eip1967ImplSlot: string;
  eip1967BeaconSlot: string;
  ownerResult: { result?: string; error?: string };
  pausedResult: { result?: string; error?: string };
  totalSupplyResult: { result?: string; error?: string };
  canonicalDocs: CanonicalDocsMatch;
  gasSimulation?: { gasLimit?: string; error?: string };
  walletAddress?: string;
}

export interface EvaluatorOutput {
  decision: DecisionState;
  justification: string;
  checks: PolicyCheck[];
  provenance: ProvenanceItem[];
  proposedTx?: UnsignedTransaction;
  isProxy: boolean;
  proxyType: 'EIP-1967' | 'EIP-1822' | 'BEACON' | 'NONE';
  implementationAddress?: string;
  ownerAddress?: string;
  isPaused: boolean;
  totalSupply?: string;
}

export class SkillEngineEvaluator {
  private cleanHex(val: string): string {
    return val.startsWith('0x') ? val.slice(2) : val;
  }

  private extractAddressFromWord(wordHex: string): string | null {
    const cleaned = this.cleanHex(wordHex).toLowerCase();
    if (cleaned.length < 40) return null;
    const addrHex = '0x' + cleaned.slice(-40);
    if (addrHex === '0x0000000000000000000000000000000000000000') return null;
    return addrHex;
  }

  public evaluate(input: EvaluatorInput): EvaluatorOutput {
    const checks: PolicyCheck[] = [];
    const provenance: ProvenanceItem[] = [];
    const now = new Date().toISOString();

    const normalizedTarget = input.targetAddress.toLowerCase();
    const cleanBytecode = input.bytecode.trim().toLowerCase();
    const hasBytecode = cleanBytecode !== '0x' && cleanBytecode.length > 2;
    const bytecodeLength = hasBytecode ? (cleanBytecode.length - 2) / 2 : 0;

    // 1. Bytecode Presence Check
    provenance.push({
      field: 'runtime_bytecode',
      sourceType: 'ON_CHAIN_MCP',
      targetAddress: input.targetAddress,
      blockNumber: input.blockNumber,
      rawHex: cleanBytecode.length > 64 ? cleanBytecode.slice(0, 64) + '...' : cleanBytecode,
      decodedValue: `Length: ${bytecodeLength} bytes`,
      verifiedAt: now,
    });

    if (!hasBytecode) {
      checks.push({
        id: 'RULE-BYTECODE-EXISTS',
        title: 'Contract Bytecode Existence',
        description: 'Verifies the target address contains deployed executable EVM runtime bytecode.',
        severity: 'CRITICAL',
        status: 'FAIL',
        observation: 'Target address has zero bytecode (0x). It is an EOA or uninitialized address.',
        provenance: provenance[provenance.length - 1],
      });

      return {
        decision: 'BLOCK',
        justification: 'The target address contains no deployed contract bytecode. Attempting contract interactions with an empty account or EOA is unsafe and will fail.',
        checks,
        provenance,
        isProxy: false,
        proxyType: 'NONE',
        isPaused: false,
      };
    }

    checks.push({
      id: 'RULE-BYTECODE-EXISTS',
      title: 'Contract Bytecode Existence',
      description: 'Verifies the target address contains deployed executable EVM runtime bytecode.',
      severity: 'SAFE',
      status: 'PASS',
      observation: `Contract contains ${bytecodeLength} bytes of executable EVM bytecode.`,
      provenance: provenance[provenance.length - 1],
    });

    // 2. Proxy and Implementation Detection (EIP-1967 & Beacon)
    const implAddr = this.extractAddressFromWord(input.eip1967ImplSlot);
    const beaconAddr = this.extractAddressFromWord(input.eip1967BeaconSlot);
    const isProxy = Boolean(implAddr || beaconAddr);
    const proxyType = implAddr ? 'EIP-1967' : beaconAddr ? 'BEACON' : 'NONE';

    provenance.push({
      field: 'eip1967_implementation_slot',
      sourceType: 'ON_CHAIN_MCP',
      targetAddress: input.targetAddress,
      blockNumber: input.blockNumber,
      storageSlot: CONFIG.SLOTS.EIP_1967_IMPLEMENTATION,
      rawHex: input.eip1967ImplSlot,
      decodedValue: implAddr || 'Zero Address (Non-Proxy or Non-EIP-1967)',
      verifiedAt: now,
    });

    if (isProxy) {
      checks.push({
        id: 'RULE-PROXY-MUTABILITY',
        title: 'Proxy Implementation Mutability',
        description: 'Detects whether the contract routes logic to an external implementation that can be upgraded or altered.',
        severity: 'WARN',
        status: 'WARN',
        observation: `Contract is an upgradeable proxy (${proxyType}). Current active implementation is ${implAddr || beaconAddr}. Upgrades can modify contract behavior.`,
        provenance: provenance[provenance.length - 1],
      });
    } else {
      checks.push({
        id: 'RULE-PROXY-MUTABILITY',
        title: 'Proxy Implementation Mutability',
        description: 'Detects whether the contract routes logic to an external implementation that can be upgraded or altered.',
        severity: 'SAFE',
        status: 'PASS',
        observation: 'EIP-1967 storage slot is zero. No standard proxy delegation detected.',
        provenance: provenance[provenance.length - 1],
      });
    }

    // 3. Privileged Ownership Inspection
    let ownerAddress: string | undefined;
    if (input.ownerResult.result) {
      const decodedOwner = this.extractAddressFromWord(input.ownerResult.result);
      if (decodedOwner) {
        ownerAddress = decodedOwner;
      }
    }

    provenance.push({
      field: 'owner_address',
      sourceType: input.ownerResult.result ? 'ON_CHAIN_MCP' : 'UNAVAILABLE',
      targetAddress: input.targetAddress,
      blockNumber: input.blockNumber,
      selector: CONFIG.SELECTORS.OWNER,
      rawHex: input.ownerResult.result || input.ownerResult.error || '0x',
      decodedValue: ownerAddress || 'None/Reverted (Immutable or custom governance)',
      verifiedAt: now,
    });

    if (ownerAddress) {
      checks.push({
        id: 'RULE-PRIVILEGED-OWNER',
        title: 'Privileged Administrative Role',
        description: 'Identifies the administrative controller capable of executing privileged state-modifying functions.',
        severity: 'WARN',
        status: 'WARN',
        observation: `Privileged owner detected: ${ownerAddress}. Centralized control risk applies.`,
        provenance: provenance[provenance.length - 1],
      });
    } else {
      checks.push({
        id: 'RULE-PRIVILEGED-OWNER',
        title: 'Privileged Administrative Role',
        description: 'Identifies the administrative controller capable of executing privileged state-modifying functions.',
        severity: 'SAFE',
        status: 'PASS',
        observation: 'Standard owner() method not exposed or ownership renounced. Decentralized or immutable dispatch.',
        provenance: provenance[provenance.length - 1],
      });
    }

    // 4. Emergency Pause Controls
    let isPaused = false;
    if (input.pausedResult.result) {
      const cleaned = this.cleanHex(input.pausedResult.result);
      isPaused = cleaned.endsWith('1');
    }

    provenance.push({
      field: 'pause_status',
      sourceType: input.pausedResult.result ? 'ON_CHAIN_MCP' : 'UNAVAILABLE',
      targetAddress: input.targetAddress,
      blockNumber: input.blockNumber,
      selector: CONFIG.SELECTORS.PAUSED,
      rawHex: input.pausedResult.result || input.pausedResult.error || '0x',
      decodedValue: input.pausedResult.result ? (isPaused ? 'PAUSED' : 'ACTIVE') : 'No pause function detected',
      verifiedAt: now,
    });

    if (isPaused) {
      checks.push({
        id: 'RULE-EMERGENCY-PAUSE',
        title: 'Emergency Pause Status',
        description: 'Verifies whether the contract is currently halted under an emergency circuit breaker.',
        severity: 'CRITICAL',
        status: 'FAIL',
        observation: 'Contract is currently in an EMERGENCY PAUSED state. Interactions will revert.',
        provenance: provenance[provenance.length - 1],
      });
    } else {
      checks.push({
        id: 'RULE-EMERGENCY-PAUSE',
        title: 'Emergency Pause Status',
        description: 'Verifies whether the contract is currently halted under an emergency circuit breaker.',
        severity: 'SAFE',
        status: 'PASS',
        observation: input.pausedResult.result
          ? 'Contract is currently ACTIVE (unpaused).'
          : 'No standard paused() circuit breaker detected.',
        provenance: provenance[provenance.length - 1],
      });
    }

    // 5. Total Supply & Token Characteristics
    let totalSupplyFormatted: string | undefined;
    if (input.totalSupplyResult.result) {
      try {
        const rawHex = this.cleanHex(input.totalSupplyResult.result);
        if (rawHex && rawHex !== '0'.repeat(64)) {
          const supplyBigInt = BigInt('0x' + rawHex);
          totalSupplyFormatted = supplyBigInt.toString();
        }
      } catch {
        // invalid hex
      }
    }

    provenance.push({
      field: 'total_supply',
      sourceType: input.totalSupplyResult.result ? 'ON_CHAIN_MCP' : 'UNAVAILABLE',
      targetAddress: input.targetAddress,
      blockNumber: input.blockNumber,
      selector: CONFIG.SELECTORS.TOTAL_SUPPLY,
      rawHex: input.totalSupplyResult.result || '0x',
      decodedValue: totalSupplyFormatted ? `${totalSupplyFormatted} (raw uint256)` : 'N/A (Not an ERC20/ERC4626 supply)',
      verifiedAt: now,
    });

    // 6. Canonical Documentation Cross-Reference
    provenance.push({
      field: 'canonical_docs_alignment',
      sourceType: 'OFFICIAL_DOCS_MCP',
      targetAddress: input.targetAddress,
      docsUrl: input.canonicalDocs.docsUrl,
      decodedValue: input.canonicalDocs.matched
        ? `${input.canonicalDocs.name} (${input.canonicalDocs.category})`
        : 'Unindexed Third-Party Contract',
      verifiedAt: now,
    });

    if (input.canonicalDocs.matched) {
      checks.push({
        id: 'RULE-CANONICAL-DOCS',
        title: 'Official Documentation Alignment',
        description: 'Cross-references the target address against canonical deployments in official Pharos documentation.',
        severity: 'SAFE',
        status: 'PASS',
        observation: `Officially documented canonical contract: ${input.canonicalDocs.name} (${input.canonicalDocs.category}).`,
        provenance: provenance[provenance.length - 1],
      });
    } else {
      checks.push({
        id: 'RULE-CANONICAL-DOCS',
        title: 'Official Documentation Alignment',
        description: 'Cross-references the target address against canonical deployments in official Pharos documentation.',
        severity: 'INFO',
        status: 'WARN',
        observation: 'Address is not listed among canonical system deployments in official Pharos documentation. Treat with appropriate due diligence.',
        provenance: provenance[provenance.length - 1],
      });
    }

    // 7. Determine Final Decision State
    let decision: DecisionState = 'PASS';
    let justification = '';

    if (isPaused) {
      decision = 'BLOCK';
      justification = 'Interaction blocked: The contract is currently halted by an active emergency pause. Transacting with it is unsafe and will result in execution reverts.';
    } else if (isProxy) {
      decision = 'REVIEW';
      justification = `Manual review required: Contract operates via an upgradeable proxy (implementation: ${implAddr || beaconAddr}). The underlying logic can be modified by the admin key. Verify the implementation before high-value approvals.`;
    } else if (!input.canonicalDocs.matched && ownerAddress) {
      decision = 'REVIEW';
      justification = `Due-diligence review advised: Contract is governed by an individual owner (${ownerAddress}) and is not an officially documented Pharos canonical infrastructure contract. Verify terms and permissions before interacting.`;
    } else if (input.canonicalDocs.matched) {
      decision = 'PASS';
      justification = `Interaction approved under reviewed checks: Target contract is verified canonical Pharos infrastructure (${input.canonicalDocs.name}) with verified non-empty bytecode, active execution state, and no active emergency pauses.`;
    } else {
      decision = 'PASS';
      justification = 'Interaction approved under reviewed checks: Verified contract bytecode present, no proxy upgradeability trapdoors detected, and no active emergency pause.';
    }

    // 8. Optional Unsigned Transaction Preparation
    let proposedTx: UnsignedTransaction | undefined;
    const lowerQuery = input.userQuery.toLowerCase();
    if (lowerQuery.includes('read') || lowerQuery.includes('timestamp') || lowerQuery.includes('time') || normalizedTarget === '0xca11bde05977b3631167028862be2a173976ca11') {
      proposedTx = {
        chainId: CONFIG.NETWORK.CHAIN_ID,
        to: input.targetAddress,
        data: CONFIG.SELECTORS.MULTICALL3_TIMESTAMP,
        value: '0',
        gasLimit: '50000',
        gasPriceGwei: '1.0',
        methodName: 'getCurrentBlockTimestamp()',
        safetyNotes: [
          'Strictly read-only inspection call. No tokens or native PROS will be transferred.',
          'Safe for user wallet simulation. User maintains 100% signing authority.',
        ],
      };
    } else if (lowerQuery.includes('owner') || lowerQuery.includes('admin')) {
      proposedTx = {
        chainId: CONFIG.NETWORK.CHAIN_ID,
        to: input.targetAddress,
        data: CONFIG.SELECTORS.OWNER,
        value: '0',
        gasLimit: '50000',
        gasPriceGwei: '1.0',
        methodName: 'owner()',
        safetyNotes: [
          'Read-only inspection of contract administrative owner.',
          'Zero gas cost on simulation; zero private key exposure.',
        ],
      };
    }

    return {
      decision,
      justification,
      checks,
      provenance,
      proposedTx,
      isProxy,
      proxyType,
      implementationAddress: (implAddr || beaconAddr) || undefined,
      ownerAddress,
      isPaused,
      totalSupply: totalSupplyFormatted,
    };
  }
}
