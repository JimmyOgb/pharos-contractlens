# Pharos ContractLens — Architecture Documentation

## 1. System Overview

Pharos ContractLens is an agent-native decentralized application designed to provide automated due diligence on unfamiliar smart contracts before users sign transactions on Pharos Pacific Mainnet (Chain ID `1672`).

The system is architected as an event-driven, multi-tool pipeline combining:
1. **Pharos Chain MCP:** Direct on-chain EVM telemetry and state inspection.
2. **Pharos Developer Docs MCP:** Canonical documentation search and specification retrieval.
3. **Pharos Skill Engine:** Deterministic rule evaluation, state classification (`PASS`, `REVIEW`, `BLOCK`), and cryptographic provenance recording.
4. **Vercel Serverless & Edge CDN:** Distributed low-latency serving of institutional frontend and serverless API endpoints.

```
                              ┌────────────────────────────────────────┐
                              │           User Browser / Web3          │
                              │ (Next.js / ESM Frontend, EIP-1193)    │
                              └───────────────────┬────────────────────┘
                                                  │ HTTPS POST /api/analyze
                                                  ▼
                              ┌────────────────────────────────────────┐
                              │       ContractLens Agent Engine        │
                              │        (src/agent/engine.ts)           │
                              └───────┬──────────────┬──────────────┬──┘
                                      │              │              │
                   ┌──────────────────┘              │              └──────────────────┐
                   ▼                                 ▼                                 ▼
      ┌─────────────────────────┐       ┌─────────────────────────┐       ┌─────────────────────────┐
      │     Chain MCP Client    │       │     Docs MCP Client     │       │   SkillEngine Core      │
      │   (mcp.pharos.xyz/mcp)  │       │  (docs.pharos.xyz/mcp)  │       │ (skillEngine/evaluator) │
      └────────────┬────────────┘       └────────────┬────────────┘       └────────────┬────────────┘
                   │                                 │                                 │
     • get_chain_info (1672)           • searchDocumentation            • RULE-BYTECODE-EXISTS
     • get_block_number (height)       • getPage (canonical spec)        • RULE-PROXY-MUTABILITY
     • get_code (bytecode)             • askQuestion                     • RULE-PRIVILEGED-OWNER
     • get_storage_at (EIP-1967)                                         • RULE-EMERGENCY-PAUSE
     • eth_call (owner, paused)                                          • RULE-CANONICAL-DOCS
     • estimate_gas (sim)                                                • Provenance Fingerprint
                   │                                 │                                 │
                   └──────────────────┬──────────────┴─────────────────────────────────┘
                                      ▼
                        ┌───────────────────────────┐
                        │ Structured Decision State │
                        │   PASS | REVIEW | BLOCK   │
                        │ + Cryptographic Provenance│
                        └───────────────────────────┘
```

---

## 2. Component Design

### 2.1 Agent Engine (`src/agent/engine.ts`)
Orchestrates the entire multi-tool due-diligence workflow in 8 sequential phases:
1. **Input Validation:** Enforces standard 40-character hexadecimal EVM address format (`^0x[0-9a-fA-F]{40}$`).
2. **Input Sanitization:** Strips HTML/markdown tags and token-injection vectors from user queries.
3. **Session Negotiation:** Establishes a stateful session with the hosted Pharos Chain MCP server using the MCP `2024-11-05` protocol.
4. **Bytecode Inspection:** Fetches deployed runtime code via `get_code`.
5. **Storage Slot Probing:** Evaluates the EIP-1967 implementation slot (`0x360894a1...`) and beacon slot (`0xa3f0ad74...`) via `get_storage_at`.
6. **State Queries:** Dispatches read-only `eth_call` queries for `owner()`, `paused()`, and `totalSupply()`.
7. **Documentation Cross-Referencing:** Dispatches search queries to the Pharos Docs MCP.
8. **Deterministic Synthesis:** Invokes the Skill Engine evaluator to formulate the definitive `PASS`, `REVIEW`, or `BLOCK` decision with full provenance.

### 2.2 Pharos Chain MCP Client (`src/mcp/chainClient.ts`)
- Implements JSON-RPC 2.0 and MCP 2024-11-05 SSE streaming over HTTPS.
- Maintains HTTP keep-alive, exponential backoff retries on session negotiation, and strict request timeouts.
- Completely excludes write operations (`send_raw_transaction` is blocked).

### 2.3 Pharos Docs MCP Client (`src/mcp/docsClient.ts`)
- Communicates with GitBook MCP at `https://docs.pharos.xyz/~gitbook/mcp`.
- Dispatches semantic queries via `searchDocumentation` and reads markdown specs via `getPage`.
- Includes a verified canonical protocol database fallback for offline resilience.

### 2.4 Skill Engine Evaluator (`src/skillEngine/evaluator.ts`)
- Implements deterministic, fail-closed policy gates.
- Strictly separates factual on-chain observations from heuristic suggestions.
- Outputs an immutable `ProvenanceItem` array logging field, source type, block number, storage slot, selector, raw hex, and decoded value.

---

## 3. Serverless & Deployment Architecture

- **Bundling:** `esbuild` compiles TypeScript sources into self-contained ESM serverless handlers in `api/*.js`.
- **Runtime:** Node.js 22+ (Vercel Serverless Function runtime).
- **Static Assets:** Clean, modern dark-theme HTML, CSS, and JS served directly from edge CDN.
- **Zero Secrets:** Operates with zero private keys, zero paid API credentials, and zero mainnet gas costs.
