import { readFileSync, copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const CANONICAL = ['favicon.svg', 'favicon.ico', 'favicon-32.png', 'favicon-180.png', 'favicon-512.png'];
const PRIMARY = ['favicon.svg', 'favicon.ico'];

const SKIP_DIRS = new Set(['node_modules', '.nuxt', '.next', '.output', 'dist', '.git']);
// The shell package must actually be imported (not just a data-only /catalog import).
const UI_IMPORT = /from\s+['"]@revheat\/ui\/(?:react|vue)['"]/;
// AppShell pulled in as a real binding: `import { AppShell }` / `{ AppShell as Shell }`,
// including multiline import blocks. `[^}]` keeps the match inside one import's braces,
// so a stray `// AppShell` comment, a "AppShell" string, or `export { AppShell } from …`
// (a re-export, not a mount) does NOT satisfy it.
const NAMED_IMPORT = /import\s*(?:type\s+)?\{[^}]*\bAppShell\b[^}]*\}\s*from\s*['"]@revheat\/ui\/(?:react|vue)['"]/;
// AppShell actually rendered as JSX — plain `<AppShell …>` or namespaced `<UI.AppShell …>`
// (covers `import * as UI from '@revheat/ui/react'`).
const JSX_USAGE = /<(?:[A-Za-z_$][\w$]*\.)?AppShell[\s/>]/;
const SOURCE_EXT = /\.(vue|tsx?|jsx?|mjs)$/;
// A per-app product/sidebar rail file is a duplicate of what the shared shell
// (@revheat/ui) already owns — apps have re-implemented it under several names,
// so this is a set of path tripwires, not one exact filename.
const RAIL_PATTERNS = [
  /(?:^|\/)(?:Rh)?(?:Product|Sidebar)?Rail\w*\.(?:vue|[tj]sx?)$/,
  /(?:^|\/)(?:Rh)?Sidebar\.(?:vue|[tj]sx?)$/,
  /(?:^|\/)railProjection\.[tj]sx?$/,
];

// Recursively collect source files. Skips build/dep dirs and does NOT follow symlinks
// (avoids loops and dangling-link crashes). Unreadable dirs are skipped, not fatal.
function walkSource(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    if (ent.isSymbolicLink()) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) walkSource(full, files);
    else if (ent.isFile() && SOURCE_EXT.test(ent.name)) files.push(full);
  }
  return files;
}

export function verifyShell(dir) {
  const errors = [];
  if (!existsSync(dir)) {
    return { ok: false, errors: [`source directory not found: ${dir}`] };
  }
  const files = walkSource(dir);
  const mounts = files.filter((f) => {
    let src;
    try {
      src = readFileSync(f, 'utf8');
    } catch {
      return false;
    }
    // Named import of AppShell, OR the shell package is imported AND AppShell is rendered.
    return NAMED_IMPORT.test(src) || (UI_IMPORT.test(src) && JSX_USAGE.test(src));
  });
  if (mounts.length === 0) {
    errors.push(
      "no file mounts the RevHeat shell (import { AppShell } from '@revheat/ui/react' or '/vue'). " +
      "A data-only '@revheat/ui/catalog' import does NOT count — the app must render inside <AppShell>."
    );
  }
  for (const f of [...files].sort()) {
    const rel = relative(dir, f).split('\\').join('/');
    if (RAIL_PATTERNS.some((re) => re.test(rel))) {
      errors.push(`own product rail found: ${rel} — delete it; the shared shell (@revheat/ui) owns the rail`);
    }
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
