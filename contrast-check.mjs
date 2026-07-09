// RevHeat design tokens — AA contrast gate (the package's verify/CI gate; rerun after ANY color token edit)
// Usage: node contrast-check.mjs   (exits 1 on any failure)
// Parses vars.css literally — it checks the SHIPPED values, not a regeneration.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const vars = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'vars.css'), 'utf8');
const T = {};
for (const [, name, hex] of vars.matchAll(/(--rh-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) T[name] = hex.toLowerCase();
// resolve var() aliases (e.g. --rh-primary: var(--rh-purple)), up to 4 hops
const aliases = [...vars.matchAll(/(--rh-[a-z0-9-]+):\s*var\((--rh-[a-z0-9-]+)\)/g)];
for (let hop = 0; hop < 4; hop++)
  for (const [, name, target] of aliases) if (!T[name] && T[target]) T[name] = T[target];

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [label, fg token, bg token, floor] — mirrors the table in tokens-decisions.md.
const WHITE = '--rh-white';
const pairs = [
  ['ink on paper', '--rh-n-900', '--rh-paper', 4.5],
  ['ink on surface', '--rh-n-900', WHITE, 4.5],
  ['ink on n-100', '--rh-n-900', '--rh-n-100', 4.5],
  ['text-secondary on paper', '--rh-n-700', '--rh-paper', 4.5],
  ['text-muted on paper', '--rh-n-600', '--rh-paper', 4.5],
  ['text-muted on white', '--rh-n-600', WHITE, 4.5],
  ['text-muted on n-50', '--rh-n-600', '--rh-n-50', 4.5],
  ['text-muted on n-100', '--rh-n-600', '--rh-n-100', 4.5],
  ['primary text on paper', '--rh-primary', '--rh-paper', 4.5],
  ['primary text on white', '--rh-primary', WHITE, 4.5],
  ['primary text on primary-subtle', '--rh-primary', '--rh-primary-subtle', 4.5],
  ['white on primary', WHITE, '--rh-primary', 4.5],
  ['white on primary-hover', WHITE, '--rh-primary-hover', 4.5],
  ['white on primary-active', WHITE, '--rh-primary-active', 4.5],
  ['success on paper', '--rh-success', '--rh-paper', 4.5],
  ['success on success-subtle', '--rh-success', '--rh-success-subtle', 4.5],
  ['white on success', WHITE, '--rh-success', 4.5],
  ['white on success-hover', WHITE, '--rh-success-hover', 4.5], // hover rows: state-variant edits can't silently regress
  ['warning on paper', '--rh-warning', '--rh-paper', 4.5],
  ['warning on warning-subtle', '--rh-warning', '--rh-warning-subtle', 4.5],
  ['white on warning', WHITE, '--rh-warning', 4.5],
  ['white on warning-hover', WHITE, '--rh-warning-hover', 4.5],
  ['destructive on paper', '--rh-destructive', '--rh-paper', 4.5],
  ['destructive on destructive-subtle', '--rh-destructive', '--rh-destructive-subtle', 4.5],
  ['white on destructive', WHITE, '--rh-destructive', 4.5],
  ['white on destructive-hover', WHITE, '--rh-destructive-hover', 4.5],
  ['UI: focus ring vs paper', '--rh-primary', '--rh-paper', 3.0],
  ['UI: input border vs white', '--rh-n-400', WHITE, 3.0],
  ['UI: input border vs paper', '--rh-n-400', '--rh-paper', 3.0],
  ['UI: heat-1 vs paper', '--rh-heat-1', '--rh-paper', 3.0],
  ['UI: heat-2 vs paper', '--rh-heat-2', '--rh-paper', 3.0],
  ['UI: heat-3 vs paper', '--rh-heat-3', '--rh-paper', 3.0],
  ['UI: heat-4 vs paper', '--rh-heat-4', '--rh-paper', 3.0],
  ['UI: heat-5 vs paper', '--rh-heat-5', '--rh-paper', 3.0],
];

// Signature-element gate: every neutral must carry the purple tint (no flat grey).
let fail = 0;
for (const [name, hex] of Object.entries(T).filter(([n]) => /^--rh-n-\d+$/.test(n))) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  if (r === g && g === b) { console.log(`FAIL  flat grey neutral: ${name} ${hex}`); fail = 1; }
}

for (const [label, fg, bg, floor] of pairs) {
  if (!T[fg] || !T[bg]) { console.log(`FAIL  missing token: ${!T[fg] ? fg : bg} (${label})`); fail = 1; continue; }
  const r = ratio(T[fg], T[bg]);
  const ok = r >= floor;
  if (!ok) fail = 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.toFixed(2).padStart(6)} (floor ${floor})  ${label}  [${T[fg]} on ${T[bg]}]`);
}
console.log(fail ? '\nCONTRAST GATE: FAIL' : '\nCONTRAST GATE: all pairs pass');
process.exit(fail);
