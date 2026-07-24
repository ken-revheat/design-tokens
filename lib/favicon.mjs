import { readFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CANONICAL = ['favicon.svg', 'favicon.ico', 'favicon-32.png', 'favicon-180.png', 'favicon-512.png'];
const PRIMARY = ['favicon.svg', 'favicon.ico'];

const SKIP_DIRS = new Set(['node_modules', '.nuxt', '.next', '.output', 'dist', '.git']);
const MOUNT_PATTERNS = [
  /from\s+['"]@revheat\/ui\/react['"]/,
  /from\s+['"]@revheat\/ui\/vue['"]/,
];
const SOURCE_EXT = /\.(vue|tsx?|jsx?|mjs)$/;

function walkSource(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkSource(full, files);
    else if (SOURCE_EXT.test(name)) files.push(full);
  }
  return files;
}

export function verifyShell(dir) {
  const errors = [];
  const files = walkSource(dir);
  const mounts = files.filter((f) => {
    const src = readFileSync(f, 'utf8');
    return MOUNT_PATTERNS.some((re) => re.test(src)) && /\bAppShell\b/.test(src);
  });
  if (mounts.length === 0) {
    errors.push(
      "no file mounts the RevHeat shell (import { AppShell } from '@revheat/ui/react' or '/vue'). " +
      "A data-only '@revheat/ui/catalog' import does NOT count — the app must render inside <AppShell>."
    );
  }
  return { ok: errors.length === 0, errors };
}

export function canonicalDir() {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'favicon');
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function syncTo(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  for (const f of CANONICAL) copyFileSync(join(canonicalDir(), f), join(dir, f));
}

export function verifyDir(dir) {
  const errors = [];
  const canon = Object.fromEntries(CANONICAL.map(f => [f, sha256(join(canonicalDir(), f))]));
  const present = existsSync(dir) ? readdirSync(dir) : [];
  // Any canonical-named file that IS present must byte-match canonical.
  for (const f of CANONICAL) {
    if (present.includes(f) && sha256(join(dir, f)) !== canon[f]) {
      errors.push(`${f} does not match the canonical RevHeat favicon`);
    }
  }
  // At least one primary must be present and matching.
  const primaryOk = PRIMARY.some(f => present.includes(f) && sha256(join(dir, f)) === canon[f]);
  if (!primaryOk) errors.push(`no canonical primary favicon (${PRIMARY.join(' or ')}) found in ${dir}`);
  return { ok: errors.length === 0, errors };
}

export function run(argv) {
  const [cmd, dir] = argv;
  if (!cmd || !dir || !['sync', 'verify', 'verify-shell'].includes(cmd)) {
    console.error('usage: revheat-favicon <sync|verify|verify-shell> <dir>');
    process.exit(2);
  }
  if (cmd === 'sync') { syncTo(dir); console.log(`revheat-favicon: synced R favicon → ${dir}`); return; }
  if (cmd === 'verify-shell') {
    const r = verifyShell(dir);
    if (r.ok) { console.log(`revheat-favicon: ${dir} mounts the RevHeat shell`); return; }
    console.error('revheat-favicon: FAIL\n  - ' + r.errors.join('\n  - '));
    process.exit(1);
  }
  const r = verifyDir(dir);
  if (r.ok) { console.log(`revheat-favicon: ${dir} matches the canonical RevHeat R favicon`); return; }
  console.error('revheat-favicon: FAIL\n  - ' + r.errors.join('\n  - '));
  process.exit(1);
}
