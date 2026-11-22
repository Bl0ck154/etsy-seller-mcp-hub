import fs from 'node:fs/promises';
import path from 'node:path';
import { inputError } from './errors.mjs';

const IMAGE_TYPES = new Map([
  ['.jpg', 'jpeg'], ['.jpeg', 'jpeg'], ['.png', 'png'], ['.webp', 'webp'],
]);
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

function approvedImage(bytes, type) {
  if (type === 'jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  return false;
}

// file_path is an absolute path on the MCP host, not the caller's filesystem.
// The approved root is disabled unless explicitly configured by the operator.
export async function resolveStagedImagePath(requested, {
  root = process.env.ETSY_MCP_UPLOAD_DIR,
  maxBytes = process.env.ETSY_HUB_MAX_UPLOAD_BYTES,
} = {}) {
  if (typeof root !== 'string' || !path.isAbsolute(root) || path.resolve(root) === path.parse(root).root) {
    throw inputError('Server-side image paths are disabled; configure ETSY_MCP_UPLOAD_DIR', 'LOCAL_UPLOAD_DISABLED');
  }
  if (typeof requested !== 'string' || !path.isAbsolute(requested) || requested.includes('\0')) {
    throw inputError('file_path must be an absolute path on the MCP server', 'INVALID_FILE_PATH');
  }
  if (requested.split(path.sep).includes('..') || requested.split(path.sep).includes('.')) {
    throw inputError('file_path may not contain path traversal components', 'INVALID_FILE_PATH');
  }
  const type = IMAGE_TYPES.get(path.extname(requested).toLowerCase());
  if (!type) throw inputError('file_path must point to a JPG, PNG or WebP image', 'INVALID_FILE_PATH');

  const base = path.resolve(root);
  const relative = path.relative(base, requested);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw inputError('file_path must be within the configured upload directory', 'INVALID_FILE_PATH');
  }

  // Reject symlinks in every component, including directories.
  let current = base;
  const baseInfo = await fs.lstat(base);
  if (!baseInfo.isDirectory() || baseInfo.isSymbolicLink()) {
    throw inputError('Upload directory must be a real directory', 'INVALID_FILE_PATH');
  }
  for (const name of relative.split(path.sep)) {
    current = path.join(current, name);
    if ((await fs.lstat(current)).isSymbolicLink()) {
      throw inputError('Symlinks are not allowed in file_path', 'INVALID_FILE_PATH');
    }
  }
  const actualBase = await fs.realpath(base);
  const actualFile = await fs.realpath(current);
  if (!actualFile.startsWith(actualBase + path.sep)) {
    throw inputError('file_path resolves outside the approved directory', 'INVALID_FILE_PATH');
  }
  const stat = await fs.stat(actualFile);
  if (!stat.isFile() || stat.size === 0) {
    throw inputError('file_path must point to a nonempty regular file', 'INVALID_FILE_DATA');
  }
  const requestedLimit = Number(maxBytes);
  const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 192 * 1024 * 1024) : DEFAULT_MAX_BYTES;
  if (stat.size > limit) throw inputError('Image exceeds upload size limit', 'UPLOAD_TOO_LARGE');

  const file = await fs.open(actualFile, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    if (!approvedImage(header.subarray(0, bytesRead), type)) {
      throw inputError('Image content does not match its extension', 'INVALID_FILE_DATA');
    }
  } finally {
    await file.close();
  }
  return actualFile;
}
