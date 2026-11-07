import test from 'node:test';
import assert from 'node:assert/strict';
import { handleHealth, handleTools } from '../../src/server/router.ts';
import { ServerResponse } from 'node:http';

test('Router Unit: handleHealth returns status ok with chainId 1672', async () => {
  let statusCode = 0;
  let headers: Record<string, string> = {};
  let body = '';

  const mockRes = {
    writeHead(code: number, hdrs: Record<string, string>) {
      statusCode = code;
      headers = hdrs;
    },
    end(data: string) {
      body = data;
    },
  } as unknown as ServerResponse;

  await handleHealth(mockRes);

  assert.equal(statusCode, 200);
  const json = JSON.parse(body);
  assert.equal(json.status, 'ok');
  assert.equal(json.chainId, 1672);
  assert.equal(json.network, 'Pharos Pacific Mainnet');
});

test('Router Unit: handleTools reports all three integrations', async () => {
  let statusCode = 0;
  let body = '';

  const mockRes = {
    writeHead(code: number) {
      statusCode = code;
    },
    end(data: string) {
      body = data;
    },
  } as unknown as ServerResponse;

  await handleTools(mockRes);

  assert.equal(statusCode, 200);
  const json = JSON.parse(body);
  assert.equal(json.integrations.length, 3);
  assert.equal(json.integrations[0].id, 'pharos_chain_mcp');
  assert.equal(json.integrations[1].id, 'pharos_docs_mcp');
  assert.equal(json.integrations[2].id, 'pharos_skill_engine');
});
