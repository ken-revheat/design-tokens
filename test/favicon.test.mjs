import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { canonicalDir, syncTo, verifyDir } from '../lib/favicon.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

test('bin entry actually executes as a subprocess (no import.meta.url guard)', () => {
  const d = tmp();
  execFileSync(process.execPath, ['bin/revheat-favicon.mjs', 'sync', d], { cwd: REPO_ROOT });
  execFileSync(process.execPath, ['bin/revheat-favicon.mjs', 'verify', d], { cwd: REPO_ROOT });

  const emptyDir = tmp();
  assert.throws(
    () => execFileSync(process.execPath, ['bin/revheat-favicon.mjs', 'verify', emptyDir], { cwd: REPO_ROOT }),
    (err) => err.status === 1
  );

  rmSync(d, { recursive: true, force: true });
  rmSync(emptyDir, { recursive: true, force: true });
});
