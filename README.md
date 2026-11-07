# Pharos ContractLens

[![Pharos Pacific Mainnet](https://img.shields.io/badge/Network-Pharos%20Pacific%20Mainnet%20(1672)-00e5a3.svg)](https://pharosscan.xyz)
[![Vercel Deployed](https://img.shields.io/badge/Deployment-Vercel%20Production-black.svg)](https://pharos-contractlens.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Custody](https://img.shields.io/badge/Security-Non--Custodial%20Only-emerald.svg)]()

> **Pharos Capstone: 500-Point Agent-Native dApp**  
> An autonomous AI-powered smart contract due-diligence and interaction-safety agent for users of the Pharos blockchain.

---

## 1. Overview & Problem Solved

Interacting with unfamiliar smart contracts on modern EVM blockchains poses severe risks:
- Hidden proxy upgradeability allowing admins to swap logic.
- Unchecked minting permissions and centralized ownership.
- Active emergency pause states that lock funds upon deposit.
- Discrepancies between official protocol documentation and deployed on-chain bytecode.
- Malicious phishing EOAs or uninitialized addresses passed as contracts.

**ContractLens** is an agent-native application that performs automated, multi-tool due diligence on any contract address before a user signs a transaction.

The agent queries the official **Pharos Chain MCP**, cross-references the official **Pharos Developer Docs MCP**, and evaluates rules via the **Pharos Skill Engine** to output one of three verified decision states:
- `PASS`: Available evidence confirms the contract exists, matches canonical documentation, has no destructive trapdoors, and conforms to known safe execution semantics.
- `REVIEW`: Contract is valid and operational, but possesses privileged upgradeability (e.g. mutable EIP-1967 proxy), centralized administrative ownership, unverified bytecode, or missing documentation.
- `BLOCK`: Bytecode is empty (`0x`, nonexistent contract or EOA passed as contract), active emergency pause is enabled, or execution reverts on basic introspection.

---

## 2. Official Pharos AI Integrations

ContractLens deeply integrates all three official Pharos AI toolsets:

### A. Pharos Chain MCP
- **Endpoint:** Hosted MCP at `https://mcp.pharos.xyz/mcp`
- **Protocol:** MCP `2024-11-05` over HTTP SSE
- **Tools Utilized:**
  - `get_chain_info`: Enforces connected network is Pharos Pacific Mainnet (Chain ID `1672`).
  - `get_block_number`: Records cryptographic block height at query timestamp.
  - `get_code`: Fetches deployed contract runtime bytecode.
  - `get_storage_at`: Introspects raw 32-byte storage slots (EIP-1967 implementation slot `0x360894a1...` and beacon slot `0xa3f0ad74...`).
  - `eth_call`: Executes read-only contract state introspection (`owner()`, `paused()`, `totalSupply()`, utility timestamps).
  - `estimate_gas`: Simulates transaction execution without submitting to mempool.

### B. Pharos Developer Docs MCP
- **Endpoint:** Hosted GitBook MCP at `https://docs.pharos.xyz/~gitbook/mcp`
- **Protocol:** MCP `2024-11-05`
- **Tools Utilized:**
  - `searchDocumentation`: Queries official protocol documentation for canonical infrastructure deployments.
  - `getPage`: Retrieves full canonical documentation pages for cross-referencing.

### C. Pharos Skill Engine
- **Specification:** Adheres strictly to the official Pharos Skill Engine standard (`SKILL.md`).
- **Policy Evaluator:** Deterministic rule engine separating factual on-chain observation from LLM interpretation.
- **Fail-Closed Safety:** Never treats missing evidence as proof of safety.

---

## 3. Verified Mainnet Targets

ContractLens is tested against real, live contracts deployed on Pharos Pacific Mainnet (Chain ID `1672`):

| Contract | Mainnet Address | Role & Features | Decision State |
|---|---|---|:---:|
| **MultiCall3** | `0xcA11bde05977b3631167028862bE2a173976CA11` | Canonical batch call infrastructure; verified bytecode; non-proxy. | `PASS` |
| **Faroo Liquid Staking** | `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4` | EIP-1967 Upgradeable proxy; implementation `0xfd59...708d`; owner `0xc30db...805b`. | `REVIEW` |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Canonical signature-based approval router; non-proxy. | `PASS` |
| **FaroSwap Pool** | `0x41460c5E3f7cf657ea4d6a666eA4d2C38d9A5623` | Uniswap V3 concentrated liquidity pool (WPROS / USDC). | `PASS` |
| **Empty Target** | `0x000000000000000000000000000000000000dead` | Uninitialized address with empty runtime bytecode (`0x`). | `BLOCK` |

---

## 4. How to Test

### Prerequisites
- Node.js 22.0.0+ (Tested on Node.js v24.15.0)
- npm 10+

### Run Automated Unit Tests (Offline / Deterministic)
```bash
npm run test:unit
```
Verifies address validation, deterministic policy decisions, prompt injection protection, cryptographic provenance integrity, transaction safety, and router endpoints.

### Run Live On-Chain Integration Tests
```bash
npm run test:integration
```
Executes genuine, live network requests against:
- `https://mcp.pharos.xyz/mcp` (Chain MCP)
- `https://docs.pharos.xyz/~gitbook/mcp` (Docs MCP)
- Live contract bytecode queries on Pacific Mainnet (`1672`)

### Run All Tests
```bash
npm run test
```

---

## 5. Local Development & Standalone Server

To run the local ContractLens web dashboard and server:

```bash
# 1. Install dependencies
npm install

# 2. Build production artifacts
npm run build

# 3. Start local standalone server
npm run serve
```

Open your browser to:
```
http://localhost:3000
```

---

## 6. Security Architecture & Invariants

1. **Non-Custodial Design:** Zero private keys, seed phrases, or wallet secrets are used, logged, or accepted anywhere in the backend, frontend, or Vercel environment.
2. **Read-Only Invariant:** Write-capable methods (such as `send_raw_transaction`) are permanently blocked.
3. **User Signing Ownership:** If an unsigned transaction is prepared, it is handed off to the user's browser wallet (via standard EIP-1193 `eth_sendTransaction`). The user retains 100% signing authority.
4. **Prompt Injection Hardening:** External inputs and retrieved documentation are sanitized and treated as untrusted data, never as agent instructions.
5. **Deterministic Policy Core:** The safety classification is computed deterministically by the Skill Engine evaluator, not by an unconstrained LLM completion.

---

## 7. Project Structure

```
pharos-contractlens/
├── api/                   # Vercel standalone serverless function bundles
│   ├── analyze.js
│   ├── docs.js
│   ├── health.js
│   ├── simulate.js
│   └── tools.js
├── docs/                  # Comprehensive capstone documentation
│   ├── ACCEPTANCE_REPORT.md
│   ├── AGENT_WORKFLOW.md
│   ├── ARCHITECTURE.md
│   ├── DEMO_SCRIPT.md
│   ├── SECURITY.md
│   └── TOOL_INTEGRATIONS.md
├── public/                # Responsive dark institutional web frontend
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── scripts/
│   └── build.js           # Production bundler (esbuild)
├── src/                   # TypeScript core application sources
│   ├── agent/             # Multi-tool agent execution loop
│   ├── api/               # Serverless function source handlers
│   ├── config/            # Network & selector configuration
│   ├── mcp/               # Chain MCP and Docs MCP clients
│   ├── server/            # Standalone HTTP router & server
│   ├── skillEngine/       # Deterministic policy engine
│   └── types/             # Strict TypeScript schemas
├── tests/
│   ├── integration/       # Live read-only tests against Mainnet MCP
│   └── unit/              # Deterministic offline test suite
├── .env.example
├── .gitignore
├── LICENSE
├── package.json
├── README.md
├── SKILL.md
├── tsconfig.json
└── vercel.json
```

---

## 8. License

MIT License. Copyright (c) 2026 JimmyOgb.
