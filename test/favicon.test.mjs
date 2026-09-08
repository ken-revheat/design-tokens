import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync, rmSync, readdirSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { canonicalDir, syncTo, verifyDir, verifyShell } from '../lib/favicon.mjs';

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

test("verify-shell fails when nothing mounts the shell", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  writeFileSync(join(dir, "page.tsx"), `import { PRODUCT_CATALOG } from "@revheat/ui/catalog";`);
  const r = verifyShell(dir);
  assert.equal(r.ok, false);
  assert.ok(r.errors.length > 0);
});

test("verify-shell passes when a file mounts AppShell from @revheat/ui/react", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  mkdirSync(join(dir, "app"), { recursive: true });
  writeFileSync(join(dir, "app", "layout.tsx"), `import { AppShell } from "@revheat/ui/react";\nexport default () => <AppShell/>;`);
  const r = verifyShell(dir);
  assert.equal(r.ok, true);
});

test("verify-shell ignores node_modules/.next/dist", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  mkdirSync(join(dir, "node_modules", "x"), { recursive: true });
  writeFileSync(join(dir, "node_modules", "x", "y.tsx"), `import { AppShell } from "@revheat/ui/react";`);
  const r = verifyShell(dir);
  assert.equal(r.ok, false); // the mount inside node_modules must NOT count
});

test("verify-shell does NOT false-pass on a stray AppShell mention", () => {
  // Importing OTHER things from the shell package (every app does this) plus the
  // word AppShell in a comment must NOT satisfy the gate.
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  writeFileSync(join(dir, "page.tsx"),
    `import { Button, Card } from "@revheat/ui/react";\n// TODO: wrap in AppShell later\nexport default () => <Button/>;`);
  const r = verifyShell(dir);
  assert.equal(r.ok, false);
});

test("verify-shell does NOT count a re-export of AppShell as a mount", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  writeFileSync(join(dir, "barrel.ts"), `export { AppShell } from "@revheat/ui/react";`);
  const r = verifyShell(dir);
  assert.equal(r.ok, false);
});

test("verify-shell passes on an aliased, multiline AppShell import", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  writeFileSync(join(dir, "layout.tsx"),
    `import {\n  AppShell as Shell,\n  Button,\n} from "@revheat/ui/react";\nexport default () => <Shell/>;`);
  const r = verifyShell(dir);
  assert.equal(r.ok, true, r.errors.join("; "));
});

test("verify-shell passes on a namespace import rendered as <UI.AppShell/>", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  writeFileSync(join(dir, "layout.tsx"),
    `import * as UI from "@revheat/ui/react";\nexport default () => <UI.AppShell/>;`);
  const r = verifyShell(dir);
  assert.equal(r.ok, true, r.errors.join("; "));
});

test("verify-shell returns a clean failure (no throw) on a missing directory", () => {
  const r = verifyShell(join(tmpdir(), "vs-does-not-exist-" + process.pid));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes("not found")));
});

test("verify-shell survives a dangling symlink and still finds the real mount", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  writeFileSync(join(dir, "layout.tsx"), `import { AppShell } from "@revheat/ui/react";\nexport default () => <AppShell/>;`);
  symlinkSync(join(dir, "nowhere-target"), join(dir, "broken.tsx")); // dangling link
  const r = verifyShell(dir);
  assert.equal(r.ok, true, r.errors.join("; "));
});

function withMount(dir) {
  mkdirSync(join(dir, "app"), { recursive: true });
  writeFileSync(join(dir, "app", "layout.tsx"),
    `import { AppShell } from "@revheat/ui/react";\nexport default () => <AppShell/>;`);
}

test("verify-shell fails on components/RhProductRail.vue", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  withMount(dir);
  mkdirSync(join(dir, "components"), { recursive: true });
  writeFileSync(join(dir, "components", "RhProductRail.vue"), `<template></template>`);
  const r = verifyShell(dir);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes("own product rail found: components/RhProductRail.vue")));
});

test("verify-shell fails on components/RhSidebar.vue", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  withMount(dir);
  mkdirSync(join(dir, "components"), { recursive: true });
  writeFileSync(join(dir, "components", "RhSidebar.vue"), `<template></template>`);
  const r = verifyShell(dir);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes("own product rail found: components/RhSidebar.vue")));
});

