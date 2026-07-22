import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalDir, syncTo, verifyDir } from '../bin/revheat-favicon.mjs';

function tmp() { return mkdtempSync(join(tmpdir(), 'favtest-')); }

test('canonical set has the required files', () => {
  const files = readdirSync(canonicalDir());
  for (const f of ['favicon.svg', 'favicon.ico', 'favicon-32.png', 'favicon-180.png', 'favicon-512.png']) {
    assert.ok(files.includes(f), `canonical missing ${f}`);
  }
});

test('sync then verify passes', () => {
  const d = tmp();
  syncTo(d);
  const r = verifyDir(d);
  assert.equal(r.ok, true, r.errors.join('; '));
  rmSync(d, { recursive: true, force: true });
});

test('verify fails on a tampered favicon', () => {
  const d = tmp();
  syncTo(d);
  writeFileSync(join(d, 'favicon.svg'), '<svg>not the R</svg>');
  const r = verifyDir(d);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('favicon.svg')));
  rmSync(d, { recursive: true, force: true });
});

test('verify fails when no primary favicon is present', () => {
  const d = tmp();
  // only a non-primary png present, no svg/ico
  copyFileSync(join(canonicalDir(), 'favicon-32.png'), join(d, 'favicon-32.png'));
  const r = verifyDir(d);
  assert.equal(r.ok, false);
  rmSync(d, { recursive: true, force: true });
});
