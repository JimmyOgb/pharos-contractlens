import test from 'node:test';
import assert from 'node:assert/strict';
import { ContractLensAgent } from '../../src/agent/engine.ts';

test('Live Agent Flow: MultiCall3 returns PASS with canonical provenance', { concurrency: false }, async () => {
  const agent = new ContractLensAgent();
  const res = await agent.analyze({
    address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    query: 'Is this contract safe and canonical?',
  });

  assert.equal(res.decision, 'PASS');
  assert.equal(res.contractMetadata.hasBytecode, true);
  assert.equal(res.contractMetadata.isProxy, false);
  assert.ok(res.provenanceRegistry.length >= 4);
  assert.ok(res.toolTraces.length >= 2);
});

test('Live Agent Flow: Faroo Liquid Staking Proxy returns REVIEW for upgradeability', { concurrency: false }, async () => {
  const agent = new ContractLensAgent();
  const res = await agent.analyze({
    address: '0x6b0A44c64190279f7034b77c13a566E914FE5Ec4',
    query: 'Does this contract appear upgradeable?',
  });

  assert.equal(res.decision, 'REVIEW');
  assert.equal(res.contractMetadata.hasBytecode, true);
  assert.equal(res.contractMetadata.isProxy, true);
  assert.equal(res.contractMetadata.implementationAddress?.toLowerCase(), '0xfd59860894e01773e9780b0d1dfae4ca2b56708d');
});

test('Live Agent Flow: Uninitialized address returns BLOCK', { concurrency: false }, async () => {
  const agent = new ContractLensAgent();
  const res = await agent.analyze({
    address: '0x000000000000000000000000000000000000dead',
    query: 'Can I send funds here?',
  });

  assert.equal(res.decision, 'BLOCK');
  assert.equal(res.contractMetadata.hasBytecode, false);
  assert.match(res.decisionJustification, /contains no deployed contract bytecode/);
});
