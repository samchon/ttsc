// Check the screen plan against the requirement sections it must account for.
//
// The backend's completeness obligation is countable: every generated accessor
// states its own address in a JSDoc `@accessor` tag, so the operation list is
// exact and `backend/testing.md` states a rule over it. The frontend's
// equivalent quantified over a set the author chose, which is a rule that
// cannot be violated, so a workspace with one journey satisfied it exactly as
// well as a workspace with forty.
//
// The denominator is the frozen corpus. Every H2 and H3 under `docs/analysis`
// is a requirement section, and each one is either named by the screen plan or
// recorded as an omission with a reason. This script decides which, and prints
// the ones that are neither.
//
// It reads and never writes. A section is "named" when its heading text appears
// anywhere in the plan or the omissions record, because the plan's shape is the
// author's to choose and a citation is the part a reader has to be able to
// follow.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..", "..", "..");
const analysis = path.join(root, "docs", "analysis");
const plan = path.join(
  root,
  "packages",
  "frontend",
  "wiki",
  "screen-plan.md",
);
const omissions = path.join(
  root,
  "packages",
  "frontend",
  "wiki",
  "omissions.md",
);

/** Every regular file under one directory, in sorted path order. */
const walk = (directory) =>
  fs.existsSync(directory) === false
    ? []
    : fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
          const child = path.join(directory, entry.name);
          return entry.isDirectory() ? walk(child) : [child];
        })
        .sort();

/**
 * Requirement sections, as `<file>#<heading>` pairs.
 *
 * Fenced code is skipped, because a `##` inside a fence is a comment in an
 * example rather than a section of the specification.
 */
const sections = () => {
  const found = [];
  for (const file of walk(analysis).filter((name) => name.endsWith(".md"))) {
    let fenced = false;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/u)) {
      if (/^\s*(?:```|~~~)/u.test(line)) {
        fenced = fenced === false;
        continue;
      }
      if (fenced) continue;
      const heading = /^(#{2,3})\s+(.*\S)\s*$/u.exec(line);
      if (heading === null) continue;
      found.push({
        file: path.relative(root, file).replaceAll("\\", "/"),
        heading: heading[2].replace(/\s*\{#[^}]*\}\s*$/u, ""),
      });
    }
  }
  return found;
};

const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");

const accounted = `${read(plan)}\n${read(omissions)}`;
const required = sections();
if (required.length === 0) {
  process.stderr.write(
    `No requirement section was found under ${path.relative(root, analysis)}. The corpus is the denominator, so an empty one is a broken checkout rather than a satisfied plan.\n`,
  );
  process.exit(1);
}

const missing = required.filter(
  (section) => accounted.includes(section.heading) === false,
);
const covered = required.length - missing.length;
process.stdout.write(
  `${covered}/${required.length} requirement sections are named by the screen plan or its omissions record.\n`,
);
if (missing.length === 0) process.exit(0);

process.stderr.write(
  `\n${missing.length} requirement section(s) are named by neither:\n`,
);
for (const section of missing)
  process.stderr.write(`  ${section.file} :: ${section.heading}\n`);
process.stderr.write(
  `\nEach needs a screen in packages/frontend/wiki/screen-plan.md, or an entry in packages/frontend/wiki/omissions.md naming what covers it instead and the condition that would make that decision false.\n`,
);
process.exit(1);
