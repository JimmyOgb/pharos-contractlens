import test from 'node:test';
import assert from 'node:assert/strict';
import { PharosDocsMcpClient } from '../../src/mcp/docsClient.ts';

test('Live Docs MCP Integration: queries canonical contract documentation', async () => {
  const client = new PharosDocsMcpClient();
  const searchResult = await client.searchDocs('canonical');
  assert.ok(searchResult.length > 50, 'Search documentation should return content');
  assert.ok(searchResult.includes('Canonical Contracts') || searchResult.includes('MultiCall3'), 'Should reference canonical contracts');
});

test('Live Docs MCP Integration: retrieves specific documentation page', async () => {
  const client = new PharosDocsMcpClient();
  const pageContent = await client.getPage('https://docs.pharos.xyz/getting-started/canonical-contracts');
  assert.ok(pageContent.length > 100, 'Page content should be non-empty');
  assert.ok(pageContent.includes('0xcA11bde05977b3631167028862bE2a173976CA11'), 'Must include MultiCall3 canonical address');
});
