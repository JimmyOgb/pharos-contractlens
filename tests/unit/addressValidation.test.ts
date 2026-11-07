import test from 'node:test';
import assert from 'node:assert/strict';
import { ContractLensAgent } from '../../src/agent/engine.ts';

test('Address Validation: accepts valid 40-hex lowercase and mixed-case EVM addresses', async () => {
  const agent = new ContractLensAgent();
  const validAddrs = [
    '0xcA11bde05977b3631167028862bE2a173976CA11',
    '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    '0x6b0a44c64190279f7034b77c13a566e914fe5ec4',
  ];

  for (const addr of validAddrs) {
    // Calling private check or analyze should not immediately fail address format check
    const isValid = (agent as unknown as { isValidAddress: (a: string) => boolean }).isValidAddress(addr);
    assert.equal(isValid, true, `Address ${addr} should be valid`);
  }
});

test('Address Validation: fails closed on malformed, short, or private-key-length hex strings', async () => {
  const agent = new ContractLensAgent();
  const invalidAddrs = [
    '',
    '0x123',
    'not-an-address',
    '0x000000000022D473030F116dDEE9F6B43aC78BA', // 39 hex chars
    '0x000000000022D473030F116dDEE9F6B43aC78BA333333333333333333333333333333333', // 64 hex chars (private key)
  ];

  for (const addr of invalidAddrs) {
    const res = await agent.analyze({ address: addr });
    assert.equal(res.decision, 'BLOCK');
    assert.match(res.decisionJustification, /Invalid EVM address format/);
    assert.equal(res.checks[0].id, 'RULE-ADDRESS-VALIDATION');
    assert.equal(res.checks[0].status, 'FAIL');
  }
});
