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
// opens with its own requirement identifier, and each one is either delivered
// by a screen or recorded as an omission. This script decides which.
//
// It reads and never writes.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..", "..", "..");
const analysis = path.join(root, "docs", "analysis");
const wiki = path.join(root, "packages", "frontend", "wiki");
const plan = path.join(wiki, "screen-plan.md");
const omissions = path.join(wiki, "omissions.md");

/** A screen citation must name the page it delivers, not only the section. */
const SCREEN = /[\w-]+-page\.tsx/u;

/**
 * Shortest reason an omission is accepted with.
 *
 * The guidance asks for the owner or observable alternative and the condition
 * that would make the decision false, and no script can judge whether a
 * sentence says that. What it can refuse is the absence of a sentence, which is
 * the shape a pasted enumeration takes.
 */
const REASON_CHARACTERS = 40;

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

/** The form a citation is compared in, so a slug and an identifier agree. */
const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]+/gu, "");

/**
 * The citations one line carries, as normalized whole tokens.
 *
 * Comparison is by token equality rather than by containment, because every
 * identifier in the corpus is a prefix of its own children: a line citing
 * `REQ-AUTH-PROVISION-1` contains `REQ-AUTH-PROVISION`, and a containment test
 * would let one child's screen silently deliver its whole family.
 */
const citations = (line) => new Set(line.split(/[^\w-]+/u).map(normalize));

const posix = (file) => path.relative(root, file).replaceAll("\\", "/");

/**
 * Requirement sections, each with the identifier it opens with.
 *
 * An H3 records the H2 above it, because a decision about a section family is
 * one decision. That is the hierarchy the evidence graph already uses, where an
 * acknowledged parent covers its selected descendants, and without it the
 * largest subject would need roughly eight hundred separately authored
 * exclusions for concepts a browser never delivers.
 */
const sections = () => {
  const found = [];
  for (const file of walk(analysis).filter((name) => name.endsWith(".md"))) {
    let parent;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/u)) {
      const heading = /^(#{2,3})[ \t]+(.*\S)[ \t]*$/u.exec(line);
      if (heading === null) continue;
      const text = heading[2].replace(/[ \t]*\{#[^}]*\}[ \t]*$/u, "");
      const identifier = /^\S+/u.exec(text)?.[0] ?? text;
      const section = {
        file: posix(file),
        text,
        identifier,
        parent: heading[1].length === 3 ? parent : undefined,
      };
      if (heading[1].length === 2) parent = section;
      found.push(section);
    }
  }
  return found;
};

const lines = (file) =>
  fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/u) : [];

const planned = lines(plan)
  .filter((line) => SCREEN.test(line))
  .map(citations);
const excused = lines(omissions)
  .filter((line) => normalize(line).length >= REASON_CHARACTERS)
  .map(citations);

const cited = (rows, section) => {
  const key = normalize(section.identifier);
  return rows.some((row) => row.has(key));
};

const required = sections();
if (required.length === 0) {
  process.stderr.write(
    `No requirement section was found under ${posix(analysis)}. The corpus is the denominator, so an empty one is a broken checkout rather than a satisfied plan.\n`,
  );
  process.exit(1);
}

const settled = (section) =>
  cited(planned, section) ||
  cited(excused, section) ||
  (section.parent !== undefined && cited(excused, section.parent));

const missing = required.filter((section) => settled(section) === false);
const covered = required.length - missing.length;
process.stdout.write(
  `${covered}/${required.length} requirement sections are delivered by a screen or recorded as an omission.\n`,
);
if (missing.length === 0) process.exit(0);

process.stderr.write(`\n${missing.length} requirement section(s) are neither:\n`);
for (const section of missing)
  process.stderr.write(`  ${section.file} :: ${section.text}\n`);
process.stderr.write(
  [
    "",
    "A screen entry is a line in packages/frontend/wiki/screen-plan.md naming both",
    "the requirement identifier and the page file that delivers it, so a copy of",
    "this enumeration is not a plan.",
    "",
    "An omission is a line in packages/frontend/wiki/omissions.md naming the",
    "identifier, what owns the requirement instead, and the condition that would",
    `make that decision false. An H2 identifier excuses its whole section family,`,
    "so a concept no browser delivers is one decision rather than many.",
    "",
  ].join("\n"),
);
process.exit(1);
