/**
 * Pharos ContractLens Configuration & Constants
 */

export const CONFIG = {
  NETWORK: {
    CHAIN_ID: 1672,
    CHAIN_NAME: 'Pharos Pacific Mainnet',
    NATIVE_SYMBOL: 'PROS',
    RPC_URL: process.env.PHAROS_RPC_URL || 'https://rpc.pharos.xyz',
    CHAIN_MCP_URL: process.env.PHAROS_CHAIN_MCP_URL || 'https://mcp.pharos.xyz/mcp',
    DOCS_MCP_URL: process.env.PHAROS_DOCS_MCP_URL || 'https://docs.pharos.xyz/~gitbook/mcp',
  },
  PORT: parseInt(process.env.PORT || '3000', 10),
  TIMEOUTS: {
    MCP_REQUEST_MS: 15000,
    MCP_CONNECT_MS: 8000,
  },
  SLOTS: {
    EIP_1967_IMPLEMENTATION: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
    EIP_1967_BEACON: '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50',
    EIP_1967_ADMIN: '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
  },
  SELECTORS: {
    OWNER: '0x8da5cb5b',             // owner()
    GET_OWNER: '0x893d20e8',         // getOwner()
    ADMIN: '0xf851a440',             // admin()
    PAUSED: '0x5c975abb',            // paused()
    TOTAL_SUPPLY: '0x18160ddd',      // totalSupply()
    DECIMALS: '0x313ce567',          // decimals()
    SYMBOL: '0x95d89b41',            // symbol()
    NAME: '0x06fdde03',              // name()
    MULTICALL3_TIMESTAMP: '0x0f28c97d', // getCurrentBlockTimestamp()
    MULTICALL3_BLOCKNUM: '0x42cbb15c',  // getBlockNumber()
    PERMIT2_DOMAIN: '0x3644e515',    // DOMAIN_SEPARATOR()
  },
  CANONICAL_PRESETS: [
    {
      name: 'MultiCall3 (Canonical Utility)',
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      description: 'Official MultiCall3 contract on Pharos Pacific Mainnet for bundling read operations.',
      expectedDecision: 'PASS' as const,
      category: 'Infrastructure',
    },
    {
      name: 'Faroo Liquid Staking (Proxy)',
      address: '0x6b0A44c64190279f7034b77c13a566E914FE5Ec4',
      description: 'EIP-1967 Upgradeable proxy contract for Faroo stPROS liquid staking protocol.',
      expectedDecision: 'REVIEW' as const,
      category: 'DeFi Staking',
    },
    {
      name: 'Permit2 (Approval Router)',
      address: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
      description: 'Canonical next-generation token approval and signature router.',
      expectedDecision: 'PASS' as const,
      category: 'Token Approvals',
    },
    {
      name: 'FaroSwap Pool (Uniswap V3)',
      address: '0x41460c5E3f7cf657ea4d6a666eA4d2C38d9A5623',
      description: 'Concentrated liquidity pool for WPROS / USDC on Pharos Pacific Mainnet.',
      expectedDecision: 'PASS' as const,
      category: 'DEX AMM',
    },
    {
      name: 'Uninitialized / EOA Target',
      address: '0x000000000000000000000000000000000000dead',
      description: 'Uninitialized address with empty bytecode to verify BLOCK state behavior.',
      expectedDecision: 'BLOCK' as const,
      category: 'Non-Contract / Inactive',
    },
  ]
};