test("verify-shell fails on components/RhSidebarRail.vue", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  withMount(dir);
  mkdirSync(join(dir, "components"), { recursive: true });
  writeFileSync(join(dir, "components", "RhSidebarRail.vue"), `<template></template>`);
  const r = verifyShell(dir);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes("own product rail found: components/RhSidebarRail.vue")));
});

test("verify-shell fails on src/components/ProductRail.tsx", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  withMount(dir);
  mkdirSync(join(dir, "src", "components"), { recursive: true });
  writeFileSync(join(dir, "src", "components", "ProductRail.tsx"), `export default function ProductRail() { return null; }`);
  const r = verifyShell(dir);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes("own product rail found: src/components/ProductRail.tsx")));
});

test("verify-shell fails on src/app-shell/Sidebar.tsx", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  withMount(dir);
  mkdirSync(join(dir, "src", "app-shell"), { recursive: true });
  writeFileSync(join(dir, "src", "app-shell", "Sidebar.tsx"), `export default function Sidebar() { return null; }`);
  const r = verifyShell(dir);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes("own product rail found: src/app-shell/Sidebar.tsx")));
});

test("verify-shell fails on app/utils/railProjection.ts", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  withMount(dir);
  mkdirSync(join(dir, "app", "utils"), { recursive: true });
  writeFileSync(join(dir, "app", "utils", "railProjection.ts"), `export function railProjection() {}`);
  const r = verifyShell(dir);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes("own product rail found: app/utils/railProjection.ts")));
});

test("verify-shell does NOT flag components/ui/PageTrail.vue as a rail", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  withMount(dir);
  mkdirSync(join(dir, "components", "ui"), { recursive: true });
  writeFileSync(join(dir, "components", "ui", "PageTrail.vue"), `<template></template>`);
  const r = verifyShell(dir);
  assert.equal(r.ok, true, r.errors.join("; "));
});

test("verify-shell does NOT flag a rail-named file sitting inside node_modules", () => {
  const dir = mkdtempSync(join(tmpdir(), "vs-"));
  withMount(dir);
  mkdirSync(join(dir, "node_modules", "@revheat", "ui"), { recursive: true });
  writeFileSync(join(dir, "node_modules", "@revheat", "ui", "RhProductRail.vue"), `<template></template>`);
  const r = verifyShell(dir);
  assert.equal(r.ok, true, r.errors.join("; "));
});

test("verify-shell exit codes as a subprocess: 1 on no-shell, 2 on bad usage", () => {
  const noShell = mkdtempSync(join(tmpdir(), "vs-"));
  writeFileSync(join(noShell, "page.tsx"), `import { Button } from "@revheat/ui/react";`);
  assert.throws(
    () => execFileSync(process.execPath, ['bin/revheat-favicon.mjs', 'verify-shell', noShell], { cwd: REPO_ROOT }),
    (err) => err.status === 1
  );
  assert.throws(
    () => execFileSync(process.execPath, ['bin/revheat-favicon.mjs', 'verify-shell'], { cwd: REPO_ROOT }),
    (err) => err.status === 2
  );

  const withShell = mkdtempSync(join(tmpdir(), "vs-"));
  writeFileSync(join(withShell, "layout.tsx"), `import { AppShell } from "@revheat/ui/react";\nexport default () => <AppShell/>;`);
  execFileSync(process.execPath, ['bin/revheat-favicon.mjs', 'verify-shell', withShell], { cwd: REPO_ROOT }); // exit 0

  const withRail = mkdtempSync(join(tmpdir(), "vs-"));
  writeFileSync(join(withRail, "layout.tsx"), `import { AppShell } from "@revheat/ui/react";\nexport default () => <AppShell/>;`);
  mkdirSync(join(withRail, "components"));
  writeFileSync(join(withRail, "components", "RhProductRail.vue"), `<template><nav/></template>`);
  assert.throws(
    () => execFileSync(process.execPath, ['bin/revheat-favicon.mjs', 'verify-shell', withRail], { cwd: REPO_ROOT, stdio: 'pipe' }),
    (err) => err.status === 1 && String(err.stderr).includes('own product rail found: components/RhProductRail.vue')
  );
});
