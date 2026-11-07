# Pharos ContractLens — Official Tool Integrations

## 1. Pharos Chain MCP

- **Hosted Endpoint:** `https://mcp.pharos.xyz/mcp`
- **Protocol:** MCP `2024-11-05` over HTTP Server-Sent Events (SSE)
- **Session Header:** `mcp-session-id`
- **Authentication:** Public Read-Only (No API key required)
- **Target Network:** Pharos Pacific Mainnet (Chain ID `1672`)
- **Discovered Tools Utilized:**

| Tool Name | Input Schema | Output Schema | Usage in ContractLens |
|---|---|---|---|
| `get_chain_info` | `{}` | `{ name, chainId, latestBlock, rpcUrl, nativeSymbol }` | Validates connected chain is Pacific Mainnet (`1672`). |
| `get_block_number` | `{}` | `{ blockNumber, blockNumberHex }` | Records block height for all provenance data. |
| `get_code` | `{ address: string, block?: string }` | `{ code: string }` | Retrieves deployed EVM runtime bytecode; verifies non-empty code. |
| `get_storage_at` | `{ address: string, position: string, block?: string }` | `{ value: string }` | Reads raw 32-byte storage slots (EIP-1967 proxy implementation/beacon). |
| `eth_call` | `{ transaction: { to: string, data: string }, block?: string }` | `{ result: string }` or `{ error: object }` | Introspects contract state: `owner()`, `paused()`, `totalSupply()`. |
| `estimate_gas` | `{ transaction: { to: string, data: string, from?: string, value?: string } }` | `{ gas: string }` | Simulates proposed unsigned interactions safely. |
| `get_balance` | `{ address: string, block?: string }` | `{ balance: string }` | Checks native PROS reserves. |

---

## 2. Pharos Developer Docs MCP

- **Hosted Endpoint:** `https://docs.pharos.xyz/~gitbook/mcp`
- **Server Identity:** `docs.pharos.xyz MCP Server v0.28.0`
- **Protocol:** MCP `2024-11-05`
- **Tools Utilized:**

| Tool Name | Input Schema | Output Schema | Usage in ContractLens |
|---|---|---|---|
| `searchDocumentation` | `{ query: string }` | `{ content: Array<{ type: "text", text: string }> }` | Searches official documentation for protocol and contract references. |
| `getPage` | `{ url: string }` | `{ content: Array<{ type: "text", text: string }> }` | Retrieves full canonical markdown specifications (e.g. `canonical-contracts`). |
| `askQuestion` | `{ question: string, goal?: string }` | `{ content: Array<{ type: "text", text: string }> }` | Evaluates natural language protocol queries against official docs. |

---

## 3. Pharos Skill Engine

- **Specification Source:** `https://github.com/PharosNetwork/pharos-skill-engine` (`SKILL.md`)
- **Integration Layer:** `src/skillEngine/evaluator.ts`
- **Deterministic Rules Enforced:**
  1. `RULE-BYTECODE-EXISTS`: Fails closed if bytecode is missing or empty.
  2. `RULE-PROXY-MUTABILITY`: Flags EIP-1967 / Beacon storage slots as upgradeable proxies (`REVIEW`).
  3. `RULE-PRIVILEGED-OWNER`: Identifies centralized administrative keys.
  4. `RULE-EMERGENCY-PAUSE`: Detects circuit breakers and emits `BLOCK`.
  5. `RULE-CANONICAL-DOCS`: Verifies canonical protocol alignment.
  6. `RULE-PROVENANCE-FINGERPRINT`: Assembles cryptographic audit trail for every finding.
