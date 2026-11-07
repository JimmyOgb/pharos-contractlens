import test from 'node:test';
import assert from 'node:assert/strict';
import { SkillEngineEvaluator } from '../../src/skillEngine/evaluator.ts';

test('Transaction Safety: prepared transactions remain unsigned and non-custodial', () => {
  const evaluator = new SkillEngineEvaluator();
  const output = evaluator.evaluate({
    targetAddress: '0xca11bde05977b3631167028862be2a173976ca11',
    userQuery: 'Read the current block timestamp',
    bytecode: '0x60806040',
    blockNumber: '22378410',
    eip1967ImplSlot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    eip1967BeaconSlot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    ownerResult: {},
    pausedResult: {},
    totalSupplyResult: {},
    canonicalDocs: {
      name: 'MultiCall3',
      category: 'Canonical',
      docsUrl: 'https://docs.pharos.xyz',
      description: 'MultiCall3',
      matched: true,
    },
  });

  assert.ok(output.proposedTx, 'Should propose an unsigned inspection transaction');
  assert.equal(output.proposedTx.to, '0xca11bde05977b3631167028862be2a173976ca11');
  assert.equal(output.proposedTx.chainId, 1672);
  assert.equal(output.proposedTx.value, '0');
  assert.equal(output.proposedTx.data, '0x0f28c97d'); // getCurrentBlockTimestamp() selector
  assert.ok(output.proposedTx.safetyNotes.length >= 1);
});
