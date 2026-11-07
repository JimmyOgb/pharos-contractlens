# Pharos ContractLens — Agent Workflow Specification

## 1. Multi-Tool Execution Lifecycle

The ContractLens agent follows a strict, deterministic execution loop to evaluate any contract address submitted by a user.

```
[User Input: Address + Query + Optional Wallet]
                     │
                     ▼
             1. Address Validation
         (Regex: ^0x[0-9a-fA-F]{40}$)
             ├── FAIL ──► Emit BLOCK (RULE-ADDRESS-VALIDATION)
             │
             ▼ PASS
       2. Connect Pharos Chain MCP
   (Negotiate session & fetch latest block)
             │
             ▼
        3. Fetch Runtime Bytecode
              (Tool: get_code)
             ├── Empty (0x) ──► Emit BLOCK (RULE-BYTECODE-EXISTS)
             │
             ▼ Non-empty
      4. Inspect Proxy Storage Slots
    (Tool: get_storage_at on EIP-1967)
             ├── Implementation Found ──► Flag isProxy = true, fetch impl bytecode
             │
             ▼
        5. Contract State Queries
   (Tool: eth_call for owner, paused, supply)
             ├── Paused == true ──► Emit BLOCK (RULE-EMERGENCY-PAUSE)
             │
             ▼
    6. Pharos Docs MCP Cross-Reference
   (Tool: searchDocumentation & getPage)
             │
             ▼
       7. Skill Engine Policy Gate
      (Evaluate composite decision state)
             │
             ├── If isPaused ──────► BLOCK
             ├── If isProxy ───────► REVIEW
             ├── If single owner ──► REVIEW
             └── If canonical ─────► PASS
                     │
                     ▼
   8. Optional Unsigned Transaction Prep
     (Zero key custody; user wallet review)
                     │
                     ▼
 [Render Decision, Provenance Table, & Tool Traces]
```

---

## 2. Decision State Taxonomy

### `PASS`
- **Definition:** Available on-chain evidence confirms the target address contains verified runtime bytecode, operates under active (unpaused) execution, has no unverified proxy delegation, and matches canonical documentation or standard immutable patterns.
- **Example Targets:**
  - MultiCall3 (`0xcA11bde05977b3631167028862bE2a173976CA11`)
  - Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`)
  - FaroSwap Uniswap V3 Pool (`0x41460c5E3f7cf657ea4d6a666eA4d2C38d9A5623`)

### `REVIEW`
- **Definition:** The contract is active and operational, but contains mutable proxy implementation logic, centralized administrative ownership, or custom unindexed code that requires human due-diligence before committing high-value transactions.
- **Example Targets:**
  - Faroo Liquid Staking Proxy (`0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`)
  - Contracts governed by a single EOA owner key.

### `BLOCK`
- **Definition:** A definitive safety hazard or failure condition is detected on-chain.
- **Conditions Triggering BLOCK:**
  - Zero runtime bytecode (EOA or uninitialized address).
  - Malformed or invalid address string.
  - Active emergency pause circuit breaker (`paused() == true`).
  - Total call failure on basic EVM introspection.

---

## 3. Cryptographic Provenance Model

Every finding presented to the user is paired with an immutable `ProvenanceItem` object containing:
- `field`: Exact metric inspected (e.g. `runtime_bytecode`, `eip1967_implementation_slot`, `owner_address`).
- `sourceType`: Provenance origin (`ON_CHAIN_MCP`, `OFFICIAL_DOCS_MCP`, or `SKILL_ENGINE_INFERENCE`).
- `targetAddress`: Hex address inspected.
- `blockNumber`: On-chain block height at the moment of query.
- `storageSlot` / `selector`: Specific 32-byte slot or 4-byte EVM selector queried.
- `rawHex`: Raw un-decoded hex returned by the EVM.
- `decodedValue`: Decoded human-readable interpretation.
- `verifiedAt`: ISO 8601 UTC timestamp.
