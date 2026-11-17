import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));

test('local stdio introspection exposes tools without Etsy credentials', () => {
  const requests = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'offline-inspector', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  ].map(request => JSON.stringify(request)).join('\n') + '\n';

  const child = spawnSync(process.execPath, ['bin/etsy-mcp.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      ETSY_HUB_CONFIG: path.join(root, 'config.example.json'),
      ETSY_HUB_TOKEN_PROVIDER_MODULE: '',
      ETSY_MCP_READ_ONLY: '1',
    },
    input: requests,
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 2 * 1024 * 1024,
  });
  assert.ifError(child.error);
  assert.equal(child.status, 0, child.stderr);
  const messages = child.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
  assert.equal(messages.length, 2, 'MCP stdout should contain only JSON-RPC responses');
  const initialized = messages.find(message => message.id === 1);
  assert.equal(initialized?.result?.protocolVersion, '2025-06-18');
  assert.ok(initialized?.result?.capabilities?.tools);
  const listed = messages.find(message => message.id === 2);
  assert.equal(listed?.result?.tools?.length, 53, 'Read-only directory inspection should expose all read-only tools');
  for (const tool of listed.result.tools) {
    assert.ok(tool.name && tool.description, 'Listed tools must have names and descriptions');
    assert.equal(tool.annotations?.readOnlyHint, true, `Tool ${tool.name} must be read-only`);
    assert.ok(tool.inputSchema, `Tool ${tool.name} must declare its input schema`);
  }
});
