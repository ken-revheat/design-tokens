/**
 * css-parse-check.mjs — the shipped CSS must actually parse.
 *
 * Why this exists: `tailwind4.css` shipped with a usage example in its header
 * banner that itself contained a block comment. CSS comments do not nest, so
 * the banner terminated at that inner comment's close, the prose below it was
 * parsed as CSS, and an apostrophe in that prose became an unterminated string.
 * Every consumer of the `./tailwind4.css` export failed at build. It went
 * undetected because nothing in this package ever parsed its own CSS — `verify`
 * only checked contrast and the TW3 preset.
 *
 * Dependency-free by design (the git-dep recipe forbids a build/prepare step),
 * so this is a hand-rolled scanner covering exactly the failure modes that can
 * silently ship a broken stylesheet:
 *   1. a nested block comment,
 *   2. an unterminated block comment,
 *   3. a string literal that runs past its line,
 *   4. unbalanced braces.
 *
 * Exits non-zero on any failure. Wired into `npm run verify` (SYSTEM.md §11.3).
 */
import { readFileSync } from "node:fs";

/** The shipped stylesheets. Override by passing paths as arguments (used by tests). */
const SHIPPED = ["tailwind4.css", "vars.css", "fonts.css"];
const args = process.argv.slice(2);
const FILES = args.length ? args : SHIPPED;

/** Resolve relative to the package when using the default set, else to cwd. */
function read(file) {
  return args.length
    ? readFileSync(file, "utf8")
    : readFileSync(new URL(file, import.meta.url), "utf8");
}

/** Scan one stylesheet, returning a list of human-readable defects. */
function check(file) {
  const src = read(file);
  const errors = [];

  let line = 1;
  let depth = 0; // brace depth
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    if (ch === "\n") {
      line++;
      i++;
      continue;
    }

    // Block comment — CSS comments do NOT nest.
    if (ch === "/" && next === "*") {
      const openedAt = line;
      i += 2;
      let closed = false;
      while (i < src.length) {
        if (src[i] === "\n") line++;
        if (src[i] === "*" && src[i + 1] === "/") {
          i += 2;
          closed = true;
          break;
        }
        // A "/*" whose "*" is really the closer's — e.g. a body ending in a URL
        // path, "…/docs/theme/*/". Not a nested opener; step on and let the
        // next iteration close the comment.
        if (src[i] === "/" && src[i + 1] === "*" && src[i + 2] === "/") {
          i++;
          continue;
        }
        if (src[i] === "/" && src[i + 1] === "*") {
          errors.push(
            `line ${line}: nested block comment — the comment opened on line ${openedAt} ` +
              `already terminates at the first "*/", so everything after it is parsed as CSS`,
          );
          i += 2;
          continue;
        }
        i++;
      }
      if (!closed) errors.push(`line ${openedAt}: unterminated block comment`);
      continue;
    }

    // Escape sequence at top level — e.g. Tailwind's escaped selectors
    // (.before\:content-\[\'\'\]). The escaped character is consumed here so an
    // escaped quote is never mistaken for a string opener.
    if (ch === "\\") {
      if (next === "\n") line++;
      i += 2;
      continue;
    }

    // String literal — must close on the line it opened.
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const openedAt = line;
      i++;
      let closed = false;
      while (i < src.length) {
        if (src[i] === "\\") {
          if (src[i + 1] === "\n") line++; // escaped newline: a valid continuation
          i += 2;
          continue;
        }
        if (src[i] === "\n") break; // ran past its line
        if (src[i] === quote) {
          i++;
          closed = true;
          break;
        }
        i++;
      }
      if (!closed) errors.push(`line ${openedAt}: unterminated string (${quote})`);
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth < 0) {
        errors.push(`line ${line}: unbalanced "}" — more closing than opening braces`);
        depth = 0;
      }
    }

    i++;
  }

  if (depth > 0) errors.push(`unbalanced braces — ${depth} block(s) left open at EOF`);
  return errors;
}

let failed = false;
for (const file of FILES) {
  const errors = check(file);
  if (errors.length) {
    failed = true;
    console.error(`✗ ${file}`);
    for (const e of errors) console.error(`    ${e}`);
  } else {
    console.log(`✓ ${file} parses`);
  }
}

if (failed) {
  console.error("\nCSS parse check FAILED — this stylesheet would break every consumer's build.");
  process.exit(1);
}
console.log("\nCSS parse check passed.");
