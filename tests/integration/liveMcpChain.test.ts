import test from 'node:test';
import assert from 'node:assert/strict';
import { PharosChainMcpClient } from '../../src/mcp/chainClient.ts';
import { CONFIG } from '../../src/config/index.ts';

test('Live Chain MCP Integration: initializes session and retrieves chain context', async () => {
  const client = new PharosChainMcpClient();
  const sid = await client.initialize();
  assert.ok(sid, 'Session ID should be negotiated');

  const chainInfo = await client.getChainInfo();
  assert.equal(chainInfo.chainId, 1672, 'Connected chainId must be 1672 (Pharos Pacific Mainnet)');

  const blockNumber = await client.getBlockNumber();
  assert.ok(parseInt(blockNumber, 10) > 22000000, `Block number should be > 22M, got ${blockNumber}`);
});

test('Live Chain MCP Integration: retrieves bytecode and storage slots', async () => {
  const client = new PharosChainMcpClient();
  await client.initialize();

  // MultiCall3 bytecode
  const multiCallCode = await client.getCode('0xcA11bde05977b3631167028862bE2a173976CA11');
  assert.ok(multiCallCode.length > 100, 'MultiCall3 bytecode should be non-empty');

  // Faroo Proxy implementation slot
  const slotValue = await client.getStorageAt(
    '0x6b0A44c64190279f7034b77c13a566E914FE5Ec4',
    CONFIG.SLOTS.EIP_1967_IMPLEMENTATION
  );
  assert.ok(slotValue.toLowerCase().includes('fd59860894e01773e9780b0d1dfae4ca2b56708d'), 'Must match Faroo implementation address in slot');
});
