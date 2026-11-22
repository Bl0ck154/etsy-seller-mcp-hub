import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ETSY_MCP_TOOLS, EtsyMcpAdapter } from '../src/mcp-adapter.mjs';
import { resolveStagedImagePath } from '../src/staged-image.mjs';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

async function withFixture(fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'etsy-staged-test-'));
  try {
    const uploadDir = path.join(root, 'uploads');
    await fs.mkdir(uploadDir);
    const sample = path.join(uploadDir, 'santa.jpg');
    await fs.writeFile(sample, jpeg);
    await fn({ root, uploadDir, sample });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

test('image tool schema includes an optional server-side file_path alongside base64', () => {
  const tool = ETSY_MCP_TOOLS.find(t => t.name === 'etsy_image_upload');
  assert.equal(tool.inputSchema.properties.file_path.type, 'string');
  assert.equal(tool.inputSchema.properties.file.required.includes('content_base64'), true);
  assert.equal(tool.annotations.readOnlyHint, false);
  assert.equal(ETSY_MCP_TOOLS.find(t => t.name === 'etsy_request_multipart').inputSchema.properties.files.items.properties.file_path, undefined);
});

test('staged image path only works after explicit directory opt-in', async () => {
  await withFixture(async ({ sample }) => {
    await assert.rejects(resolveStagedImagePath(sample, { root: undefined }),
      error => error.code === 'LOCAL_UPLOAD_DISABLED');
  });
});

test('rejects server secrets, traversal, relative paths, symlinks, and wrong file types before Etsy call', async () => {
  await withFixture(async ({ root, uploadDir, sample }) => {
    const outside = path.join(root, 'secret.jpg');
    await fs.writeFile(outside, jpeg);
    const sub = path.join(uploadDir, 'sub');
    await fs.mkdir(sub);
    await fs.symlink(outside, path.join(uploadDir, 'linked.jpg'));
    await fs.symlink(root, path.join(uploadDir, 'parent-link'));
    const txt = path.join(uploadDir, 'fake.jpg');
    await fs.writeFile(txt, 'not really an image');
    const pngNamedJpeg = path.join(uploadDir, 'misnamed.png');
    await fs.writeFile(pngNamedJpeg, jpeg);
    const empty = path.join(uploadDir, 'empty.jpg');
    await fs.writeFile(empty, Buffer.alloc(0));
    for (const target of [
      outside, path.join(uploadDir, '..', 'secret.jpg'), 'santa.jpg',
      path.join(uploadDir, 'linked.jpg'), path.join(uploadDir, 'parent-link', 'secret.jpg'),
      txt, pngNamedJpeg, empty, uploadDir,
    ]) {
      await assert.rejects(resolveStagedImagePath(target, { root: uploadDir }), { name: 'EtsyHubError' });
    }
    await assert.rejects(resolveStagedImagePath(sample, { root: uploadDir, maxBytes: 2 }),
      error => error.code === 'UPLOAD_TOO_LARGE');
    assert.equal(await resolveStagedImagePath(sample, { root: uploadDir }), sample);
  });
});

test('MCP accepts a staged JPG and forwards streaming file path through existing snapshot uploader', async () => {
  await withFixture(async ({ uploadDir, sample }) => {
    const previous = process.env.ETSY_MCP_UPLOAD_DIR;
    process.env.ETSY_MCP_UPLOAD_DIR = uploadDir;
    const calls = [];
    try {
      const hub = {
        shop() { return { shop_id: '1', alias: 'main' }; },
        async uploadImageData(...args) {
          calls.push(args);
          return { data: { listing_image_id: 888 }, backup: '/mock/snapshot.json' };
        },
      };
      const adapter = new EtsyMcpAdapter(hub, {});
      const value = await adapter.call('etsy_image_upload', {
        listing_id: '123', file_path: sample, rank: 2, alt_text: 'Rude Santa',
      });
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0][1], { path: sample });
      assert.equal(calls[0][2].rank, 2);
      assert.equal(calls[0][2].backup, true);
      assert.equal(value.data.listing_image_id, 888);
      await assert.rejects(adapter.call('etsy_image_upload', {
        listing_id: '123', file_path: sample, file: { name: 'santa.jpg', content_base64: 'YWJj' },
      }), /exactly one/);
      await assert.rejects(adapter.call('etsy_image_upload', {
        listing_id: '123', file_path: sample, listing_image_id: '999',
      }), /exactly one/);
      await assert.rejects(adapter.call('etsy_image_upload', {
        listing_id: '123', file_path: path.join(uploadDir, 'other.jpg'),
      }), { code: 'ENOENT' });
      assert.equal(calls.length, 1, 'invalid files must not trigger Etsy');
    } finally {
      if (previous === undefined) delete process.env.ETSY_MCP_UPLOAD_DIR;
      else process.env.ETSY_MCP_UPLOAD_DIR = previous;
    }
  });
});

test('existing base64 image upload remains supported without a staged path', async () => {
  const calls = [];
  const hub = {
    shop() { return { shop_id: '1', alias: 'main' }; },
    async uploadImageData(...args) {
      calls.push(args);
      return { data: { listing_image_id: 123 } };
    },
  };
  await new EtsyMcpAdapter(hub, {}).call('etsy_image_upload', {
    listing_id: '123', file: { name: 'test.jpg', content_base64: 'YWJj', mime_type: 'image/jpeg' },
  });
  assert.deepEqual(calls[0][1], { name: 'test.jpg', content_base64: 'YWJj', mime_type: 'image/jpeg' });
});
