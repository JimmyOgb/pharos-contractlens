import test from 'node:test';
import assert from 'node:assert/strict';
import { SkillEngineEvaluator } from '../../src/skillEngine/evaluator.ts';

test('Policy Decisions: flags empty bytecode as BLOCK (RULE-BYTECODE-EXISTS)', () => {
  const evaluator = new SkillEngineEvaluator();
  const output = evaluator.evaluate({
    targetAddress: '0x000000000000000000000000000000000000dead',
    userQuery: 'What does this contract do?',
    bytecode: '0x',
    blockNumber: '22378400',
    eip1967ImplSlot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    eip1967BeaconSlot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    ownerResult: {},
    pausedResult: {},
    totalSupplyResult: {},
    canonicalDocs: {
      name: 'Unindexed',
      category: 'Unknown',
      docsUrl: 'https://docs.pharos.xyz',
      description: 'Not listed',
      matched: false,
    },
  });

  assert.equal(output.decision, 'BLOCK');
  assert.equal(output.checks[0].id, 'RULE-BYTECODE-EXISTS');
  assert.equal(output.checks[0].status, 'FAIL');
  assert.match(output.justification, /contains no deployed contract bytecode/);
});

test('Policy Decisions: detects EIP-1967 upgradeable proxy and requires REVIEW', () => {
  const evaluator = new SkillEngineEvaluator();
  const output = evaluator.evaluate({
    targetAddress: '0x6b0a44c64190279f7034b77c13a566e914fe5ec4',
    userQuery: 'Is this contract upgradeable?',
    bytecode: '0x608060405234801561001057600080fd5b50',
    blockNumber: '22378400',
    eip1967ImplSlot: '0x000000000000000000000000fd59860894e01773e9780b0d1dfae4ca2b56708d',
    eip1967BeaconSlot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    ownerResult: { result: '0x000000000000000000000000c30db0543412c6881a543390d2c21fbbff42805b' },
    pausedResult: { result: '0x0000000000000000000000000000000000000000000000000000000000000000' },
    totalSupplyResult: { result: '0x0000000000000000000000000000000000000000000432f6930f92fb76427ea1' },
    canonicalDocs: {
      name: 'Faroo Liquid Staking',
      category: 'DeFi Liquid Staking',
      docsUrl: 'https://docs.pharos.xyz/ecosystem/defi',
      description: 'Primary liquid staking',
      matched: true,
    },
  });

  assert.equal(output.isProxy, true);
  assert.equal(output.proxyType, 'EIP-1967');
  assert.equal(output.implementationAddress, '0xfd59860894e01773e9780b0d1dfae4ca2b56708d');
  assert.equal(output.decision, 'REVIEW');
  assert.match(output.justification, /upgradeable proxy/);
});

test('Policy Decisions: detects active emergency pause and triggers BLOCK', () => {
  const evaluator = new SkillEngineEvaluator();
  const output = evaluator.evaluate({
    targetAddress: '0x1111111111111111111111111111111111111111',
    userQuery: 'Can I transfer tokens?',
    bytecode: '0x608060405234801561001057600080fd5b50',
    blockNumber: '22378400',
    eip1967ImplSlot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    eip1967BeaconSlot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    ownerResult: {},
    pausedResult: { result: '0x0000000000000000000000000000000000000000000000000000000000000001' }, // 1 = paused
    totalSupplyResult: {},
    canonicalDocs: {
      name: 'Unknown',
      category: 'Custom',
      docsUrl: 'https://docs.pharos.xyz',
      description: 'None',
      matched: false,
    },
  });

  assert.equal(output.isPaused, true);
  assert.equal(output.decision, 'BLOCK');
  assert.match(output.justification, /emergency pause/);
});

test('Policy Decisions: assigns PASS to verified canonical non-proxy active contract', () => {
  const evaluator = new SkillEngineEvaluator();
  const output = evaluator.evaluate({
    targetAddress: '0xca11bde05977b3631167028862be2a173976ca11',
    userQuery: 'Is MultiCall3 safe?',
    bytecode: '0x608060405234801561001057600080fd5b50',
    blockNumber: '22378400',
    eip1967ImplSlot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    eip1967BeaconSlot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    ownerResult: {},
    pausedResult: {},
    totalSupplyResult: {},
    canonicalDocs: {
      name: 'MultiCall3',
      category: 'Canonical Infrastructure',
      docsUrl: 'https://docs.pharos.xyz/getting-started/canonical-contracts',
      description: 'Allows bundling multiple EVM calls',
      matched: true,
    },
  });

  assert.equal(output.decision, 'PASS');
  assert.equal(output.isProxy, false);
  assert.match(output.justification, /verified canonical Pharos infrastructure/);
});
