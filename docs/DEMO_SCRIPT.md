# Pharos ContractLens — Real-User Walkthrough & Demo Script

## 1. Walkthrough Objectives
Demonstrate the end-to-end user flow of Pharos ContractLens on the live deployed Vercel application:
1. Opening the deployed production application.
2. Entering real Pharos Pacific Mainnet contract addresses.
3. Submitting natural-language questions.
4. Observing genuine, live Pharos Chain MCP queries and tool-call traces.
5. Observing official Pharos Developer Docs MCP searches and canonical alignment.
6. Observing the Skill Engine deterministic policy evaluation.
7. Observing the resulting `PASS`, `REVIEW`, and `BLOCK` decisions.
8. Inspecting the cryptographic data provenance register.
9. Reviewing the safety boundary and optional unsigned transaction flow.

---

## 2. Walkthrough Flow & Storyboard

### Scene 1: Production Application Launch
- **Action:** Open the canonical production URL `https://pharos-contractlens.vercel.app`.
- **Narration:** "Welcome to Pharos ContractLens, an autonomous agent-native dApp providing contract due diligence and interaction safety on Pharos Pacific Mainnet."
- **Visual:** Clean, dark institutional interface; network status badge showing "Pharos Pacific Mainnet (Chain ID 1672)"; official tool badges showing Chain MCP, Docs MCP, and Skill Engine active.

### Scene 2: Canonical Infrastructure Inspection (`PASS`)
- **Action:** Select preset **MultiCall3 (Canonical Utility)** (`0xcA11bde05977b3631167028862bE2a173976CA11`).
- **Query:** "Is this contract canonical Pharos infrastructure and is it safe to bundle calls?"
- **Action:** Click "Run Autonomous Due-Diligence".
- **Observables:**
  - Progressive waterfall pipeline moves through context, bytecode, state, docs, and decision.
  - Decision banner lights up in emerald **`PASS`**: "Interaction Approved Under Reviewed Checks".
  - Findings cards confirm: Bytecode Exists (7,736 bytes), Proxy Mutability = False, Canonical Docs = Matched (`MultiCall3`).
  - Tool traces tab displays live Chain MCP calls (`get_code`, `get_storage_at`, `eth_call`) with millisecond latencies.
  - Cryptographic Provenance table displays block height (`>#22.3M`), selectors, and raw hex outputs.

### Scene 3: Upgradeable Proxy Due-Diligence (`REVIEW`)
- **Action:** Select preset **Faroo Liquid Staking (Proxy)** (`0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`).
- **Query:** "Is this contract an upgradeable proxy and who owns the admin key?"
- **Action:** Click "Run Autonomous Due-Diligence".
- **Observables:**
  - Decision banner displays amber **`REVIEW`**: "Privileged Controls Require Due-Diligence Review".
  - Finding card flags: "Contract is an upgradeable proxy (EIP-1967). Current active implementation is `0xfd59860894e01773e9780b0d1dfae4ca2b56708d`."
  - Owner card detects centralized admin key at `0xc30db...805b`.
  - Provenance table records storage slot `0x360894a1...` and raw implementation address hex.

### Scene 4: Uninitialized Address Threat Mitigation (`BLOCK`)
- **Action:** Select preset **Uninitialized / EOA Target** (`0x000000000000000000000000000000000000dead`).
- **Query:** "Explain what this contract does."
- **Action:** Click "Run Autonomous Due-Diligence".
- **Observables:**
  - Decision banner displays crimson **`BLOCK`**: "Interaction Blocked — Critical Risk Detected".
  - Justification: "Target address contains zero deployed bytecode (0x). It is an EOA or uninitialized address. Interacting with it as a contract will fail."
  - Proves fail-closed safety invariant.

### Scene 5: Non-Custodial Safety & Unsigned Transaction Review
- **Action:** Navigate to the "Unsigned Tx Review" tab.
- **Observables:**
  - Displays proposed call parameters: destination, calldata hex, simulated gas limit.
  - Prominent safety disclaimer: Zero private keys in the agent; user owns 100% of signing authority in their wallet.
  - Connect Wallet button allows inspecting the call via user's Web3 wallet without automatic signing.
