---
name: pharos-contractlens
description: >
  Autonomous AI-powered smart contract due-diligence and interaction-safety agent for the Pharos Network.
  Integrates Pharos Chain MCP, Developer Docs MCP, and the Pharos Skill Engine to inspect runtime bytecode,
  detect EIP-1967/beacon proxy upgradeability, audit administrative ownership, check emergency pause states,
  cross-reference canonical protocol documentation, and formulate PASS, REVIEW, or BLOCK safety decisions
  with complete cryptographic provenance.
version: 1.0.0
requires:
  node: ">=22.0.0"
---

# Pharos ContractLens — Agent-Native Smart Contract Due-Diligence

ContractLens provides autonomous, read-only due diligence for users interacting with smart contracts on Pharos Pacific Mainnet (Chain ID `1672`).

## Architectural Capabilities

1. **Pharos Chain MCP Integration (`https://mcp.pharos.xyz/mcp`):**
   - Live session negotiation via MCP 2024-11-05 SSE protocol.
   - Bytecode analysis (`get_code`).
   - Storage slot introspection (`get_storage_at`) for EIP-1967/beacon proxy implementation addresses.
   - Read-only execution (`eth_call`) for `owner()`, `paused()`, `totalSupply()`, and utility selectors.
   - Gas estimation (`estimate_gas`) for unsigned transaction simulation.

2. **Pharos Developer Docs MCP Integration (`https://docs.pharos.xyz/~gitbook/mcp`):**
   - Canonical contract discovery (`searchDocumentation`).
   - Official specification retrieval (`getPage`).
   - Documentation alignment verification.

3. **Pharos Skill Engine Core:**
   - Deterministic policy gatekeeper enforcing non-custodial invariants.
   - Tri-state decision classification: `PASS`, `REVIEW`, `BLOCK`.
   - Complete cryptographic provenance attached to every observation.

## Strict Non-Custodial Safety Boundaries

- **Zero Key Custody:** The agent never holds, receives, or transmits private keys.
- **Strictly Read-Only:** The hosted Chain MCP instance is used exclusively for queries; state mutation tools (`send_raw_transaction`) are permanently blocked.
- **Fail-Closed:** Missing bytecode, active emergency pauses, or upstream ambiguities resolve to `BLOCK` or `REVIEW`.
