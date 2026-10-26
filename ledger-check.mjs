// Check the shipped opt-in theme and its local assets, never an assumed palette.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const css = read('ledger.css');
assert.match(css, /^\[data-rh-theme="ledger"\] \{/m);
assert.doesNotMatch(css, /:root/);
const t = Object.fromEntries([...css.matchAll(/(--rh-[\w-]+):\s*(#[\da-f]{6})/gi)].map(m => [m[1], m[2]]));
const lum = hex => {
 const c = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4);
 return c[0]*.2126+c[1]*.7152+c[2]*.0722;
};
const pairs = [
 ['--rh-ink','--rh-bg',4.5], ['--rh-text-muted','--rh-bg',4.5],
 ['--rh-text-muted','--rh-surface',4.5], ['--rh-text-secondary','--rh-bg',4.5],
 ['--rh-primary-foreground','--rh-primary',4.5], ['--rh-primary-foreground','--rh-primary-hover',4.5],
 ['--rh-accent-foreground','--rh-accent',4.5], ['--rh-accent-foreground','--rh-accent-hover',4.5],
 ['--rh-accent-text','--rh-surface',4.5], ['--rh-accent-text','--rh-bg',4.5],
 ['--rh-on-dark','--rh-dark',4.5], ['--rh-muted-on-dark','--rh-dark-surface',4.5],
 ['--rh-border-input','--rh-surface',3], ['--rh-border-input','--rh-bg',3],
];
for (const [fg,bg,floor] of pairs) {
 assert.ok(t[fg] && t[bg], `missing ${fg} or ${bg}`);
 const [hi,lo] = [lum(t[fg]),lum(t[bg])].sort((a,b)=>b-a);
 const ratio = (hi+.05)/(lo+.05);
 assert.ok(ratio>=floor, `${fg} on ${bg}: ${ratio.toFixed(2)} < ${floor}`);
 console.log(`PASS ${ratio.toFixed(2)} ${fg} on ${bg}`);
}
for (const [,path] of read('ledger-fonts.css').matchAll(/url\("([^"]+)"\)/g)) {
 assert.ok(existsSync(new URL(path,import.meta.url)), `missing font ${path}`);
}
for (const file of ['revheat-logo-on-light.svg','revheat-logo-on-dark.svg','revheat-app-icon.svg']) {
 const svg = read(`assets/${file}`);
 assert.match(svg, /#ff4a1c/i);
 assert.doesNotMatch(svg, /#6143f9|gradient/i);
}
console.log('Ledger contrast and local asset checks passed.');
