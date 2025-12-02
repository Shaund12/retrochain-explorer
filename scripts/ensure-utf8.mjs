#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const INCLUDE_EXT = new Set([
  '.vue', '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.md', '.mjs', '.cjs', '.html', '.yml', '.yaml'
]);
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', '.vercel', '.next', 'build', 'coverage']);

const arg = process.argv[2] || 'fix'; // 'check' or 'fix'
let invalidFiles = [];
let fixedFiles = [];
let bomRemoved = [];

function hasBom(buf) {
  return buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
}

function decodeUtf8Strict(buf) {
  // Use TextDecoder with fatal to detect invalid UTF-8
  const dec = new TextDecoder('utf-8', { fatal: true });
  return dec.decode(buf);
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (EXCLUDE_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p);
      continue;
    }
    const ext = path.extname(e.name).toLowerCase();
    if (!INCLUDE_EXT.has(ext)) continue;

    const buf = fs.readFileSync(p);
    // Strip BOM if present
    let contentBuf = buf;
    if (hasBom(buf)) {
      contentBuf = buf.slice(3);
      if (arg !== 'check') {
        fs.writeFileSync(p, contentBuf);
      }
      bomRemoved.push(path.relative(root, p));
    }

    try {
      decodeUtf8Strict(contentBuf);
    } catch {
      invalidFiles.push(path.relative(root, p));
      if (arg !== 'check') {
        // Attempt recovery: interpret bytes as latin1 and re-encode to UTF-8
        const recovered = Buffer.from(contentBuf.toString('latin1'), 'utf8');
        fs.writeFileSync(p, recovered);
        fixedFiles.push(path.relative(root, p));
      }
    }
  }
}

walk(root);

if (arg === 'check') {
  if (invalidFiles.length || bomRemoved.length) {
    console.error('[utf8-check] Non-UTF8 or BOM detected in files:');
    bomRemoved.forEach(f => console.error('BOM:', f));
    invalidFiles.forEach(f => console.error('ENC:', f));
    process.exit(1);
  } else {
    console.log('[utf8-check] All files are valid UTF-8 (no BOM).');
  }
} else {
  if (bomRemoved.length) console.log(`[utf8-fix] BOM removed: ${bomRemoved.length}`);
  if (fixedFiles.length) console.log(`[utf8-fix] Converted to UTF-8: ${fixedFiles.length}`);
  if (!bomRemoved.length && !fixedFiles.length) console.log('[utf8-fix] Nothing to fix.');
}
