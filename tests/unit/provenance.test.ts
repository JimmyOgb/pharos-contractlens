import test from 'node:test';
import assert from 'node:assert/strict';
import { SkillEngineEvaluator } from '../../src/skillEngine/evaluator.ts';

test('Evidence Provenance: every policy check has an associated cryptographic provenance record', () => {
  const evaluator = new SkillEngineEvaluator();
  const output = evaluator.evaluate({
    targetAddress: '0xca11bde05977b3631167028862be2a173976ca11',
    userQuery: 'Verify provenance',
    bytecode: '0x123456',
    blockNumber: '22378405',
    eip1967ImplSlot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    eip1967BeaconSlot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    ownerResult: {},
    pausedResult: {},
    totalSupplyResult: {},
    canonicalDocs: {
      name: 'MultiCall3',
      category: 'Canonical Infrastructure',
      docsUrl: 'https://docs.pharos.xyz/getting-started/canonical-contracts',
      description: 'Canonical batch calls',
      matched: true,
    },
  });

  assert.ok(output.provenance.length >= 4, 'Should record at least 4 provenance items');
  for (const prov of output.provenance) {
    assert.ok(prov.field, 'Provenance item must specify field');
    assert.ok(prov.sourceType, 'Provenance item must specify sourceType');
    assert.ok(prov.targetAddress, 'Provenance item must specify targetAddress');
    assert.ok(prov.verifiedAt, 'Provenance item must specify verifiedAt timestamp');
  }

  for (const chk of output.checks) {
    assert.ok(chk.provenance, `Check ${chk.id} must link to a provenance record`);
  }
});
